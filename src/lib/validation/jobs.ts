/**
 * Installation job validation: rescheduling the crew, and the technician's
 * completion form on the roof (BR-14 — times, confirmed size, generation test,
 * kit check, photos, the customer's signature, and any extra material used).
 */
import { z } from "zod";
import { checkbox, objectId, optionalNumber, optionalText, requiredNumber, requiredText } from "./common";

const toArray = (v: unknown) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const dateTimeLocal = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const JobIdSchema = z.object({ jobId: objectId });

export const RescheduleJobSchema = z.object({
  jobId: objectId,
  scheduledFor: z.string({ error: "Pick a date and time" }).regex(dateTimeLocal, "Pick a date and time"),
  technicianIds: z.preprocess(toArray, z.array(objectId).min(1, "Pick at least one technician").max(6, "At most 6 technicians")),
  leadTechnicianId: z.preprocess(emptyToUndefined, objectId.optional()),
});
export type RescheduleJobInput = z.output<typeof RescheduleJobSchema>;

/** Extra material used on site beyond the pick list (cable, connectors…), posted as JSON. */
export const ExtraMaterialSchema = z.object({
  productId: objectId,
  qty: z.coerce.number({ error: "Enter a quantity" }).positive("Quantity must be more than 0").max(1000),
});

const extrasField = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return [];
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}, z.array(ExtraMaterialSchema).max(10, "Up to 10 extra items"));

export const CompleteJobSchema = z
  .object({
    jobId: objectId,
    /** Start and finish on site as the crew records them (IST `datetime-local`); default to the Start tap and now. */
    startedAt: z.preprocess(emptyToUndefined, z.string().regex(dateTimeLocal, "Pick the start time").optional()),
    finishedAt: z.preprocess(emptyToUndefined, z.string().regex(dateTimeLocal, "Pick the finish time").optional()),
    confirmedKw: requiredNumber("Installed size", 0.5, 10),
    kwChangeReason: optionalText(300),
    generationReadingKw: optionalNumber(0, 15),
    generationTested: checkbox.refine((v) => v, "Confirm that the system is generating power"),
    kitComplete: checkbox,
    missingItems: optionalText(300),
    mounting: checkbox,
    panels: checkbox,
    wiring: checkbox,
    earthing: checkbox,
    inverter: checkbox,
    photos: z.preprocess(toArray, z.array(objectId).min(1, "Add at least one photo of the finished roof").max(12, "Up to 12 photos")),
    photos__uploading: z.preprocess(emptyToUndefined, z.string().optional()),
    signature: z
      .string({ error: "The customer must sign to accept the work" })
      .startsWith("data:image/png;base64,", "The customer must sign to accept the work")
      .max(600_000, "Signature image is too large"),
    signedBy: requiredText("Signed by", 80),
    customerRemarks: optionalText(500),
    notes: optionalText(1000),
    extras: extrasField,
    extraCostRs: optionalNumber(0, 1_00_000),
    extraCostNote: optionalText(200),
  })
  .superRefine((v, ctx) => {
    if (v.photos__uploading === "1") ctx.addIssue({ code: "custom", path: ["photos"], message: "Wait for the photos to finish uploading" });
    if (!v.kitComplete && !v.missingItems) ctx.addIssue({ code: "custom", path: ["missingItems"], message: "List what was missing, or tick that the kit was complete" });
    if ((v.extraCostRs ?? 0) > 0 && !v.extraCostNote) ctx.addIssue({ code: "custom", path: ["extraCostNote"], message: "Say what the extra cost was for" });
  });
export type CompleteJobInput = z.output<typeof CompleteJobSchema>;
