/**
 * Audit trail. Every meaningful change writes one Activity so each record
 * (and each customer) has a readable timeline: who did what, and when.
 */
import type { ClientSession, Types } from "mongoose";
import { connectDB } from "../../db";
import { Activity, type ActivityEntity } from "../../models/system";
import { toObjectId, type Actor } from "../../lib/actor";

export type ActivityInput = {
  entityType: ActivityEntity;
  entityId: string | Types.ObjectId;
  action: string;
  message: string;
  actor?: Actor | null;
  customerId?: string | Types.ObjectId;
  meta?: Record<string, unknown>;
  /** Override the timestamp (seed data). */
  at?: Date;
};

export async function logActivity(input: ActivityInput, session?: ClientSession): Promise<void> {
  await Activity.create(
    [
      {
        entityType: input.entityType,
        entityId: toObjectId(input.entityId),
        customerId: input.customerId ? toObjectId(input.customerId) : undefined,
        action: input.action,
        message: input.message,
        actorId: input.actor ? toObjectId(input.actor.id) : undefined,
        actorName: input.actor?.name,
        meta: input.meta,
        ...(input.at ? { createdAt: input.at } : {}),
      },
    ],
    { session },
  );
}

export type TimelineEntry = { id: string; title: string; at: Date; actor?: string; action: string };

export async function listActivity(
  entityType: ActivityEntity,
  entityId: string | Types.ObjectId,
  limit = 50,
): Promise<TimelineEntry[]> {
  await connectDB();
  const rows = await Activity.find({ entityType, entityId: toObjectId(entityId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({ id: String(r._id), title: r.message, at: r.createdAt, actor: r.actorName, action: r.action }));
}

export async function listCustomerActivity(customerId: string | Types.ObjectId, limit = 100): Promise<TimelineEntry[]> {
  await connectDB();
  const rows = await Activity.find({ customerId: toObjectId(customerId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({ id: String(r._id), title: r.message, at: r.createdAt, actor: r.actorName, action: r.action }));
}
