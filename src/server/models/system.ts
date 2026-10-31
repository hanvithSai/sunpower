/**
 * System collections: atomic number counters and the activity (audit) log
 * that powers every record's timeline.
 */
import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ICounter {
  /** Counter key, e.g. "SP-L" or "INV/26-27" */
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter: Model<ICounter> =
  (models.Counter as Model<ICounter>) ?? model<ICounter>("Counter", CounterSchema);

export const ACTIVITY_ENTITIES = [
  "customer",
  "lead",
  "survey",
  "quote",
  "order",
  "payment",
  "job",
  "ticket",
  "invoice",
  "purchase",
  "serial",
  "product",
  "share",
] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export interface IActivity {
  _id: Types.ObjectId;
  entityType: ActivityEntity;
  entityId: Types.ObjectId;
  /** Lets a customer page show everything that happened across records. */
  customerId?: Types.ObjectId;
  /** Machine-readable verb, e.g. "status_changed", "payment_recorded". */
  action: string;
  /** Human sentence shown in timelines. */
  message: string;
  actorId?: Types.ObjectId;
  actorName?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    entityType: { type: String, enum: ACTIVITY_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    action: { type: String, required: true },
    message: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ActivitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const Activity: Model<IActivity> =
  (models.Activity as Model<IActivity>) ?? model<IActivity>("Activity", ActivitySchema);
