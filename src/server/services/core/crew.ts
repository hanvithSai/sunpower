/**
 * Crew booking (BR-07). An installation needs three installers who have no
 * other job that day. Starting from the preferred date we look day by day
 * (skipping Sundays) for the first day with enough free installers, and take
 * the least-loaded of them so work spreads across all 15 technicians.
 * If nobody is free for two weeks we fall back to the least-loaded crew on
 * the preferred day, and the double booking shows on the crew calendar.
 */
import type { ClientSession, Types } from "mongoose";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { Job, User } from "../../models";

export const CREW_SIZE = 3;
const SEARCH_DAYS = 14;
/** Crews leave at 09:30 IST. */
const START_HOUR_IST = 9.5;

export type Installer = { _id: Types.ObjectId; name: string };

function isSundayIST(dayStart: Date): boolean {
  // IST midnight is 18:30 UTC the day before; +12 h is 06:30 UTC on the same calendar day as IST.
  return new Date(dayStart.getTime() + 12 * 3_600_000).getUTCDay() === 0;
}

/** Technician ids already booked on a job on the IST day starting at `dayStart`. */
export async function busyTechnicianIds(dayStart: Date, session?: ClientSession, excludeJobId?: Types.ObjectId): Promise<Set<string>> {
  const filter: Record<string, unknown> = {
    status: { $in: ["scheduled", "in_progress"] },
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

  const loads = await Job.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { status: { $in: ["scheduled", "in_progress"] }, technicianIds: { $in: installers.map((i) => i._id) } } },
    { $unwind: "$technicianIds" },
    { $group: { _id: "$technicianIds", n: { $sum: 1 } } },
  ]).session(session ?? null);
  const load = new Map(loads.map((l) => [String(l._id), l.n]));
  const byLoad = [...installers].sort((a, b) => (load.get(String(a._id)) ?? 0) - (load.get(String(b._id)) ?? 0) || a.name.localeCompare(b.name));
  const size = Math.min(CREW_SIZE, installers.length);

  for (let d = 0; d < SEARCH_DAYS; d++) {
    const day = addDays(firstDay, d);
    if (isSundayIST(day)) continue;
    const busy = await busyTechnicianIds(day, session);
    const free = byLoad.filter((i) => !busy.has(String(i._id)));
    if (free.length >= size) return { crew: free.slice(0, size), scheduledFor: addHours(day, START_HOUR_IST), doubleBooked: false };
  }
  return { crew: byLoad.slice(0, size), scheduledFor: addHours(firstDay, START_HOUR_IST), doubleBooked: true };
}
