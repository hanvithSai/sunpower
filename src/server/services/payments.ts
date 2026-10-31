/**
 * Payments — a shared contract used by orders (advance/balance), invoices and
 * service tickets.
 *
 * The first payment on an order CONFIRMS it, in the same transaction:
 *   - the warehouse pick list is built from the order lines, and
 *   - the installation job is booked with the three least-loaded installers,
 * so "the warehouse knows what to pack and the crew sees the job" without
 * anyone phoning anyone.
 */
import { Types, type ClientSession } from "mongoose";
import { PAYMENT_MODE_LABELS, PAYMENT_TYPE_LABELS, SYSTEM_TYPE_LABELS, type PaymentMode, type PaymentType } from "@/lib/constants";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { ORDER_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import { actorRef, toObjectId, type Actor } from "../lib/actor";
import { Invoice, Job, Order, Payment, User } from "../models";
import { logActivity } from "./core/activity";
import { nextNumber } from "./core/counters";
import { invoiceStatusFor } from "./core/invoicing";

export type RecordPaymentArgs = {
  orderId?: string;
  invoiceId?: string;
  ticketId?: string;
  amountPaise: number;
  mode: PaymentMode;
  type: PaymentType;
  reference?: string;
  receivedAt?: Date;
  notes?: string;
};

export type RecordPaymentResult = {
  paymentId: string;
  number: string;
  /** True when this payment confirmed the order (pick list + job created). */
  confirmedOrder: boolean;
  jobNumber?: string;
};

const CREW_SIZE = 3;

/** Installers with the lightest current workload (scheduled + in-progress jobs). */
async function pickCrew(session: ClientSession): Promise<{ _id: Types.ObjectId; name: string }[]> {
  const installers = await User.find({ role: "technician", active: true, skills: "installation" }).select("name").session(session).lean();
  if (installers.length === 0) return [];
  const loads = await Job.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { status: { $in: ["scheduled", "in_progress"] }, technicianIds: { $in: installers.map((i) => i._id) } } },
    { $unwind: "$technicianIds" },
    { $group: { _id: "$technicianIds", n: { $sum: 1 } } },
  ]).session(session);
  const load = new Map(loads.map((l) => [String(l._id), l.n]));
  return [...installers]
    .sort((a, b) => (load.get(String(a._id)) ?? 0) - (load.get(String(b._id)) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, CREW_SIZE);
}

