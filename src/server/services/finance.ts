/**
 * Finance: GST invoices, the PM Surya Ghar subsidy file per order, technician
 * payouts, and read-only share links for the director's numbers.
 *
 *   subsidy  stages advance in order (SUBSIDY_FLOW), dates never typed;
 *            "applied" needs the portal application number, "disbursed" the amount
 *   payroll  every time log in the month (installations and service visits)
 *            × the technician's hourly rate
 *   share    an unguessable token, stored so it can be revoked; expires in
 *            1–30 days; the shared view masks customer names
 */
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { INVOICE_STATUSES, SYSTEM_TYPE_LABELS, statusMeta, type InvoiceStatus, type SubsidyStatus } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { escapeRegex, fromISTInput } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { AdvanceSubsidyInput, CreateShareLinkInput } from "@/lib/validation/finance";
import { SUBSIDY_FLOW } from "@/lib/workflows";
import { connectDB } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import { actorRef, type Actor } from "../lib/actor";
import { Customer, Invoice, Job, Order, Payment, ShareLink, Ticket, User } from "../models";
import { logActivity } from "./core/activity";

/* ------------------------------- Invoices ------------------------------- */

export async function listInvoices(filter: { status?: string; type?: string; q?: string; page?: number; pageSize?: number }, now: Date) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.status === "open") query.status = { $in: ["issued", "partially_paid"] };
  else if (filter.status === "overdue") Object.assign(query, { status: { $in: ["issued", "partially_paid"] }, dueAt: { $lt: now } });
  else if (filter.status && (INVOICE_STATUSES as readonly string[]).includes(filter.status)) query.status = filter.status;
  if (filter.type === "sale" || filter.type === "service") query.type = filter.type;
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ number: rx }, { "billTo.name": rx }, { "billTo.phone": rx }];
  }
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 25);
  const [rows, total, open] = await Promise.all([
    Invoice.find(query).sort({ issuedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Invoice.countDocuments(query),
    Invoice.aggregate<{ _id: null; due: number; n: number; overdue: number }>([
      { $match: { status: { $in: ["issued", "partially_paid"] } } },
      {
        $group: {
          _id: null,
          due: { $sum: { $subtract: ["$totalPaise", "$paidPaise"] } },
          n: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $lt: ["$dueAt", now] }, 1, 0] } },
        },
      },
    ]),
  ]);
  return {
    items: rows.map((i) => ({
      id: String(i._id),
      number: i.number,
      type: i.type,
      customer: i.billTo.name,
      issuedAt: i.issuedAt,
      dueAt: i.dueAt,
      totalPaise: i.totalPaise,
      paidPaise: i.paidPaise,
      status: i.status,
      overdue: ["issued", "partially_paid"].includes(i.status) && i.dueAt.getTime() < now.getTime(),
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    outstanding: { duePaise: open[0]?.due ?? 0, count: open[0]?.n ?? 0, overdue: open[0]?.overdue ?? 0 },
  };
}

export async function getInvoiceDetail(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const inv = await Invoice.findById(id).lean();
  if (!inv) return null;
  const [order, ticket, customer, payments] = await Promise.all([
    inv.orderId ? Order.findById(inv.orderId).select("number title capacityKw systemType").lean() : null,
    inv.ticketId ? Ticket.findById(inv.ticketId).select("number").lean() : null,
    Customer.findById(inv.customerId).select("gstin type").lean(),
    Payment.find({ $or: [{ invoiceId: inv._id }, ...(inv.orderId && inv.type === "sale" ? [{ orderId: inv.orderId }] : [])] }).sort({ receivedAt: 1 }).lean(),
  ]);
  return {
    invoice: {
      id: String(inv._id),
      number: inv.number,
      type: inv.type,
      status: inv.status,
      billTo: inv.billTo,
      lines: inv.lines,
      taxablePaise: inv.taxablePaise,
      gstPaise: inv.gstPaise,
      cgstPaise: inv.cgstPaise,
      sgstPaise: inv.sgstPaise,
      igstPaise: inv.igstPaise,
      totalPaise: inv.totalPaise,
      paidPaise: inv.paidPaise,
      duePaise: Math.max(0, inv.totalPaise - inv.paidPaise),
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      notes: inv.notes,
    },
    order: order ? { id: String(order._id), number: order.number, title: `${order.capacityKw} kW ${SYSTEM_TYPE_LABELS[order.systemType]}` } : null,
    ticket: ticket ? { id: String(ticket._id), number: ticket.number } : null,
    customerGstin: customer?.gstin,
    payments: payments.map((p) => ({ id: String(p._id), number: p.number, amountPaise: p.amountPaise, mode: p.mode, type: p.type, reference: p.reference, receivedAt: p.receivedAt })),
  };
}

/* -------------------------------- Subsidy ------------------------------- */

export async function advanceSubsidy(input: AdvanceSubsidyInput, actor: Actor) {
  await connectDB();
  const now = new Date();
  const order = await Order.findById(input.orderId);
  if (!order) throw notFoundError("Order");
  if (!order.subsidy.applicable) throw new AppError("INVALID_STATE", "This order isn't eligible for PM Surya Ghar (residential on-grid only).");
  assertTransition("subsidy", SUBSIDY_FLOW, order.subsidy.status, input.status);

  order.subsidy.status = input.status;
  if (input.applicationNo) order.subsidy.applicationNo = input.applicationNo;
  if (input.status === "disbursed") order.subsidy.disbursedPaise = input.disbursed ?? 0;
  order.subsidy.history.push({ status: input.status, at: now, note: input.note, by: actor.name });
  order.markModified("subsidy");
  await order.save();
  await logActivity({
    entityType: "order",
    entityId: order._id,
    customerId: order.customerId,
    action: "subsidy",
    message: `Subsidy: ${statusMeta("subsidy", input.status).label}${input.applicationNo ? ` (application ${input.applicationNo})` : ""}${input.status === "disbursed" ? ` — ${formatINR(input.disbursed)} credited to the customer` : ""}${input.note ? `. ${input.note}` : ""}`,
    actor,
  });
  return { number: order.number };
}

export async function getSubsidyBoard() {
  await connectDB();
  const orders = await Order.find({ "subsidy.applicable": true, status: { $ne: "cancelled" } }).select("number customerId capacityKw subsidy status commissionedAt").sort({ updatedAt: -1 }).limit(300).lean();
  const customers = await Customer.find({ _id: { $in: orders.map((o) => o.customerId) } }).select("name address.city discom").lean();
  const byId = new Map(customers.map((c) => [String(c._id), c]));
  const cards = orders.map((o) => {
    const c = byId.get(String(o.customerId));
    const last = o.subsidy.history.at(-1);
    return {
      id: String(o._id),
      number: o.number,
      customer: c?.name ?? "—",
      city: c?.address.city ?? "",
      discom: c?.discom,
      capacityKw: o.capacityKw,
      status: o.subsidy.status,
      applicationNo: o.subsidy.applicationNo,
      expectedPaise: o.subsidy.expectedPaise,
      disbursedPaise: o.subsidy.disbursedPaise,
      orderStatus: o.status,
      since: last?.at ?? o.commissionedAt,
    };
  });
  const columns = new Map<SubsidyStatus, typeof cards>();
  for (const card of cards) columns.set(card.status, [...(columns.get(card.status) ?? []), card]);
  return columns;
}

/* -------------------------------- Payroll ------------------------------- */

/** Hours from every job time log in the IST month × each technician's rate. */
export async function getPayroll(month: string) {
  await connectDB();
  const start = fromISTInput(`${month}-01`);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const end = fromISTInput(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`);
  const [rows, technicians] = await Promise.all([
    Job.aggregate<{ _id: { tech: Types.ObjectId; type: string }; hours: number; jobs: number }>([
      { $unwind: "$timeLogs" },
      { $match: { "timeLogs.date": { $gte: start, $lt: end } } },
      { $group: { _id: { tech: "$timeLogs.technicianId", type: "$type" }, hours: { $sum: "$timeLogs.hours" }, jobs: { $sum: 1 } } },
    ]),
    User.find({ role: "technician" }).select("name phone hourlyRatePaise skills active").sort({ name: 1 }).lean(),
  ]);
  const people = technicians.map((t) => {
    const mine = rows.filter((r) => r._id.tech.equals(t._id));
    const installHours = mine.filter((r) => r._id.type === "installation").reduce((s, r) => s + r.hours, 0);
    const serviceHours = mine.filter((r) => r._id.type === "service").reduce((s, r) => s + r.hours, 0);
    const hours = installHours + serviceHours;
    return {
      id: String(t._id),
      name: t.name,
      phone: t.phone,
      active: t.active,
      skills: t.skills ?? [],
      ratePaise: t.hourlyRatePaise,
      installHours,
      serviceHours,
      hours,
      jobs: mine.reduce((s, r) => s + r.jobs, 0),
      payPaise: Math.round(hours * t.hourlyRatePaise),
    };
  });
  return {
    month,
    start,
    end,
    people,
    totals: { hours: people.reduce((s, p) => s + p.hours, 0), payPaise: people.reduce((s, p) => s + p.payPaise, 0), jobs: people.reduce((s, p) => s + p.jobs, 0) },
  };
}

/* ------------------------------ Share links ----------------------------- */

export async function createShareLink(input: CreateShareLinkInput, actor: Actor) {
  await connectDB();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = addDays(new Date(), input.days);
  const link = await ShareLink.create({ token, scope: "dashboard", label: input.label, createdBy: actorRef(actor), expiresAt });
  await logActivity({ entityType: "share", entityId: link._id, action: "created", message: `Read-only dashboard link created${input.label ? ` for ${input.label}` : ""}, valid ${input.days} days`, actor });
  return { token, expiresAt };
}

export async function revokeShareLink(id: string, actor: Actor) {
  await connectDB();
  const link = await ShareLink.findOneAndUpdate({ _id: id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  if (!link) throw notFoundError("Active share link");
  await logActivity({ entityType: "share", entityId: link._id, action: "revoked", message: "Share link revoked", actor });
}

/** How long a customer's certificate link works (F22). */
const CERTIFICATE_LINK_DAYS = 90;

/**
 * F22-lite: a read-only link to one installation's certificate, sent to the
 * customer on WhatsApp after completion. Reuses the job's active link so the
 * customer never gets two; revocable from the job page like any share link.
 */
export async function certificateLink(jobId: string, actor: Actor, now: Date = new Date()): Promise<{ token: string; expiresAt: Date; created: boolean }> {
  await connectDB();
  if (!Types.ObjectId.isValid(jobId)) throw notFoundError("Job");
  const job = await Job.findById(jobId).select("number type status customerId").lean();
  if (!job) throw notFoundError("Job");
  if (job.type !== "installation" || job.status !== "completed") throw new AppError("INVALID_STATE", "The certificate is ready once the installation is completed.");
  const active = await ShareLink.findOne({ scope: "certificate", jobId: job._id, revokedAt: { $exists: false }, expiresAt: { $gt: now } }).lean();
  if (active) return { token: active.token, expiresAt: active.expiresAt, created: false };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = addDays(now, CERTIFICATE_LINK_DAYS);
  await ShareLink.create({ token, scope: "certificate", jobId: job._id, label: `Certificate ${job.number}`, createdBy: actorRef(actor), expiresAt });
  await logActivity({
    entityType: "job",
    entityId: job._id,
    customerId: job.customerId,
    action: "certificate_link",
    message: `Certificate link for the customer created, valid ${CERTIFICATE_LINK_DAYS} days`,
    actor,
  });
  return { token, expiresAt, created: true };
}

/** The job's active certificate link, if any (no side effects). */
export async function activeCertificateLink(jobId: string, now: Date) {
  await connectDB();
  if (!Types.ObjectId.isValid(jobId)) return null;
  const link = await ShareLink.findOne({ scope: "certificate", jobId, revokedAt: { $exists: false }, expiresAt: { $gt: now } }).lean();
  return link ? { id: String(link._id), token: link.token, expiresAt: link.expiresAt, viewCount: link.viewCount } : null;
}

/** May a signed-out viewer of this share link see this file? Only the certified job's own photos. */
export async function shareLinkAllowsFile(token: string, fileId: string, now: Date): Promise<boolean> {
  await connectDB();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false;
  const link = await ShareLink.findOne({ token, scope: "certificate" }).lean();
  if (!link?.jobId || link.revokedAt || link.expiresAt.getTime() < now.getTime()) return false;
  return Boolean(await Job.exists({ _id: link.jobId, photos: fileId }));
}

export async function listShareLinks(now: Date) {
  await connectDB();
  // Certificate links live on their job; this list is the director's dashboard links.
  const links = await ShareLink.find({ scope: { $ne: "certificate" } }).sort({ createdAt: -1 }).limit(20).lean();
  return links.map((l) => ({
    id: String(l._id),
    token: l.token,
    label: l.label,
    createdBy: l.createdBy.name,
    createdAt: l.createdAt,
    expiresAt: l.expiresAt,
    viewCount: l.viewCount,
    lastViewedAt: l.lastViewedAt,
    state: l.revokedAt ? ("revoked" as const) : l.expiresAt.getTime() < now.getTime() ? ("expired" as const) : ("active" as const),
  }));
}

/** Validate a shared token and count the view. Returns why it can't be shown, if it can't. */
export async function openShareLink(
  token: string,
  now: Date,
): Promise<{ ok: true; expiresAt: Date; label?: string; scope: "dashboard" | "certificate"; jobId?: string } | { ok: false; reason: "unknown" | "expired" | "revoked" }> {
  await connectDB();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, reason: "unknown" };
  const link = await ShareLink.findOne({ token }).lean();
  if (!link) return { ok: false, reason: "unknown" };
  if (link.revokedAt) return { ok: false, reason: "revoked" };
  if (link.expiresAt.getTime() < now.getTime()) return { ok: false, reason: "expired" };
  await ShareLink.updateOne({ _id: link._id }, { $inc: { viewCount: 1 }, $set: { lastViewedAt: now } });
  return { ok: true, expiresAt: link.expiresAt, label: link.label, scope: link.scope ?? "dashboard", jobId: link.jobId ? String(link.jobId) : undefined };
}

export type InvoiceListStatus = InvoiceStatus | "open" | "overdue";
