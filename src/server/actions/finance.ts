"use server";
/**
 * Finance Server Actions: advance a PM Surya Ghar subsidy file and keep its
 * photographed papers, and create or revoke read-only share links (the
 * director's numbers, or a customer's certificate).
 */
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { AddSubsidyDocumentSchema, AdvanceSubsidySchema, CreateShareLinkSchema, ShareLinkIdSchema } from "@/lib/validation/finance";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm } from "../lib/validate";
import { addSubsidyDocuments, advanceSubsidy, createShareLink, revokeShareLink } from "../services/finance";

export async function advanceSubsidyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const input = parseForm(AdvanceSubsidySchema, formData);
    const result = await advanceSubsidy(input, user);
    revalidatePath("/subsidy");
    revalidatePath(`/orders/${input.orderId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: `${result.number}: subsidy updated` };
  });
}

export async function addSubsidyDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const input = parseForm(AddSubsidyDocumentSchema, formData);
    const result = await addSubsidyDocuments(input, user);
    revalidatePath("/subsidy");
    revalidatePath(`/orders/${input.orderId}`);
    return { ok: true, message: `${result.number}: document saved to the subsidy file` };
  });
}

export async function createShareLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction([], async (user) => {
    const input = parseForm(CreateShareLinkSchema, formData);
    const { token } = await createShareLink(input, user);
    revalidatePath("/dashboard");
    trackServer("share_link_created", { days: input.days }, user.id);
    return { ok: true, message: "Read-only link created — copy it below", data: { token } };
  });
}

export async function revokeShareLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction([], async (user) => {
    const { shareLinkId } = parseForm(ShareLinkIdSchema, formData);
    await revokeShareLink(shareLinkId, user);
    revalidatePath("/dashboard");
    revalidatePath("/jobs/[id]", "page"); // certificate links are revoked from their job
    return { ok: true, message: "Link revoked — it stops working immediately" };
  });
}
