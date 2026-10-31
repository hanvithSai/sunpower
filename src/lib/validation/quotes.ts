/**
 * Quote and order validation. The quote builder posts JSON (its line items
 * are dynamic); payments and simple status actions post form data.
 */
import { z } from "zod";
import { PAYMENT_MODES, PAYMENT_TYPES, SYSTEM_TYPES } from "../constants";
import { checkbox, enumOf, objectId, optionalText, requiredNumber, requiredText, rupeesAsPaise } from "./common";

export const QuoteLineInputSchema = z.object({
  productId: objectId,
  qty: z.coerce.number({ error: "Enter a quantity" }).positive("Quantity must be more than 0").max(10_000),
  unitPriceRs: z.coerce.number({ error: "Enter a price" }).min(0, "Price can't be negative").max(10_00_000),
});

export const SaveQuoteSchema = z.object({
  leadId: objectId,
  packageId: objectId.optional(),
  capacityKw: requiredNumber("System size", 1, 10),
  systemType: enumOf(SYSTEM_TYPES, "system type"),
  lines: z.array(QuoteLineInputSchema).min(1, "Add at least one item").max(60, "Too many items"),
  notes: optionalText(1000),
  send: z.boolean().default(false),
  /** The salesperson saw the missing-parts warning and is sending anyway (R-24). */
  sendWithMissing: z.boolean().default(false),
});
export type SaveQuoteInput = z.output<typeof SaveQuoteSchema>;

export const QuoteIdSchema = z.object({ quoteId: objectId });

export const MarkQuoteSentSchema = z.object({ quoteId: objectId, sendWithMissing: checkbox });

export const RejectQuoteSchema = z.object({
  quoteId: objectId,
  reason: requiredText("Reason", 300),
});

export const OrderIdSchema = z.object({ orderId: objectId });

export const CancelOrderSchema = z.object({
  orderId: objectId,
  reason: requiredText("Reason", 300),
});

const optionalId = z.preprocess((v) => (v === "" || v === null ? undefined : v), objectId.optional());

/** Payment against an order (advance/balance/full) or an invoice (e.g. a service bill). */
export const RecordPaymentSchema = z
  .object({
    orderId: optionalId,
    invoiceId: optionalId,
    ticketId: optionalId,
    amount: rupeesAsPaise("Amount", 1),
    mode: enumOf(PAYMENT_MODES, "payment mode"),
    type: enumOf(PAYMENT_TYPES, "payment type"),
    reference: optionalText(60),
    receivedOn: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date").optional(),
    ),
    notes: optionalText(300),
  })
  .refine((v) => Boolean(v.orderId || v.invoiceId), { path: ["amount"], message: "Payment must be linked to an order or invoice" });
export type RecordPaymentInput = z.output<typeof RecordPaymentSchema>;
