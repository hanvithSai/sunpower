/**
 * Inventory: serial-number register, stock ledger and goods receipts (GRN).
 *
 * Each high-value unit (panel, inverter, battery, charge controller) is a
 * SerialUnit with its own lifecycle and warranty dates, which is how support
 * answers "which unit went to which customer, and is it still covered?".
 * StockMove is the append-only audit ledger behind every quantity change.
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  PRODUCT_CATEGORIES,
  SERIAL_STATUSES,
  STOCK_MOVE_TYPES,
  type ProductCategory,
  type SerialStatus,
  type StockMoveType,
} from "@/lib/constants";
import { ActorRefSchema, type IActorRef } from "./shared";

/* ------------------------------ SerialUnit ------------------------------ */

export interface ISerialEvent {
  status: SerialStatus;
  at: Date;
  note?: string;
  by?: string;
}

export interface ISerialUnit {
  _id: Types.ObjectId;
  serial: string;
  productId: Types.ObjectId;
  sku: string;
  productName: string;
  category: ProductCategory;
  status: SerialStatus;
  purchaseId?: Types.ObjectId;
  costPaise: number;
  orderId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  allocatedAt?: Date;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  /** Starts automatically on delivery. */
  warrantyStartAt?: Date;
  warrantyEndAt?: Date;
  warrantyMonths: number;
  replacedBySerial?: string;
  replacesSerial?: string;
  history: ISerialEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const SerialUnitSchema = new Schema<ISerialUnit>(
  {
    serial: { type: String, required: true, unique: true, uppercase: true, trim: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    category: { type: String, enum: PRODUCT_CATEGORIES, required: true },
    status: { type: String, enum: SERIAL_STATUSES, default: "in_stock", index: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: "Purchase" },
    costPaise: { type: Number, required: true, min: 0 },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    allocatedAt: Date,
    dispatchedAt: Date,
    deliveredAt: Date,
    warrantyStartAt: Date,
    warrantyEndAt: { type: Date, index: true },
    warrantyMonths: { type: Number, required: true, min: 0 },
    replacedBySerial: String,
    replacesSerial: String,
    history: {
      type: [
        new Schema<ISerialEvent>(
          {
            status: { type: String, enum: SERIAL_STATUSES, required: true },
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
  { timestamps: true },
);
SerialUnitSchema.index({ productId: 1, status: 1 });

export const SerialUnit: Model<ISerialUnit> =
  (models.SerialUnit as Model<ISerialUnit>) ?? model<ISerialUnit>("SerialUnit", SerialUnitSchema);

/* ------------------------------- StockMove ------------------------------ */

export interface IStockMove {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  sku: string;
  /** Signed quantity: +in / -out */
  qty: number;
  type: StockMoveType;
  serials: string[];
  refType?: "purchase" | "order" | "ticket" | "manual";
  refId?: Types.ObjectId;
  refNumber?: string;
  note?: string;
  by?: IActorRef;
  at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StockMoveSchema = new Schema<IStockMove>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true },
    type: { type: String, enum: STOCK_MOVE_TYPES, required: true },
    serials: { type: [String], default: [] },
    refType: { type: String, enum: ["purchase", "order", "ticket", "manual"] },
    refId: { type: Schema.Types.ObjectId },
    refNumber: String,
    note: String,
    by: ActorRefSchema,
    at: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

export const StockMove: Model<IStockMove> =
  (models.StockMove as Model<IStockMove>) ?? model<IStockMove>("StockMove", StockMoveSchema);

/* ------------------------------- Purchase ------------------------------- */

export interface IPurchaseLine {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  qty: number;
  unitCostPaise: number;
  serials: string[];
}

export interface IPurchase {
  _id: Types.ObjectId;
  /** Goods receipt number, e.g. SP-GRN-0007 */
  number: string;
  supplier: { name: string; gstin?: string; phone?: string };
  invoiceNo: string;
  invoiceDate: Date;
  lines: IPurchaseLine[];
  totalPaise: number;
  receivedAt: Date;
  receivedBy: IActorRef;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    number: { type: String, required: true, unique: true },
    supplier: {
      name: { type: String, required: true },
      gstin: String,
      phone: String,
    },
    invoiceNo: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
    lines: {
      type: [
        new Schema<IPurchaseLine>(
          {
            productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
            sku: { type: String, required: true },
            name: { type: String, required: true },
            qty: { type: Number, required: true, min: 1 },
            unitCostPaise: { type: Number, required: true, min: 0 },
            serials: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    totalPaise: { type: Number, required: true, min: 0 },
    receivedAt: { type: Date, required: true, index: true },
    receivedBy: { type: ActorRefSchema, required: true },
    notes: String,
  },
  { timestamps: true },
);

export const Purchase: Model<IPurchase> =
  (models.Purchase as Model<IPurchase>) ?? model<IPurchase>("Purchase", PurchaseSchema);
