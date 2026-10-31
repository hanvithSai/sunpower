/**
 * POST /api/v1/enquiries: public enquiry endpoint behind the website form
 * (and usable by any external landing page).
 *
 *   { name, phone, email?, city, pincode, addressLine?, customerType?, capacityKw,
 *     systemType, wantsSubsidy, monthlyBillRs?, message?, website (honeypot) }
 *   201 { ok: true, reference: "SP-L-0123" }  ·  422 field errors  ·  429 too many requests
 *
 * Rate-limited per IP. A filled honeypot gets a fake success so bots learn
 * nothing. Repeat enquiries from the same phone attach to the open lead.
 */
import { PublicEnquirySchema } from "@/lib/validation/leads";
import { trackServer } from "@/server/analytics";
import { apiHandler, clientIp, readJson } from "@/server/lib/api";
import { rateLimit } from "@/server/lib/rate-limit";
import { parseInput } from "@/server/lib/validate";
import { createLead } from "@/server/services/leads";

export const POST = apiHandler(async (request) => {
  rateLimit(`enquiry:${clientIp(request)}`, 5, 10 * 60 * 1000);
  const input = parseInput(PublicEnquirySchema, await readJson(request));

  if (input.website) {
    return Response.json({ ok: true, reference: null }, { status: 201 });
  }

  const result = await createLead({ ...input, source: "website" }, null);
  trackServer("enquiry_submitted", {
    source: "website",
    capacityKw: input.capacityKw,
    systemType: input.systemType,
  });
  return Response.json({ ok: true, reference: result.number }, { status: 201 });
});
