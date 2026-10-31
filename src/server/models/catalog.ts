/**
 * Catalog: products (with cost, price, GST, HSN, warranty) and ready-made
 * packages (1–5 kW On-Grid / Off-Grid). A package is a bill-of-materials
 * template — choosing "3 kW On-Grid" expands into every part automatically,
 * so no one has to remember the small items.
 */
import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  SYSTEM_TYPES,
  type ProductCategory,
  type ProductUnit,
  type SystemType,
} from "@/lib/constants";

export interface IProduct {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  unit: ProductUnit;
  /** Serialized items (panels, inverters, batteries, charge controllers) are scanned at dispatch. */
  isSerialized: boolean;
  /** Free-form specs, e.g. { watt: 545, technology: "Mono PERC" }. */
  specs: Record<string, string | number>;
  costPaise: number;
  pricePaise: number;
  gstRate: number;
  /** HSN (goods) or SAC (services) code printed on invoices. */
  hsn: string;
  warrantyMonths: number;
  /** Units on hand. For serialized products this equals the count of in_stock serial units. */
  stockQty: number;
  reorderLevel: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: { type: String, enum: PRODUCT_CATEGORIES, required: true, index: true },
    unit: { type: String, enum: PRODUCT_UNITS, required: true },
    isSerialized: { type: Boolean, required: true },
    specs: { type: Schema.Types.Mixed, default: {} },
    costPaise: { type: Number, required: true, min: 0 },
    pricePaise: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true, min: 0, max: 28 },
    hsn: { type: String, required: true },
    warrantyMonths: { type: Number, default: 0, min: 0 },
    stockQty: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, minimize: false },
);

export const Product: Model<IProduct> =
  (models.Product as Model<IProduct>) ?? model<IProduct>("Product", ProductSchema);

export interface IPackageLine {
  productId: Types.ObjectId;
  qty: number;
}

export interface IPackage {
  _id: Types.ObjectId;
  /** e.g. ONG-3 (3 kW On-Grid), OFG-5 (5 kW Off-Grid) */
  code: string;
  name: string;
  systemType: SystemType;
  capacityKw: number;
  description: string;
  lines: IPackageLine[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PackageSchema = new Schema<IPackage>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    systemType: { type: String, enum: SYSTEM_TYPES, required: true },
    capacityKw: { type: Number, required: true, min: 1, max: 10 },
    description: { type: String, default: "" },
    lines: {
      type: [
        new Schema<IPackageLine>(
          {
            productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
            qty: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
PackageSchema.index({ systemType: 1, capacityKw: 1 });

export const Package: Model<IPackage> =
  (models.Package as Model<IPackage>) ?? model<IPackage>("Package", PackageSchema);
