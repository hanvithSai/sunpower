"use server";
/**
 * Order Server Actions: record a payment (the first one confirms the order and
 * triggers the pick list + installation booking) and cancel before dispatch.
 */
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { startOfDayIST } from "@/lib/dates";
import { fromISTInput } from "@/lib/format";
import { CancelOrderSchema, RecordPaymentSchema } from "@/lib/validation/quotes";
import { trackServer } from "../analytics";
import { AppError } from "../errors";
import { runAction } from "../lib/action";
import { parseForm } from "../lib/validate";
import { cancelOrder } from "../services/orders";
import { recordPayment } from "../services/payments";

function refreshOrder(orderId?: string) {
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dispatch");
  revalidatePath("/jobs");
  revalidatePath("/invoices");
}

/** A date picked in the form → a timestamp (now if it's today, midday IST otherwise). */
function receivedAtFrom(day: string | undefined, now: Date): Date | undefined {
  if (!day) return undefined;
  const at = fromISTInput(day);
  if (at.getTime() > now.getTime()) {
    throw new AppError("VALIDATION", "The payment date can't be in the future.", { receivedOn: "Can't be in the future" });
  }
  return at.getTime() === startOfDayIST(now).getTime() ? now : new Date(at.getTime() + 12 * 60 * 60 * 1000);
}

export async function recordPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales", "support"], async (user) => {
    const input = parseForm(RecordPaymentSchema, formData);
    const result = await recordPayment(
      {
        orderId: input.orderId,
        invoiceId: input.invoiceId,
        ticketId: input.ticketId,
        amountPaise: input.amount,
        mode: input.mode,
        type: input.type,
        reference: input.reference,
        receivedAt: receivedAtFrom(input.receivedOn, new Date()),
        notes: input.notes,
      },
      user,
    );
    refreshOrder(input.orderId);
    if (input.invoiceId) revalidatePath(`/invoices/${input.invoiceId}`);
    trackServer("payment_recorded", { type: input.type, mode: input.mode, amountRs: Math.round(input.amount / 100) }, user.id);
    if (result.confirmedOrder) trackServer("order_confirmed", {}, user.id);
    return {
      ok: true,
      message: result.confirmedOrder
        ? `Payment ${result.number} recorded — order confirmed, pick list sent to the warehouse and installation ${result.jobNumber} booked`
        : `Payment ${result.number} recorded`,
    };
  });
}

export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction([], async (user) => {
    const { orderId, reason } = parseForm(CancelOrderSchema, formData);
    await cancelOrder(orderId, reason, user);
    refreshOrder(orderId);
    return { ok: true, message: "Order cancelled" };
  });
}
