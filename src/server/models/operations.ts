/**
 * Field jobs: installations and service visits on the crew schedule.
 *
 * The technician's phone form fills `startedAt`/`finishedAt`, the confirmed
 * system size, the checklist, photos (GridFS ids) and the customer's on-screen
 * signature — the proof-of-work the brief asks for. `timeLogs` × each
 * technician's hourly rate is the labour cost used in job profitability.
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import { JOB_STATUSES, JOB_TYPES, type JobStatus, type JobType } from "@/lib/constants";
import { AddressSchema, type IAddress } from "./shared";

export interface ITimeLog {
  technicianId: Types.ObjectId;
  technicianName: string;
  hours: number;
  date: Date;
  note?: string;
}

export interface IJobChecklist {
  mounting: boolean;
  panels: boolean;
  wiring: boolean;
  earthing: boolean;
  inverter: boolean;
  testing: boolean;
}

export interface ISignature {
  /** PNG data URL captured on the tablet. */
  dataUrl: string;
  signedBy: string;
  signedAt: Date;
}

export interface IJob {
  _id: Types.ObjectId;
  number: string;
  type: JobType;
  orderId?: Types.ObjectId;
  ticketId?: Types.ObjectId;
  customerId: Types.ObjectId;
  title: string;
  siteAddress: IAddress;
  scheduledFor: Date;
  estimatedHours: number;
  technicianIds: Types.ObjectId[];
  leadTechnicianId?: Types.ObjectId;
  status: JobStatus;
  startedAt?: Date;
  finishedAt?: Date;
  confirmedKw?: number;
  /** Required when the installed size differs from the order. */
  kwChangeReason?: string;
  generationReadingKw?: number;
  checklist: IJobChecklist;
  /** Did everything on the pick list arrive at site? */
  kitCheck?: { complete: boolean; missing?: string };
  photos: string[];
  signature?: ISignature;
  customerRemarks?: string;
  notes?: string;
  timeLogs: ITimeLog[];
  /** Material used beyond the pick list; also posted to stock and to the order's extra costs. */
  materialsUsed: IMaterialUsed[];
  completedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMaterialUsed {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  costPaise: number;
}

const JobSchema = new Schema<IJob>(
  {
    number: { type: String, required: true, unique: true },
    type: { type: String, enum: JOB_TYPES, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    title: { type: String, required: true },
    siteAddress: { type: AddressSchema, required: true },
    scheduledFor: { type: Date, required: true, index: true },
    estimatedHours: { type: Number, default: 6, min: 0 },
    technicianIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [], index: true },
    leadTechnicianId: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: JOB_STATUSES, default: "scheduled", index: true },
    startedAt: Date,
    finishedAt: Date,
    confirmedKw: { type: Number, min: 0 },
    kwChangeReason: String,
    generationReadingKw: { type: Number, min: 0 },
    kitCheck: {
      type: new Schema<{ complete: boolean; missing?: string }>({ complete: { type: Boolean, required: true }, missing: String }, { _id: false }),
      required: false,
    },
    materialsUsed: {
      type: [
        new Schema<IMaterialUsed>(
          {
            productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
            sku: { type: String, required: true },
            name: { type: String, required: true },
            unit: { type: String, required: true },
            qty: { type: Number, required: true, min: 0 },
            costPaise: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    checklist: {
      mounting: { type: Boolean, default: false },
      panels: { type: Boolean, default: false },
      wiring: { type: Boolean, default: false },
      earthing: { type: Boolean, default: false },
      inverter: { type: Boolean, default: false },
      testing: { type: Boolean, default: false },
    },
    photos: { type: [String], default: [] },
    signature: {
      type: new Schema<ISignature>(
        {
          dataUrl: { type: String, required: true },
          signedBy: { type: String, required: true },
          signedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    customerRemarks: String,
    notes: String,
    timeLogs: {
      type: [
        new Schema<ITimeLog>(
          {
            technicianId: { type: Schema.Types.ObjectId, ref: "User", required: true },
            technicianName: { type: String, required: true },
            hours: { type: Number, required: true, min: 0, max: 24 },
            date: { type: Date, required: true },
            note: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Job: Model<IJob> = (models.Job as Model<IJob>) ?? model<IJob>("Job", JobSchema);
