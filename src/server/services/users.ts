/**
 * Staff directory: options for assignment pickers (salesperson, survey
 * technician, installation crew).
 */
import type { Role } from "@/lib/constants";
import { connectDB } from "../db";
import { User } from "../models";

export type StaffOption = { id: string; name: string; role: Role; skills: string[] };

export async function listStaff(filter: { roles?: Role[]; skill?: string } = {}): Promise<StaffOption[]> {
  await connectDB();
  const query: Record<string, unknown> = { active: true };
  if (filter.roles?.length) query.role = { $in: filter.roles };
  if (filter.skill) query.skills = filter.skill;
  const users = await User.find(query).sort({ name: 1 }).select("name role skills").lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, role: u.role, skills: u.skills ?? [] }));
}
