"use server";
/**
 * Service desk Server Actions: raise a ticket (support), book the visit,
 * start and resolve (assigned technician or support), override billing with a
 * reason, record the customer's confirmation, close, and "not fixed" reopen.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import {
  AssignTicketSchema,
  BillingOverrideSchema,
  ConfirmTicketSchema,
  CreateTicketSchema,
  ReopenTicketSchema,
  ResolveTicketSchema,
  TicketIdSchema,
} from "@/lib/validation/service";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm } from "../lib/validate";
import { assignTicket, closeTicket, confirmTicket, createTicket, overrideBilling, reopenTicket, resolveTicket, startTicket } from "../services/tickets";

function refreshTicket(ticketId?: string) {
  revalidatePath("/service");
  if (ticketId) revalidatePath(`/service/${ticketId}`);
  revalidatePath("/my-work");
  revalidatePath("/jobs");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function createTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ticketId = "";
  const state = await runAction(["support"], async (user) => {
    const input = parseForm(CreateTicketSchema, formData);
    const result = await createTicket(input, user);
    ticketId = result.ticketId;
    refreshTicket();
    trackServer("ticket_created", { warranty: result.warranty, billable: result.billable, category: input.category }, user.id);
    return { ok: true, message: `${result.number} raised` };
  });
  if (state?.ok && ticketId) redirect(`/service/${ticketId}`);
  return state;
}

export async function assignTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["support"], async (user) => {
    const input = parseForm(AssignTicketSchema, formData);
    const result = await assignTicket(input, user);
    refreshTicket(input.ticketId);
    return { ok: true, message: `${result.number}: visit booked with ${result.technician}` };
  });
}

export async function startTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["support", "technician"], async (user) => {
    const { ticketId } = parseForm(TicketIdSchema, formData);
    await startTicket(ticketId, user);
    refreshTicket(ticketId);
    return { ok: true, message: "Work started" };
  });
}

export async function overrideBillingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["support"], async (user) => {
    const input = parseForm(BillingOverrideSchema, formData);
    await overrideBilling(input, user);
    refreshTicket(input.ticketId);
    return { ok: true, message: input.billable ? "Marked billable" : "Marked free of charge" };
  });
}

export async function resolveTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["support", "technician"], async (user) => {
    const input = parseForm(ResolveTicketSchema, formData);
    const result = await resolveTicket(input, user);
    refreshTicket(input.ticketId);
    revalidatePath("/inventory");
    trackServer("ticket_resolved", { type: input.type, billed: Boolean(result.invoiceNumber) }, user.id);
    if (result.invoiceNumber) trackServer("invoice_issued", { type: "service" }, user.id);
    return {
      ok: true,
      message: result.invoiceNumber
        ? `${result.number} resolved — invoice ${result.invoiceNumber} issued. Now confirm with the customer.`
        : `${result.number} resolved at ₹0 to the customer. Now confirm with the customer.`,
    };
  });
}

export async function confirmTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["support"], async (user) => {
    const input = parseForm(ConfirmTicketSchema, formData);
    await confirmTicket(input, user);
    refreshTicket(input.ticketId);
    return { ok: true, message: "Customer confirmation recorded" };
  });
}

export async function closeTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["support"], async (user) => {
    const { ticketId } = parseForm(TicketIdSchema, formData);
    const result = await closeTicket(ticketId, user);
    refreshTicket(ticketId);
    trackServer("ticket_closed", {}, user.id);
    return { ok: true, message: `${result.number} closed` };
  });
}

export async function reopenTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["support", "technician"], async (user) => {
    const { ticketId, reason } = parseForm(ReopenTicketSchema, formData);
    await reopenTicket(ticketId, reason, user);
    refreshTicket(ticketId);
    return { ok: true, message: "Reopened — back in progress" };
  });
}
