/**
 * Sub-document schemas reused across collections (addresses, priced line items).
 * Line items snapshot product data at the time of quoting so later price or
 * name changes in the catalog never rewrite historical quotes and invoices.
 */
import { Schema, type Types } from "mongoose";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS, type ProductCategory, type ProductUnit } from "@/lib/constants";

export interface IAddress {
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
}

export const AddressSchema = new Schema<IAddress>(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    state: { type: String, required: true, default: "Telangana" },
    pincode: { type: String, required: true, match: /^[1-9]\d{5}$/ },
  },
  { _id: false },
);

/** A priced product line on a quote or order (all money in paise). */
export interface ILineItem {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  qty: number;
  unitPricePaise: number;
  /** Purchase cost snapshot — drives job profitability. */
  unitCostPaise: number;
  gstRate: number;
  hsn: string;
  isSerialized: boolean;
  warrantyMonths: number;
}

export const LineItemSchema = new Schema<ILineItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, enum: PRODUCT_CATEGORIES, required: true },
    unit: { type: String, enum: PRODUCT_UNITS, required: true },
    qty: { type: Number, required: true, min: 0 },
    unitPricePaise: { type: Number, required: true, min: 0 },
    unitCostPaise: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true, min: 0, max: 28 },
    hsn: { type: String, required: true },
    isSerialized: { type: Boolean, required: true },
    warrantyMonths: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/** Who did something — denormalised name so timelines render without joins. */
export interface IActorRef {
  id: Types.ObjectId;
  name: string;
}

export const ActorRefSchema = new Schema<IActorRef>(
  {
    id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);
