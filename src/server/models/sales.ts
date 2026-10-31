/**
 * Sales: quotes, orders (the post-sale "project") and payments.
 *
 * An Order is the operational record for one installation: it carries the
 * pick list the warehouse scans against, dispatch details, the PM Surya Ghar
 * subsidy tracker, extra site costs and links to the installation job and
 * the tax invoice. Its status follows ORDER_FLOW in src/lib/workflows.
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  ORDER_STATUSES,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  QUOTE_STATUSES,
  SUBSIDY_STATUSES,
  SYSTEM_TYPES,
  type OrderStatus,
  type PaymentMode,
  type PaymentStatus,
  type PaymentType,
  type QuoteStatus,
  type SubsidyStatus,
  type SystemType,
} from "@/lib/constants";
import { ActorRefSchema, AddressSchema, LineItemSchema, type IActorRef, type IAddress, type ILineItem } from "./shared";

/* --------------------------------- Quote -------------------------------- */

export interface IQuote {
  _id: Types.ObjectId;
  number: string;
  /** Re-quoting the same lead bumps the version. */
  version: number;
  leadId: Types.ObjectId;
  customerId: Types.ObjectId;
  packageId?: Types.ObjectId;
  packageCode?: string;
  title: string;
  systemType: SystemType;
  capacityKw: number;
  lines: ILineItem[];
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
  /** Estimated PM Surya Ghar subsidy credited to the customer later. */
  subsidyPaise: number;
  /** totalPaise - subsidyPaise: what the customer effectively pays. */
  netCostPaise: number;
  status: QuoteStatus;
  validUntil: Date;
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedReason?: string;
  notes?: string;
  createdBy: IActorRef;
  createdAt: Date;
  updatedAt: Date;
}

