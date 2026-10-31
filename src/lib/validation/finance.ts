/**
 * Finance validation: PM Surya Ghar subsidy stages, read-only share links and
 * report parameters.
 */
import { z } from "zod";
import { SUBSIDY_DOC_KINDS, SUBSIDY_STATUSES } from "../constants";
import { enumOf, objectId, optionalText, rupeesAsPaise } from "./common";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const AdvanceSubsidySchema = z
  .object({
    orderId: objectId,
    status: enumOf(SUBSIDY_STATUSES, "stage"),
    applicationNo: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
    disbursed: z.preprocess(emptyToUndefined, rupeesAsPaise("Amount received", 1).optional()),
    note: optionalText(300),
  })
  .refine((v) => v.status !== "applied" || Boolean(v.applicationNo), { path: ["applicationNo"], message: "Enter the national portal application number" })
  .refine((v) => v.status !== "disbursed" || Boolean(v.disbursed), { path: ["disbursed"], message: "Enter the amount credited to the customer" });
export type AdvanceSubsidyInput = z.output<typeof AdvanceSubsidySchema>;

export const CreateShareLinkSchema = z.object({
  days: z.coerce.number({ error: "Pick how long the link works" }).int().min(1, "At least 1 day").max(30, "At most 30 days"),
  label: optionalText(80),
});
export type CreateShareLinkInput = z.output<typeof CreateShareLinkSchema>;

export const ShareLinkIdSchema = z.object({ shareLinkId: objectId });

export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

/** Photos of one subsidy paper, uploaded to GridFS first (see <MediaUploader>). */
export const AddSubsidyDocumentSchema = z
  .object({
    orderId: objectId,
    kind: enumOf(SUBSIDY_DOC_KINDS, "document"),
    photos: z.preprocess((v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(objectId).min(1, "Add a photo of the document").max(6, "At most 6 photos")),
    photos__uploading: z.string().optional(),
    note: optionalText(200),
  })
  .refine((v) => !v.photos__uploading, { path: ["photos"], message: "Wait for the photos to finish uploading" });
export type AddSubsidyDocumentInput = z.output<typeof AddSubsidyDocumentSchema>;
