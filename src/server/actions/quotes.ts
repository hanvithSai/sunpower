"use server";
/**
 * Quote Server Actions. The builder posts JSON (dynamic line items); the
 * status buttons post form data. Accepting a quote redirects to the new order.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { MarkQuoteSentSchema, QuoteIdSchema, RejectQuoteSchema, SaveQuoteSchema } from "@/lib/validation/quotes";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm, parseInput } from "../lib/validate";
import { acceptQuote, markQuoteSent, rejectQuote, saveQuote } from "../services/quotes";

function refreshQuote(quoteId?: string) {
  revalidatePath("/quotes");
  if (quoteId) revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/leads");
}

/** Called directly from the quote builder with a JSON payload. */
export async function saveQuoteAction(input: unknown): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const data = parseInput(SaveQuoteSchema, input);
    const result = await saveQuote(data, user);
    refreshQuote(result.quoteId);
    revalidatePath(`/leads/${data.leadId}`);
    trackServer(
      "quote_created",
      { packageCode: result.packageCode, capacityKw: data.capacityKw, totalRs: Math.round(result.totalPaise / 100) },
      user.id,
    );
    if (data.send) trackServer("quote_sent", {}, user.id);
    return {
      ok: true,
      message: `Quote ${result.number} ${data.send ? "saved and marked as sent" : "saved as a draft"}`,
      data: { quoteId: result.quoteId },
    };
  });
}

export async function markQuoteSentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const { quoteId, sendWithMissing } = parseForm(MarkQuoteSentSchema, formData);
    await markQuoteSent(quoteId, user, { sendWithMissing });
    refreshQuote(quoteId);
    trackServer("quote_sent", {}, user.id);
    return { ok: true, message: "Marked as sent" };
  });
}

export async function acceptQuoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const { quoteId } = parseForm(QuoteIdSchema, formData);
    const { orderId } = await acceptQuote(quoteId, user);
    refreshQuote(quoteId);
    revalidatePath("/orders");
    trackServer("quote_accepted", {}, user.id);
    redirect(`/orders/${orderId}`);
  });
}

export async function rejectQuoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const { quoteId, reason } = parseForm(RejectQuoteSchema, formData);
    await rejectQuote(quoteId, reason, user);
    refreshQuote(quoteId);
    return { ok: true, message: "Quote marked as declined" };
  });
}
