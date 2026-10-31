/**
 * POST /api/v1/warranty: public warranty lookup behind /warranty (F20).
 *
 *   { by: "serial", serial }  or  { by: "phone", phone, last4 }
 *   200 { ok: true, customer: "L. N****, Kukatpally", units: [...], workmanship? }
 *   404 { error: { code: "NOT_FOUND" } } for every miss  ·  422 field errors  ·  429 too many requests
 *
 * POST only, so no phone number or serial lands in a URL. 10 lookups per IP
 * per hour. The answer never carries a phone, an address or a full name.
 */
import { WarrantyLookupSchema } from "@/lib/validation/warranty";
import { trackServer } from "@/server/analytics";
import { AppError } from "@/server/errors";
import { apiHandler, clientIp, readJson } from "@/server/lib/api";
import { rateLimit } from "@/server/lib/rate-limit";
import { parseInput } from "@/server/lib/validate";
import { lookupWarranty } from "@/server/services/warranty";

export const POST = apiHandler(async (request) => {
  rateLimit(`warranty:${clientIp(request)}`, 10, 60 * 60 * 1000);
  const input = parseInput(WarrantyLookupSchema, await readJson(request));
  const result = input.website ? null : await lookupWarranty(input, new Date());
  trackServer("warranty_lookup", { by: input.by, found: Boolean(result) });
  if (!result) throw new AppError("NOT_FOUND", "No match found.");
  return Response.json({ ok: true, ...result });
});