export async function recordPayment(input: RecordPaymentArgs, actor: Actor): Promise<RecordPaymentResult> {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new AppError("VALIDATION", "Enter an amount above ₹0.", { amount: "Enter an amount above ₹0" });
  }

  return withTransaction(async (session) => {
    const now = new Date();
    const order = input.orderId ? await Order.findById(input.orderId).session(session) : null;
    if (input.orderId && !order) throw notFoundError("Order");
    const invoiceId = input.invoiceId ?? (order?.invoiceId ? String(order.invoiceId) : undefined);
    const invoice = invoiceId ? await Invoice.findById(invoiceId).session(session) : null;
    if (input.invoiceId && !invoice) throw notFoundError("Invoice");
    if (!order && !invoice) throw new AppError("BAD_REQUEST", "A payment must belong to an order or an invoice.");
    if (order?.status === "cancelled") throw new AppError("INVALID_STATE", "This order is cancelled.");

    const outstanding = order ? order.totalPaise - order.paidPaise : invoice!.totalPaise - invoice!.paidPaise;
    if (outstanding <= 0) throw new AppError("INVALID_STATE", "Nothing is outstanding — this is already fully paid.");
    if (input.amountPaise > outstanding) {
      throw new AppError("VALIDATION", `Only ${formatINR(outstanding)} is outstanding.`, { amount: `At most ${formatINR(outstanding)}` });
    }

    const customerId = order?.customerId ?? invoice!.customerId;
    const number = await nextNumber("payment", session);
    const receivedAt = input.receivedAt ?? now;
    const [payment] = await Payment.create(
      [
        {
          number,
          customerId,
          orderId: order?._id,
          invoiceId: invoice?._id,
          ticketId: input.ticketId ? toObjectId(input.ticketId) : undefined,
          amountPaise: input.amountPaise,
          mode: input.mode,
          type: input.type,
          reference: input.reference,
          receivedAt,
          recordedBy: actorRef(actor),
          notes: input.notes,
        },
      ],
      { session },
    );

    const label = `${PAYMENT_TYPE_LABELS[input.type]} of ${formatINR(input.amountPaise)} received by ${PAYMENT_MODE_LABELS[input.mode]}${input.reference ? ` (ref ${input.reference})` : ""}`;
    let confirmedOrder = false;
    let jobNumber: string | undefined;

    if (invoice) {
      invoice.paidPaise = Math.min(invoice.totalPaise, invoice.paidPaise + input.amountPaise);
      invoice.status = invoiceStatusFor(invoice.paidPaise, invoice.totalPaise);
      await invoice.save({ session });
      await logActivity({ entityType: "invoice", entityId: invoice._id, customerId, action: "payment_recorded", message: label, actor }, session);
    }

    if (order) {
      order.paidPaise += input.amountPaise;
      order.paymentStatus = order.paidPaise >= order.totalPaise ? "paid" : "partial";

      if (order.status === "pending_payment") {
        assertTransition("order", ORDER_FLOW, order.status, "confirmed");
        order.status = "confirmed";
        order.confirmedAt = now;
        order.pickList = order.lines
          .filter((l) => l.category !== "service")
          .map((l) => ({ productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, isSerialized: l.isSerialized, serials: [], picked: false }));

        const crew = await pickCrew(session);
        const scheduledFor = addHours(addDays(startOfDayIST(now), 4), 9.5); // 09:30 IST, four days out
        jobNumber = await nextNumber("job", session);
        const [job] = await Job.create(
          [
            {
              number: jobNumber,
              type: "installation",
              orderId: order._id,
              customerId,
              title: `${order.capacityKw} kW ${SYSTEM_TYPE_LABELS[order.systemType]} installation`,
              siteAddress: order.siteAddress,
              scheduledFor,
              estimatedHours: 4 + 1.5 * order.capacityKw,
              technicianIds: crew.map((c) => c._id),
              leadTechnicianId: crew[0]?._id,
              status: "scheduled",
            },
          ],
          { session },
        );
        order.installationJobId = job._id;
        confirmedOrder = true;

        const crewNames = crew.map((c) => c.name).join(", ") || "crew to be assigned";
        await logActivity(
          {
            entityType: "order",
            entityId: order._id,
            customerId,
            action: "confirmed",
            message: `Order confirmed — pick list of ${order.pickList.length} items sent to the warehouse; installation ${jobNumber} booked for ${formatDateTime(scheduledFor)} with ${crewNames}`,
            actor,
          },
          session,
        );
        await logActivity(
          { entityType: "job", entityId: job._id, customerId, action: "scheduled", message: `Installation booked automatically for ${formatDateTime(scheduledFor)} (${crewNames})`, actor },
          session,
        );
      }
      await order.save({ session });
      await logActivity({ entityType: "order", entityId: order._id, customerId, action: "payment_recorded", message: label, actor }, session);
    }

    return { paymentId: String(payment._id), number, confirmedOrder, jobNumber };
  });
}

export async function listPayments(filter: { orderId?: string; invoiceId?: string; customerId?: string }) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.orderId) query.orderId = toObjectId(filter.orderId);
  if (filter.invoiceId) query.invoiceId = toObjectId(filter.invoiceId);
  if (filter.customerId) query.customerId = toObjectId(filter.customerId);
  if (Object.keys(query).length === 0) return [];
  const rows = await Payment.find(query).sort({ receivedAt: -1 }).lean();
  return rows.map((p) => ({
    id: String(p._id),
    number: p.number,
    amountPaise: p.amountPaise,
    mode: p.mode,
    type: p.type,
    reference: p.reference,
    receivedAt: p.receivedAt,
    recordedBy: p.recordedBy.name,
    notes: p.notes,
  }));
}
