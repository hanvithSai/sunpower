/**
 * Lead validation, shared by the public enquiry form / API, the sales team's
 * manual entry (WhatsApp, calls, walk-ins) and the qualification checklist.
 * The same schemas run in the browser for instant feedback and on the server.
 */
import { z } from "zod";
import { CUSTOMER_TYPES, LEAD_SOURCES, REQUESTED_SYSTEM_TYPES, ROOF_TYPES } from "../constants";
import {
  capacityKw,
  checkbox,
  enumOf,
  objectId,
  optionalEmail,
  optionalGstin,
  optionalNumber,
  optionalText,
  phone,
  requiredEmail,
  pincode,
  requiredNumber,
  requiredText,
} from "./common";

/** Rule of thumb on the qualification checklist: ~100 sq ft of shadow-free roof per kW. */
export const SQFT_PER_KW = 100;

const enquiryShape = {
  name: requiredText("Name", 80),
  phone,
  email: optionalEmail,
  city: requiredText("City", 60),
  pincode,
  addressLine: optionalText(200),
  customerType: z.preprocess((v) => v || "residential", enumOf(CUSTOMER_TYPES, "property type")),
  /** Businesses only: printed on their GST invoice so they can claim input credit. */
  gstin: optionalGstin,
  capacityKw,
  systemType: enumOf(REQUESTED_SYSTEM_TYPES, "system type"),
  wantsSubsidy: checkbox,
  monthlyBillRs: optionalNumber(0, 10_00_000),
  message: optionalText(1000),
};

/** Public website form / JSON API. `website` is a honeypot real visitors never see. */
export const PublicEnquirySchema = z.object({
  ...enquiryShape,
  email: requiredEmail,
  website: z.string().max(200).optional(),
});

/** Sales entering an enquiry that arrived by WhatsApp, phone, walk-in or referral. */
export const ManualLeadSchema = z
  .object({
    ...enquiryShape,
    source: enumOf(LEAD_SOURCES, "source"),
  })
  /** Website enquiries always carry an email; WhatsApp, calls and walk-ins often don't. */
  .refine((v) => v.source !== "website" || Boolean(v.email), { path: ["email"], message: "Website enquiries need an email address" });

/** What the lead service accepts from either form: email is optional (WhatsApp, calls and walk-ins often have none). */
export type EnquiryInput = z.output<z.ZodObject<typeof enquiryShape>>;
export type ManualLeadInput = z.output<typeof ManualLeadSchema>;

export const QualifyLeadSchema = z
  .object({
    leadId: objectId,
    roofAreaSqft: requiredNumber("Roof area", 20, 1_00_000),
    shadowFreeAreaSqft: requiredNumber("Shadow-free area", 0, 1_00_000),
    monthlyBillRs: requiredNumber("Monthly bill", 0, 10_00_000),
    sanctionedLoadKw: optionalNumber(0, 1000),
    gridSuitable: checkbox,
    roofType: enumOf(ROOF_TYPES, "roof type"),
    notes: optionalText(1000),
  })
  .refine((v) => v.shadowFreeAreaSqft <= v.roofAreaSqft, {
    path: ["shadowFreeAreaSqft"],
    message: "Can't be more than the total roof area",
  });
export type QualifyLeadInput = z.output<typeof QualifyLeadSchema>;

export const LeadIdSchema = z.object({ leadId: objectId });

export const MarkLeadLostSchema = z.object({
  leadId: objectId,
  reason: requiredText("Reason", 300),
});

export const AssignLeadSchema = z.object({
  leadId: objectId,
  userId: objectId,
});

/** `datetime-local` value typed in IST, e.g. 2026-11-02T10:30. */
export const istDateTime = z
  .string({ error: "Pick a date and time" })
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time");

export const ScheduleSurveySchema = z.object({
  leadId: objectId,
  technicianId: objectId,
  scheduledFor: istDateTime,
});
