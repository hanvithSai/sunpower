"use server";
/**
 * Public (signed-out) Server Actions. The website enquiry form posts here so
 * it shares validation and field components with the sales team's dialog.
 * The REST endpoint /api/v1/enquiries offers the same behaviour to other sites.
 */
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { PublicEnquirySchema } from "@/lib/validation/leads";
import { trackServer } from "../analytics";
import { toActionError } from "../lib/action";
import { rateLimit } from "../lib/rate-limit";
import { parseForm } from "../lib/validate";
import { createLead } from "../services/leads";

export async function submitEnquiryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "local";
    rateLimit(`enquiry:${ip}`, 5, 10 * 60 * 1000);

    const input = parseForm(PublicEnquirySchema, formData);
    if (input.website) return { ok: true, data: { reference: null } }; // honeypot: likely a bot

    const result = await createLead({ ...input, source: "website" }, null);
    trackServer("enquiry_submitted", { source: "website", capacityKw: input.capacityKw, systemType: input.systemType });
    return {
      ok: true,
      message: result.duplicate ? "We already have your enquiry — our team will call you shortly." : "Thank you! Your enquiry is in.",
      data: { reference: result.number },
    };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
