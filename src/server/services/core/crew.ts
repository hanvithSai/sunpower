/**
 * Crew booking (BR-07): reads who is an installer, how loaded each one is and
 * who is already booked over the next two weeks, then lets chooseCrew
 * (src/lib/crew.ts) pick the first day with three free installers.
 */
import type { ClientSession, Types } from "mongoose";
import { chooseCrew, CREW_SEARCH_DAYS } from "@/lib/crew";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { Job, User } from "../../models";

/** Crews leave at 09:30 IST. */
const START_HOUR_IST = 9.5;
// A fresh object per query: Mongoose casts filters in place.
const openJob = () => ({ $in: ["scheduled", "in_progress"] as ("scheduled" | "in_progress")[] });

export type Installer = { _id: Types.ObjectId; name: string };

/** Technician ids already booked on a job on the IST day starting at `dayStart`. */
export async function busyTechnicianIds(dayStart: Date, session?: ClientSession, excludeJobId?: Types.ObjectId): Promise<Set<string>> {
  const filter: Record<string, unknown> = {
    status: openJob(),
    scheduledFor: { $gte: dayStart, $lt: addDays(dayStart, 1) },
  };
  if (excludeJobId) filter._id = { $ne: excludeJobId };
  const ids = await Job.distinct("technicianIds", filter).session(session ?? null);
  return new Set(ids.map(String));
}

export async function pickCrew(
  preferredDay: Date,
  session?: ClientSession,
): Promise<{ crew: Installer[]; scheduledFor: Date; doubleBooked: boolean }> {
  const installers = await User.find({ role: "technician", active: true, skills: "installation" }).select("name").session(session ?? null).lean();
  const firstDay = startOfDayIST(preferredDay);
  if (installers.length === 0) return { crew: [], scheduledFor: addHours(firstDay, START_HOUR_IST), doubleBooked: false };

  const [loads, booked] = await Promise.all([
    Job.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { status: openJob(), technicianIds: { $in: installers.map((i) => i._id) } } },
      { $unwind: "$technicianIds" },
      { $group: { _id: "$technicianIds", n: { $sum: 1 } } },
    ]).session(session ?? null),
    Job.find({ status: openJob(), scheduledFor: { $gte: firstDay, $lt: addDays(firstDay, CREW_SEARCH_DAYS) } })
      .select("scheduledFor technicianIds")
      .session(session ?? null)
      .lean(),
  ]);
  const busyByDay = new Map<number, Set<string>>();
  for (const job of booked) {
    const key = startOfDayIST(job.scheduledFor).getTime();
    const busy = busyByDay.get(key) ?? new Set<string>();
    for (const id of job.technicianIds) busy.add(String(id));
    busyByDay.set(key, busy);
  }

  const { crew, day, doubleBooked } = chooseCrew(installers, {
    firstDay,
    load: new Map(loads.map((l) => [String(l._id), l.n])),
    busyOn: (dayStart) => busyByDay.get(dayStart.getTime()) ?? new Set(),
  });
  return { crew, scheduledFor: addHours(day, START_HOUR_IST), doubleBooked };
}