const QuoteSchema = new Schema<IQuote>(
  {
    number: { type: String, required: true, unique: true },
    version: { type: Number, default: 1 },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    packageId: { type: Schema.Types.ObjectId, ref: "Package" },
    packageCode: { type: String },
    title: { type: String, required: true },
    systemType: { type: String, enum: SYSTEM_TYPES, required: true },
    capacityKw: { type: Number, required: true, min: 1, max: 10 },
    lines: { type: [LineItemSchema], default: [] },
    taxablePaise: { type: Number, required: true, min: 0 },
    gstPaise: { type: Number, required: true, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    subsidyPaise: { type: Number, default: 0, min: 0 },
    netCostPaise: { type: Number, required: true },
    status: { type: String, enum: QUOTE_STATUSES, default: "draft", index: true },
    validUntil: { type: Date, required: true },
    sentAt: { type: Date },
    acceptedAt: { type: Date },
    rejectedReason: { type: String },
    notes: { type: String },
    createdBy: { type: ActorRefSchema, required: true },
  },
  { timestamps: true },
);

export const Quote: Model<IQuote> = (models.Quote as Model<IQuote>) ?? model<IQuote>("Quote", QuoteSchema);

/* --------------------------------- Order -------------------------------- */

export interface IPickLine {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  qty: number;
  isSerialized: boolean;
  /** Scanned serial numbers (serialized items must have exactly `qty`). */
  serials: string[];
  /** Non-serialized items are ticked as picked. */
  picked: boolean;
}

export interface IDispatchInfo {
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  dispatchedAt?: Date;
  dispatchedBy?: IActorRef;
  deliveredAt?: Date;
  deliveredBy?: IActorRef;
  deliveryNote?: string;
}

export interface ISubsidyUpdate {
  status: SubsidyStatus;
  at: Date;
  note?: string;
  by?: string;
}

export interface ISubsidyInfo {
  applicable: boolean;
  status: SubsidyStatus;
  /** National portal (pmsuryaghar.gov.in) application number. */
  applicationNo?: string;
  expectedPaise: number;
  disbursedPaise: number;
  history: ISubsidyUpdate[];
}

export interface IExtraCost {
  label: string;
  amountPaise: number;
  at: Date;
}

export interface IOrder {
  _id: Types.ObjectId;
  number: string;
  quoteId: Types.ObjectId;
  leadId: Types.ObjectId;
  customerId: Types.ObjectId;
  title: string;
  systemType: SystemType;
  capacityKw: number;
  siteAddress: IAddress;
  lines: ILineItem[];
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  pickList: IPickLine[];
  dispatch: IDispatchInfo;
  installationJobId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  subsidy: ISubsidyInfo;
  extraCosts: IExtraCost[];
  salesUser: IActorRef;
  confirmedAt?: Date;
  commissionedAt?: Date;
  closedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickLineSchema = new Schema<IPickLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 0 },
    isSerialized: { type: Boolean, required: true },
    serials: { type: [String], default: [] },
    picked: { type: Boolean, default: false },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    number: { type: String, required: true, unique: true },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote", required: true, unique: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    title: { type: String, required: true },
    systemType: { type: String, enum: SYSTEM_TYPES, required: true },
    capacityKw: { type: Number, required: true },
    siteAddress: { type: AddressSchema, required: true },
    lines: { type: [LineItemSchema], default: [] },
    taxablePaise: { type: Number, required: true, min: 0 },
    gstPaise: { type: Number, required: true, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    paidPaise: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
    pickList: { type: [PickLineSchema], default: [] },
    dispatch: {
      type: new Schema<IDispatchInfo>(
        {
          vehicleNo: String,
          driverName: String,
          driverPhone: String,
          dispatchedAt: Date,
          dispatchedBy: ActorRefSchema,
          deliveredAt: Date,
          deliveredBy: ActorRefSchema,
          deliveryNote: String,
        },
        { _id: false },
      ),
      default: {},
    },
    installationJobId: { type: Schema.Types.ObjectId, ref: "Job" },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    subsidy: {
      type: new Schema<ISubsidyInfo>(
        {
          applicable: { type: Boolean, required: true },
          status: { type: String, enum: SUBSIDY_STATUSES, required: true },
          applicationNo: String,
          expectedPaise: { type: Number, default: 0 },
          disbursedPaise: { type: Number, default: 0 },
          history: {
            type: [
              new Schema<ISubsidyUpdate>(
                {
                  status: { type: String, enum: SUBSIDY_STATUSES, required: true },
                  at: { type: Date, required: true },
                  note: String,
                  by: String,
                },
                { _id: false },
              ),
            ],
            default: [],
          },
        },
        { _id: false },
      ),
      required: true,
    },
    extraCosts: {
      type: [
        new Schema<IExtraCost>(
          {
            label: { type: String, required: true },
            amountPaise: { type: Number, required: true, min: 0 },
            at: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    salesUser: { type: ActorRefSchema, required: true },
    confirmedAt: Date,
    commissionedAt: Date,
    closedAt: Date,
    notes: String,
  },
  { timestamps: true },
);
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ "subsidy.status": 1 });

export const Order: Model<IOrder> = (models.Order as Model<IOrder>) ?? model<IOrder>("Order", OrderSchema);

/* -------------------------------- Payment ------------------------------- */

export interface IPayment {
  _id: Types.ObjectId;
  number: string;
  customerId: Types.ObjectId;
  orderId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  ticketId?: Types.ObjectId;
  amountPaise: number;
  mode: PaymentMode;
  type: PaymentType;
  /** UPI ref / UTR / cheque number */
  reference?: string;
  receivedAt: Date;
  recordedBy: IActorRef;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    number: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", index: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket" },
    amountPaise: { type: Number, required: true, min: 1 },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    type: { type: String, enum: PAYMENT_TYPES, required: true },
    reference: { type: String, trim: true },
    receivedAt: { type: Date, required: true, index: true },
    recordedBy: { type: ActorRefSchema, required: true },
    notes: String,
  },
  { timestamps: true },
);

export const Payment: Model<IPayment> =
  (models.Payment as Model<IPayment>) ?? model<IPayment>("Payment", PaymentSchema);
