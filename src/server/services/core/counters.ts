/**
 * Human-readable document numbers (SP-L-0042, SP-O-0107, INV/26-27/0031)
 * generated from atomic counters so two users can never get the same number.
 */
import type { ClientSession } from "mongoose";
import { financialYear } from "@/lib/dates";
import { Counter } from "../../models/system";

export const NUMBER_PREFIX = {
  lead: "SP-L",
  survey: "SP-SV",
  quote: "SP-Q",
  order: "SP-O",
  payment: "SP-PAY",
  job: "SP-J",
  ticket: "SP-T",
  purchase: "SP-GRN",
} as const;
export type NumberKind = keyof typeof NUMBER_PREFIX;

export async function nextSequence(key: string, session?: ClientSession): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  ).lean();
  return doc!.seq;
}

export async function nextNumber(kind: NumberKind, session?: ClientSession): Promise<string> {
  const prefix = NUMBER_PREFIX[kind];
  const seq = await nextSequence(prefix, session);
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

/** GST invoices restart numbering every Indian financial year (April–March). */
export async function nextInvoiceNumber(issuedAt: Date, session?: ClientSession): Promise<string> {
  const fy = financialYear(issuedAt);
  const seq = await nextSequence(`INV/${fy}`, session);
  return `INV/${fy}/${String(seq).padStart(4, "0")}`;
}
