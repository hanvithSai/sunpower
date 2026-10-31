/**
 * Orders: the post-sale record for one installation. Reads for the order list
 * and detail page, plus cancellation (which releases any allocated serials and
 * the booked installation job).
 */
import { Types } from "mongoose";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { escapeRegex } from "@/lib/format";
import { ORDER_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import type { Actor } from "../lib/actor";
import { Customer, Invoice, Job, Lead, Order, Quote, SerialUnit, User } from "../models";
import { logActivity } from "./core/activity";
import { listPayments } from "./payments";

export async function listOrders(filter: { status?: string; q?: string; page?: number; pageSize?: number }) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.status && (ORDER_STATUSES as readonly string[]).includes(filter.status)) query.status = filter.status;
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");
    const customers = await Customer.find({
      $or: [{ name: rx }, { "address.city": rx }, ...(digits.length >= 4 ? [{ phone: { $regex: escapeRegex(digits) } }] : [])],
    })
      .select("_id")
      .limit(200)
      .lean();
    query.$or = [{ number: rx }, { customerId: { $in: customers.map((c) => c._id) } }];
  }
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 20);
  const countQuery = { ...query };
  delete countQuery.status;

  const [orders, total, grouped] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Order.countDocuments(query),
    Order.aggregate<{ _id: OrderStatus; n: number }>([{ $match: countQuery }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const customers = await Customer.find({ _id: { $in: orders.map((o) => o.customerId) } }).select("name address.city").lean();
  const customerById = new Map(customers.map((c) => [String(c._id), c]));

  return {
    items: orders.map((o) => {
      const customer = customerById.get(String(o.customerId));
      return {
        id: String(o._id),
        number: o.number,
        title: o.title,
        customerName: customer?.name ?? "—",
        city: customer?.address.city ?? "",
        totalPaise: o.totalPaise,
        paidPaise: o.paidPaise,
        paymentStatus: o.paymentStatus,
        status: o.status,
        createdAt: o.createdAt,
      };
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: Object.fromEntries(grouped.map((g) => [g._id, g.n])) as Partial<Record<OrderStatus, number>>,
  };
}

export async function getOrderDetail(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const order = await Order.findById(id).lean();
  if (!order) return null;

  const [customer, lead, quote, job, invoice, payments] = await Promise.all([
    Customer.findById(order.customerId).lean(),
    Lead.findById(order.leadId).select("number").lean(),
    Quote.findById(order.quoteId).select("number version").lean(),
    order.installationJobId ? Job.findById(order.installationJobId).select("number status scheduledFor technicianIds").lean() : Promise.resolve(null),
    order.invoiceId ? Invoice.findById(order.invoiceId).select("number status totalPaise paidPaise").lean() : Promise.resolve(null),
    listPayments({ orderId: id }),
  ]);
  const crew = job ? await User.find({ _id: { $in: job.technicianIds } }).select("name").lean() : [];

  return {
    order: {
      id: String(order._id),
      number: order.number,
      title: order.title,
      systemType: order.systemType,
      capacityKw: order.capacityKw,
      siteAddress: order.siteAddress,
      lines: order.lines.map((l) => ({ ...l, productId: String(l.productId) })),
      taxablePaise: order.taxablePaise,
      gstPaise: order.gstPaise,
      totalPaise: order.totalPaise,
      paidPaise: order.paidPaise,
      outstandingPaise: Math.max(0, order.totalPaise - order.paidPaise),
      paymentStatus: order.paymentStatus,
      status: order.status,
      pickList: order.pickList.map((p) => ({ ...p, productId: String(p.productId) })),
      subsidy: order.subsidy,
      extraCosts: order.extraCosts,
      salesUser: order.salesUser.name,
      confirmedAt: order.confirmedAt,
      commissionedAt: order.commissionedAt,
      createdAt: order.createdAt,
    },
    customer: customer
      ? { id: String(customer._id), name: customer.name, phone: customer.phone, email: customer.email, type: customer.type, discom: customer.discom, consumerNumber: customer.consumerNumber }
      : null,
    lead: lead ? { id: String(lead._id), number: lead.number } : null,
    quote: quote ? { id: String(quote._id), number: quote.number, version: quote.version } : null,
    job: job
      ? { id: String(job._id), number: job.number, status: job.status, scheduledFor: job.scheduledFor, crew: crew.map((c) => c.name) }
      : null,
    invoice: invoice ? { id: String(invoice._id), number: invoice.number, status: invoice.status, totalPaise: invoice.totalPaise, paidPaise: invoice.paidPaise } : null,
    payments,
  };
}

/** Cancel before dispatch: frees allocated serials and cancels the booked installation. */
export async function cancelOrder(orderId: string, reason: string, actor: Actor): Promise<void> {
  await withTransaction(async (session) => {
    const now = new Date();
    const order = await Order.findById(orderId).session(session);
    if (!order) throw notFoundError("Order");
    assertTransition("order", ORDER_FLOW, order.status, "cancelled");
    if (order.paidPaise > 0) {
      throw new AppError("INVALID_STATE", "Payments have been received on this order. Record the refund with accounts before cancelling.");
    }

    const allocated = order.pickList.flatMap((line) => line.serials);
    if (allocated.length > 0) {
      await SerialUnit.updateMany(
        { serial: { $in: allocated }, orderId: order._id, status: "allocated" },
        {
          $set: { status: "in_stock" },
          $unset: { orderId: "", allocatedAt: "" },
          $push: { history: { status: "in_stock", at: now, note: `Released — order ${order.number} cancelled`, by: actor.name } },
        },
        { session },
      );
    }
    if (order.installationJobId) {
      await Job.updateOne({ _id: order.installationJobId, status: "scheduled" }, { $set: { status: "cancelled" } }, { session });
    }
    order.status = "cancelled";
    order.notes = [order.notes, `Cancelled: ${reason}`].filter(Boolean).join("\n");
    await order.save({ session });
    await logActivity(
      { entityType: "order", entityId: order._id, customerId: order.customerId, action: "cancelled", message: `Order cancelled: ${reason}`, actor },
      session,
    );
  });
}
