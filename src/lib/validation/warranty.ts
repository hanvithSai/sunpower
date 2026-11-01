/**
 * Public warranty lookup (F20). A homeowner checks cover with the serial
 * number printed on the unit, or with their mobile number plus the last 4
 * characters of any serial on their roof. The form posts (never a GET), so no
 * phone number or serial ends up in a URL or a server log.
 */
import { z } from "zod";
import { normalizePhone } from "../format";
import { PHONE_CHARS, requiredEmail } from "./common";
import { normalizeSerial } from "./inventory";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const WarrantyLookupSchema = z
  .object({
    by: z.preprocess((v) => v || "serial", z.enum(["serial", "phone"], { error: "Choose how to look up" })),
    serial: z.preprocess((v) => (typeof v === "string" ? normalizeSerial(v).replace(/\s+/g, "") || undefined : v), z.string().max(40, "Too long").optional()),
    phone: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() || undefined : emptyToUndefined(v)),
      z
        .string()
        .regex(PHONE_CHARS, "Use digits only, no letters")
        .transform(normalizePhone)
        .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter the 10-digit mobile number we have on file"))
        .optional(),
    ),
    /** Required from everyone who checks; not used to find the record (many customers on file have no email). */
    email: requiredEmail,
    last4: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v),
      z.string().regex(/^[A-Z0-9]{4}$/, "Enter the last 4 characters of any serial number").optional(),
    ),
    /** Honeypot: real visitors never see or fill it. */
    website: z.string().max(200).optional(),
  })
  .refine((v) => v.by !== "serial" || Boolean(v.serial), { path: ["serial"], message: "Enter the serial number on the label" })
  .refine((v) => v.by !== "phone" || Boolean(v.phone), { path: ["phone"], message: "Enter your mobile number" })
  .refine((v) => v.by !== "phone" || Boolean(v.last4), { path: ["last4"], message: "Enter the last 4 characters of any serial number" });
export type WarrantyLookupInput = z.output<typeof WarrantyLookupSchema>;
