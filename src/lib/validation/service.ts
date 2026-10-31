/**
 * Service desk validation: raising a ticket (from a serial or a customer),
 * booking the visit, overriding billability with a reason, resolving with
 * parts / labour / a replacement unit, and recording the customer's
 * confirmation before the ticket can close (BR-04 to BR-06, BR-15).
 */
import { z } from "zod";
import { CONFIRMATION_CHANNELS, RESOLUTION_TYPES, TICKET_CATEGORIES, TICKET_CHANNELS, TICKET_PRIORITIES } from "../constants";
import { enumOf, objectId, optionalText, requiredNumber, requiredText } from "./common";
import { normalizeSerial } from "./inventory";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const optionalId = z.preprocess(emptyToUndefined, objectId.optional());
const optionalSerial = z.preprocess(emptyToUndefined, z.string().trim().min(3).max(40).transform(normalizeSerial).optional());

export const CreateTicketSchema = z
  .object({
    serial: optionalSerial,
    customerId: optionalId,
    category: enumOf(TICKET_CATEGORIES, "category"),
    faultCode: optionalText(40),
    description: requiredText("What's wrong", 1000),
    priority: enumOf(TICKET_PRIORITIES, "priority"),
    channel: enumOf(TICKET_CHANNELS, "channel"),
  })
  .refine((v) => Boolean(v.serial || v.customerId), { path: ["serial"], message: "Find the customer or the serial number first" });
export type CreateTicketInput = z.output<typeof CreateTicketSchema>;

export const TicketIdSchema = z.object({ ticketId: objectId });

export const AssignTicketSchema = z.object({
  ticketId: objectId,
  technicianId: objectId,
  visitAt: z.string({ error: "Pick the visit time" }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick the visit time"),
});
export type AssignTicketInput = z.output<typeof AssignTicketSchema>;

export const BillingOverrideSchema = z.object({
  ticketId: objectId,
  billable: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
  reason: requiredText("Reason", 300),
});
export type BillingOverrideInput = z.output<typeof BillingOverrideSchema>;

/** A part fitted on the visit (bulk stock item), posted as JSON. */
export const TicketPartInputSchema = z.object({
  productId: objectId,
  qty: z.coerce.number({ error: "Enter a quantity" }).int("Whole units only").positive("Quantity must be more than 0").max(100),
});

const partsField = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return [];
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}, z.array(TicketPartInputSchema).max(10, "Up to 10 parts"));

export const ResolveTicketSchema = z
  .object({
    ticketId: objectId,
    type: enumOf(RESOLUTION_TYPES, "resolution"),
    notes: requiredText("What was done", 1000),
    labourHours: requiredNumber("Labour hours", 0, 24),
    parts: partsField,
    replacementSerial: optionalSerial,
  })
  .refine((v) => v.type !== "replacement" || Boolean(v.replacementSerial), {
    path: ["replacementSerial"],
    message: "Scan or type the serial of the replacement unit",
  });
export type ResolveTicketInput = z.output<typeof ResolveTicketSchema>;

export const ConfirmTicketSchema = z.object({
  ticketId: objectId,
  confirmedBy: requiredText("Who confirmed", 80),
  channel: enumOf(CONFIRMATION_CHANNELS, "channel"),
  note: optionalText(300),
});
export type ConfirmTicketInput = z.output<typeof ConfirmTicketSchema>;

export const ReopenTicketSchema = z.object({
  ticketId: objectId,
  reason: requiredText("What's still wrong", 300),
});
