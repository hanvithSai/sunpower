/**
 * Inventory and dispatch validation: goods receipts (GRN) with one serial per
 * unit, serial scans at the packing bench, bulk-line ticks, dispatch and
 * delivery. The GRN form posts JSON (its lines are dynamic); the dispatch
 * bench posts small forms.
 */
import { z } from "zod";
import { SCAN_METHODS } from "../analytics";
import { objectId, optionalGstin, optionalText, requiredText } from "./common";

/** Serials are stored upper-case with no surrounding spaces (matches the SerialUnit index). */
export function normalizeSerial(value: string): string {
  return value.trim().toUpperCase();
}

/** A pasted list ("A1, A2\nA3 A4") -> ["A1", "A2", "A3", "A4"]. */
export function splitSerials(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map(normalizeSerial)
    .filter(Boolean);
}

const serial = z
  .string({ error: "Enter a serial number" })
  .trim()
  .min(3, "Serial numbers are at least 3 characters")
  .max(40, "Serial number is too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9\-/._]*$/, "Use letters, digits, - / . _ only")
  .transform(normalizeSerial);

export const GrnLineSchema = z.object({
  productId: objectId,
  qty: z.coerce.number({ error: "Enter a quantity" }).int("Whole units only").positive("Quantity must be more than 0").max(5000),
  unitCostRs: z.coerce.number({ error: "Enter the unit cost" }).min(0, "Cost can't be negative").max(10_00_000),
  serials: z.array(serial).max(5000).default([]),
});

export const ReceiveGoodsSchema = z.object({
  supplierName: requiredText("Supplier", 120),
  supplierGstin: optionalGstin,
  invoiceNo: requiredText("Supplier invoice number", 40),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the invoice date"),
  notes: optionalText(500),
  lines: z.array(GrnLineSchema).min(1, "Add at least one item").max(60, "Too many lines"),
});
export type ReceiveGoodsInput = z.output<typeof ReceiveGoodsSchema>;

export const ScanSerialSchema = z.object({
  orderId: objectId,
  serial,
  /** How the serial arrived at the bench, for scan analytics. */
  method: z.enum(SCAN_METHODS).default("manual"),
});

export const BulkPickSchema = z.object({
  orderId: objectId,
  productId: objectId,
  picked: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
});

export const DispatchOrderSchema = z.object({
  orderId: objectId,
  vehicleNo: z
    .string({ error: "Vehicle number is required" })
    .trim()
    .toUpperCase()
    .min(4, "Enter the vehicle number")
    .max(16, "Vehicle number is too long"),
  driverName: requiredText("Driver name", 80),
  driverPhone: optionalText(15),
});
export type DispatchOrderInput = z.output<typeof DispatchOrderSchema>;

export const DeliverOrderSchema = z.object({
  orderId: objectId,
  receivedBy: requiredText("Received by", 80),
  note: optionalText(300),
});
export type DeliverOrderInput = z.output<typeof DeliverOrderSchema>;

/** Admin correction of a bulk item after a count (cable cut short, connectors lost). Serial units are written off one by one instead. */
export const AdjustStockSchema = z.object({
  productId: objectId,
  delta: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce
      .number({ error: "Enter how many to add (+) or remove (−)" })
      .int("Whole units only")
      .min(-100_000, "Too large")
      .max(100_000, "Too large")
      .refine((n) => n !== 0, "Enter a change other than 0"),
  ),
  reason: requiredText("Reason", 200),
});
export type AdjustStockInput = z.output<typeof AdjustStockSchema>;

/** Take a damaged or lost unit out of stock (it becomes Faulty and leaves the ledger). */
export const WriteOffSerialSchema = z.object({
  serial: z.string({ error: "Serial is required" }).trim().min(1, "Serial is required").max(60).transform(normalizeSerial),
  reason: requiredText("Reason", 200),
});
export type WriteOffSerialInput = z.output<typeof WriteOffSerialSchema>;
