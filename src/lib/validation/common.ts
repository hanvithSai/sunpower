/**
 * Reusable Zod building blocks. Module schemas (src/lib/validation/<module>.ts)
 * compose these so every form validates Indian phones, PIN codes, GSTINs and
 * rupee amounts the same way on the client and the server.
 */
import { z } from "zod";
import { normalizePhone } from "../format";

/** Treat empty form fields as "missing" before validating. */
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid reference");

/** Digits plus the separators people type ("+91 98480-12345"); letters are refused, never stripped. */
export const PHONE_CHARS = /^[+\d\s().-]*$/;

export const phone = z
  .string({ error: "Phone number is required" })
  .trim()
  .regex(PHONE_CHARS, "Use digits only, no letters")
  .transform(normalizePhone)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.email("Enter a valid email address").max(120).optional(),
);

export const requiredEmail = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || undefined : emptyToUndefined(v)),
  z.email({ error: (iss) => (iss.input === undefined ? "Enter your email address" : "Enter a valid email address") }).max(120, "Too long"),
);

export const pincode = z
  .string({ error: "PIN code is required" })
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");

export const optionalGstin = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN")
    .optional(),
);

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`);

export const optionalText = (max = 1000) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, "Too long").optional());

export const requiredNumber = (label: string, min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} is required` })
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`),
  );

export const optionalNumber = (min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(min).max(max).optional());

/** Rupees typed in a form -> integer paise. */
export const rupeesAsPaise = (label: string, min = 0, maxRupees = 1_00_00_000) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} is required` })
      .min(min, `${label} must be at least ₹${min}`)
      .max(maxRupees, `${label} is too large`)
      .transform((rupees) => Math.round(rupees * 100)),
  );

export const capacityKw = requiredNumber("System size (kW)", 1, 10);

/** HTML checkbox -> boolean ("on" when ticked, missing when not). */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const requiredDate = (label: string) =>
  z.preprocess(emptyToUndefined, z.coerce.date({ error: `${label} is required` }));

export const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

/** Repeated form fields (e.g. several hidden `photos` inputs) -> string[]. */
export const stringArray = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string().trim().min(1)),
);

export const objectIdArray = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(objectId),
);

export function enumOf<const T extends readonly [string, ...string[]]>(values: T, label: string) {
  return z.enum(values, { error: `Choose a valid ${label.toLowerCase()}` });
}
