/**
 * Finance: GST tax invoices and expiring read-only share links for the
 * director's dashboard ("share these numbers when needed").
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import { INVOICE_STATUSES, INVOICE_TYPES, type InvoiceStatus, type InvoiceType } from "@/lib/constants";
import { ActorRefSchema, type IActorRef } from "./shared";

export interface IInvoiceLine {
  description: string;
  hsn: string;
  qty: number;
  unitPricePaise: number;
  gstRate: number;
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
}

export interface IInvoice {
  _id: Types.ObjectId;
  /** GST invoice number per financial year, e.g. INV/26-27/0042 */
  number: string;
  type: InvoiceType;
  customerId: Types.ObjectId;
  orderId?: Types.ObjectId;
  ticketId?: Types.ObjectId;
  billTo: { name: string; phone: string; address: string; gstin?: string };
  lines: IInvoiceLine[];
  taxablePaise: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  paidPaise: number;
  status: InvoiceStatus;
  issuedAt: Date;
  dueAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    number: { type: String, required: true, unique: true },
    type: { type: String, enum: INVOICE_TYPES, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", index: true },
    billTo: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      gstin: String,
    },
    lines: {
      type: [
        new Schema<IInvoiceLine>(
          {
            description: { type: String, required: true },
            hsn: { type: String, required: true },
            qty: { type: Number, required: true, min: 0 },
            unitPricePaise: { type: Number, required: true, min: 0 },
            gstRate: { type: Number, required: true },
            taxablePaise: { type: Number, required: true },
            gstPaise: { type: Number, required: true },
            totalPaise: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    taxablePaise: { type: Number, required: true },
    gstPaise: { type: Number, required: true },
    cgstPaise: { type: Number, required: true },
    sgstPaise: { type: Number, required: true },
    igstPaise: { type: Number, required: true },
    totalPaise: { type: Number, required: true },
    paidPaise: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: "issued", index: true },
    issuedAt: { type: Date, required: true, index: true },
    dueAt: { type: Date, required: true },
    notes: String,
  },
  { timestamps: true },
);

export const Invoice: Model<IInvoice> =
  (models.Invoice as Model<IInvoice>) ?? model<IInvoice>("Invoice", InvoiceSchema);

export interface IShareLink {
  _id: Types.ObjectId;
  /** Random URL-safe token used in /share/[token]. */
  token: string;
  /** dashboard = the director's numbers; certificate = one installation's certificate for its customer. */
  scope: "dashboard" | "certificate";
  jobId?: Types.ObjectId;
  label?: string;
  createdBy: IActorRef;
  expiresAt: Date;
  revokedAt?: Date;
  viewCount: number;
  lastViewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>(
  {
    token: { type: String, required: true, unique: true },
    scope: { type: String, enum: ["dashboard", "certificate"], default: "dashboard" },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", index: true },
    label: String,
    createdBy: { type: ActorRefSchema, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    viewCount: { type: Number, default: 0 },
    lastViewedAt: Date,
  },
  { timestamps: true },
);

export const ShareLink: Model<IShareLink> =
  (models.ShareLink as Model<IShareLink>) ?? model<IShareLink>("ShareLink", ShareLinkSchema);
