/**
 * After-sales service tickets.
 *
 * Warranty status is captured at creation from the serial unit's warranty
 * dates. In-warranty work costs the customer nothing; out-of-warranty parts and
 * labour are invoiced automatically on resolution. A ticket only closes when the
 * customer confirms everything works (TICKET_FLOW in src/lib/workflows).
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  CONFIRMATION_CHANNELS,
  RESOLUTION_TYPES,
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  WARRANTY_BASES,
  WARRANTY_STATES,
  type ConfirmationChannel,
  type ResolutionType,
  type TicketCategory,
  type TicketChannel,
  type TicketPriority,
  type TicketStatus,
  type WarrantyBasis,
  type WarrantyState,
} from "@/lib/constants";
import { ActorRefSchema, type IActorRef } from "./shared";

export interface ITicketPart {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  qty: number;
  unitPricePaise: number;
  unitCostPaise: number;
  gstRate: number;
  hsn: string;
}

export interface ITicketResolution {
  type: ResolutionType;
  notes: string;
  partsUsed: ITicketPart[];
  labourHours: number;
  labourRatePaise: number;
  replacementSerial?: string;
  resolvedAt: Date;
  resolvedBy: IActorRef;
}

export interface ITicket {
  _id: Types.ObjectId;
  number: string;
  customerId: Types.ObjectId;
  orderId?: Types.ObjectId;
  serial?: string;
  serialUnitId?: Types.ObjectId;
  productName?: string;
  category: TicketCategory;
  faultCode?: string;
  description: string;
  priority: TicketPriority;
  channel: TicketChannel;
  status: TicketStatus;
  /** Decided at creation from the serial, or from the workmanship warranty when there is no serial. */
  warranty: { state: WarrantyState; basis: WarrantyBasis; endsAt?: Date; checkedAt: Date };
  /** True when out of warranty — parts + labour are invoiced on resolution. */
  billable: boolean;
  /** Support/admin changed billability (e.g. physical damage) — always with a reason. */
  billingOverride?: { billable: boolean; reason: string; by: IActorRef; at: Date };
  assignedTo?: IActorRef;
  jobId?: Types.ObjectId;
  resolution?: ITicketResolution;
  customerConfirmedAt?: Date;
  confirmation?: { confirmedBy: string; channel: ConfirmationChannel; note?: string; recordedBy: IActorRef; at: Date };
  /** In-warranty repairs: parts at cost + labour, charged to the original order's profit. */
  serviceCostPaise: number;
  reopenCount: number;
  invoiceId?: Types.ObjectId;
  slaDueAt: Date;
  closedAt?: Date;
  createdBy: IActorRef;
  createdAt: Date;
  updatedAt: Date;
}

const TicketPartSchema = new Schema<ITicketPart>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true, min: 0 },
    unitCostPaise: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true },
    hsn: { type: String, required: true },
  },
  { _id: false },
);

const TicketSchema = new Schema<ITicket>(
  {
    number: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    serial: { type: String, uppercase: true, trim: true, index: true },
    serialUnitId: { type: Schema.Types.ObjectId, ref: "SerialUnit" },
    productName: String,
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    faultCode: { type: String, trim: true },
    description: { type: String, required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "medium" },
    channel: { type: String, enum: TICKET_CHANNELS, default: "phone" },
    status: { type: String, enum: TICKET_STATUSES, default: "open", index: true },
    warranty: {
      state: { type: String, enum: WARRANTY_STATES, required: true },
      basis: { type: String, enum: WARRANTY_BASES, default: "serial" },
      endsAt: Date,
      checkedAt: { type: Date, required: true },
    },
    billable: { type: Boolean, required: true },
    billingOverride: {
      type: new Schema(
        {
          billable: { type: Boolean, required: true },
          reason: { type: String, required: true },
          by: { type: ActorRefSchema, required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    assignedTo: ActorRefSchema,
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    resolution: {
      type: new Schema<ITicketResolution>(
        {
          type: { type: String, enum: RESOLUTION_TYPES, required: true },
          notes: { type: String, required: true },
          partsUsed: { type: [TicketPartSchema], default: [] },
          labourHours: { type: Number, default: 0, min: 0 },
          labourRatePaise: { type: Number, default: 0, min: 0 },
          replacementSerial: String,
          resolvedAt: { type: Date, required: true },
          resolvedBy: { type: ActorRefSchema, required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    customerConfirmedAt: Date,
    confirmation: {
      type: new Schema(
        {
          confirmedBy: { type: String, required: true },
          channel: { type: String, enum: CONFIRMATION_CHANNELS, required: true },
          note: String,
          recordedBy: { type: ActorRefSchema, required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    serviceCostPaise: { type: Number, default: 0, min: 0 },
    reopenCount: { type: Number, default: 0 },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    slaDueAt: { type: Date, required: true },
    closedAt: Date,
    createdBy: { type: ActorRefSchema, required: true },
  },
  { timestamps: true },
);
TicketSchema.index({ status: 1, createdAt: -1 });

export const Ticket: Model<ITicket> = (models.Ticket as Model<ITicket>) ?? model<ITicket>("Ticket", TicketSchema);
