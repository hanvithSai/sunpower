/**
 * Service desk: "the inverter shows a fault code and there is zero power".
 *
 *   create   → warranty decided on the spot (BR-04): from the serial's own
 *              dates, or — for wiring, earthing, structure faults with no
 *              serial — from the workmanship warranty sold with the
 *              installation. In warranty = ₹0 to the customer.
 *   assign   → a service visit on the technician's calendar and My work.
 *   resolve  → parts and labour recorded; a replacement unit takes over the
 *              faulty serial (BR-15). Out of warranty, the GST service invoice
 *              is issued automatically (BR-05). In warranty, what it cost us
 *              (parts at cost + labour at the technician's rate) is charged to
 *              the original order, so its profit is lifetime profit.
 *   confirm  → the customer says it works (who, how, when); only then close
 *              (BR-06). "Not fixed" reopens it at any point.
 */
import { Types } from "mongoose";
import {
  CONFIRMATION_CHANNEL_LABELS,
  RESOLUTION_TYPE_LABELS,
  SERVICE_GST_RATE,
  SERVICE_LABOUR_RATE_RS,
  SERVICE_SAC,
  TICKET_CATEGORY_LABELS,
  TICKET_SLA_HOURS,
  TICKET_STATUSES,
  type Role,
  type TicketStatus,
  type WarrantyBasis,
  type WarrantyState,
} from "@/lib/constants";
import { addHours } from "@/lib/dates";
import { escapeRegex, formatDate, formatDateTime, fromISTInput, normalizePhone } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { AssignTicketInput, BillingOverrideInput, ConfirmTicketInput, CreateTicketInput, ResolveTicketInput } from "@/lib/validation/service";
import { normalizeSerial } from "@/lib/validation/inventory";
import { addMonths, getWarrantyInfo, workmanshipEnd } from "@/lib/warranty";
import { TICKET_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import { actorRef, toObjectId, type Actor } from "../lib/actor";
import { Customer, Invoice, Job, Order, Product, SerialUnit, Ticket, User, type ITicket, type ITicketPart } from "../models";
import { logActivity } from "./core/activity";
import { nextNumber } from "./core/counters";
import { issueInvoice, type InvoiceLineInput } from "./core/invoicing";
import { moveStock } from "./core/stock";

export type TicketActor = Actor & { role: Role };

/* ------------------------------ Warranty -------------------------------- */

export type WarrantyDecision = {
  customerId: Types.ObjectId;
  orderId?: Types.ObjectId;
  serialUnitId?: Types.ObjectId;
  serial?: string;
  productName?: string;
  state: WarrantyState;
  basis: WarrantyBasis;
  endsAt?: Date;
};

/** BR-04: decide coverage from the serial, or from the latest installation's workmanship warranty. */
export async function decideWarranty(input: { serial?: string; customerId?: string }, now: Date): Promise<WarrantyDecision> {
  await connectDB();
  if (input.serial) {
    const serial = normalizeSerial(input.serial);
    const unit = await SerialUnit.findOne({ serial }).lean();
    if (!unit) throw new AppError("NOT_FOUND", `${serial} isn't a SunPower serial number.`);
    if (!unit.customerId || ["in_stock", "allocated"].includes(unit.status)) {
      throw new AppError("INVALID_STATE", `${serial} is still in the warehouse — it hasn't been installed for a customer.`);
    }
    const end = unit.warrantyEndAt;
    return {
      customerId: unit.customerId,
      orderId: unit.orderId,
      serialUnitId: unit._id,
      serial: unit.serial,
      productName: unit.productName,
      // Not delivered yet: the clock hasn't started, so it's covered.
      state: !end || now.getTime() <= end.getTime() ? "in_warranty" : "out_of_warranty",
      basis: "serial",
      endsAt: end,
    };
  }

  const customerId = toObjectId(input.customerId!);
  const customer = await Customer.exists({ _id: customerId });
  if (!customer) throw notFoundError("Customer");
  const order = await Order.findOne({ customerId, commissionedAt: { $exists: true } }).sort({ commissionedAt: -1 }).lean();
  const end = order ? workmanshipEnd(order) : undefined;
  if (!order || !end) return { customerId, orderId: order?._id, state: "no_serial", basis: "none" };
  return { customerId, orderId: order._id, state: now.getTime() <= end.getTime() ? "in_warranty" : "out_of_warranty", basis: "workmanship", endsAt: end };
}

/** Everything support needs before raising a ticket: the customer, their installed units and the decision. */
export async function previewTicket(input: { serial?: string; customerId?: string }, now: Date) {
  const decision = await decideWarranty(input, now);
  const [customer, units, openTickets] = await Promise.all([
    Customer.findById(decision.customerId).select("name phone address discom").lean(),
    SerialUnit.find({ customerId: decision.customerId, status: { $in: ["dispatched", "installed"] } })
      .select("serial productName category status warrantyStartAt warrantyEndAt")
      .sort({ category: 1, serial: 1 })
      .lean(),
    Ticket.find({ customerId: decision.customerId, status: { $nin: ["closed"] } }).select("number status category createdAt").sort({ createdAt: -1 }).lean(),
  ]);
  return {
    decision: {
      state: decision.state,
      basis: decision.basis,
      endsAt: decision.endsAt,
      serial: decision.serial,
      productName: decision.productName,
      info: getWarrantyInfo(decision.endsAt ? new Date(0) : null, decision.endsAt, now),
    },
    customer: customer ? { id: String(customer._id), name: customer.name, phone: customer.phone, address: customer.address, discom: customer.discom } : null,
    units: units.map((u) => ({ serial: u.serial, productName: u.productName, category: u.category, status: u.status, warrantyEndAt: u.warrantyEndAt, info: getWarrantyInfo(u.warrantyStartAt, u.warrantyEndAt, now) })),
    openTickets: openTickets.map((t) => ({ id: String(t._id), number: t.number, status: t.status, category: t.category, createdAt: t.createdAt })),
  };
}

/* -------------------------------- Create -------------------------------- */

export async function createTicket(input: CreateTicketInput, actor: Actor, opts: { at?: Date } = {}) {
  const now = opts.at ?? new Date();
  const decision = await decideWarranty({ serial: input.serial, customerId: input.customerId }, now);
  if (input.customerId && input.serial && String(decision.customerId) !== input.customerId) {
    throw new AppError("VALIDATION", "That serial belongs to a different customer.", { serial: "Belongs to a different customer" });
  }

  return withTransaction(async (session) => {
    const number = await nextNumber("ticket", session);
    const billable = decision.state !== "in_warranty";
    const [ticket] = await Ticket.create(
      [
        {
          number,
          customerId: decision.customerId,
          orderId: decision.orderId,
          serial: decision.serial,
          serialUnitId: decision.serialUnitId,
          productName: decision.productName,
          category: input.category,
          faultCode: input.faultCode,
          description: input.description,
          priority: input.priority,
          channel: input.channel,
          status: "open",
          warranty: { state: decision.state, basis: decision.basis, endsAt: decision.endsAt, checkedAt: now },
          billable,
          slaDueAt: addHours(now, TICKET_SLA_HOURS[input.priority]),
          createdBy: actorRef(actor),
        },
      ],
      { session },
    );
    const coverage =
      decision.state === "in_warranty"
        ? `in ${decision.basis === "workmanship" ? "workmanship " : ""}warranty until ${formatDate(decision.endsAt)} — free of charge`
        : decision.state === "out_of_warranty"
          ? `out of warranty since ${formatDate(decision.endsAt)} — parts and labour will be billed`
          : "no SunPower installation to cover it — billable";
    await logActivity(
      {
        entityType: "ticket",
        entityId: ticket._id,
        customerId: decision.customerId,
        action: "created",
        message: `${TICKET_CATEGORY_LABELS[input.category]}${decision.serial ? ` on ${decision.serial}` : ""}: ${coverage}`,
        actor,
        at: now,
      },
      session,
    );
    return { ticketId: String(ticket._id), number, warranty: decision.state, billable };
  });
}

/* ------------------------------ Lifecycle ------------------------------- */

function canWork(ticket: Pick<ITicket, "assignedTo">, actor: TicketActor): boolean {
  return actor.role !== "technician" || Boolean(ticket.assignedTo?.id.equals(actor.id));
}

/** Book (or rebook) the service visit; it appears on the technician's calendar and My work. */
export async function assignTicket(input: AssignTicketInput, actor: Actor) {
  return withTransaction(async (session) => {
    const ticket = await Ticket.findById(input.ticketId).session(session);
    if (!ticket) throw notFoundError("Ticket");
    if (!["open", "assigned", "in_progress"].includes(ticket.status)) throw new AppError("INVALID_STATE", "Reopen the ticket before booking another visit.");
    const tech = await User.findOne({ _id: input.technicianId, role: "technician", active: true }).select("name").session(session).lean();
    if (!tech) throw new AppError("VALIDATION", "Pick an active technician.", { technicianId: "Pick an active technician" });
    const visitAt = fromISTInput(input.visitAt);

    const existing = ticket.jobId ? await Job.findById(ticket.jobId).session(session) : null;
    if (existing && existing.status === "scheduled") {
      existing.scheduledFor = visitAt;
      existing.technicianIds = [tech._id];
      existing.leadTechnicianId = tech._id;
      await existing.save({ session });
    } else {
      const customer = await Customer.findById(ticket.customerId).select("address").session(session).lean();
      if (!customer) throw notFoundError("Customer");
      const jobNumber = await nextNumber("job", session);
      const [job] = await Job.create(
        [
          {
            number: jobNumber,
            type: "service",
            ticketId: ticket._id,
            orderId: ticket.orderId,
            customerId: ticket.customerId,
            title: `Service: ${TICKET_CATEGORY_LABELS[ticket.category]}`,
            siteAddress: customer.address,
            scheduledFor: visitAt,
            estimatedHours: 2,
            technicianIds: [tech._id],
            leadTechnicianId: tech._id,
            status: "scheduled",
          },
        ],
        { session },
      );
      ticket.jobId = job._id;
    }
    if (ticket.status !== "in_progress") ticket.status = "assigned";
    ticket.assignedTo = { id: tech._id, name: tech.name };
    await ticket.save({ session });
    await logActivity(
      { entityType: "ticket", entityId: ticket._id, customerId: ticket.customerId, action: "assigned", message: `Visit booked with ${tech.name} for ${formatDateTime(visitAt)}`, actor },
      session,
    );
    return { number: ticket.number, technician: tech.name };
  });
}

export async function startTicket(ticketId: string, actor: TicketActor) {
  return withTransaction(async (session) => {
    const now = new Date();
    const ticket = await Ticket.findById(ticketId).session(session);
    if (!ticket) throw notFoundError("Ticket");
    if (!canWork(ticket, actor)) throw new AppError("FORBIDDEN", "Only the assigned technician can start this ticket.");
    assertTransition("ticket", TICKET_FLOW, ticket.status, "in_progress");
    ticket.status = "in_progress";
    await ticket.save({ session });
    if (ticket.jobId) await Job.updateOne({ _id: ticket.jobId, status: "scheduled" }, { $set: { status: "in_progress", startedAt: now } }, { session });
    await logActivity({ entityType: "ticket", entityId: ticket._id, customerId: ticket.customerId, action: "started", message: `Work started by ${actor.name}`, actor, at: now }, session);
    return { number: ticket.number };
  });
}

/** BR-05: support or the director can change billability before resolution — never silently. */
export async function overrideBilling(input: BillingOverrideInput, actor: Actor) {
  await connectDB();
  const ticket = await Ticket.findById(input.ticketId);
  if (!ticket) throw notFoundError("Ticket");
  if (!["open", "assigned", "in_progress"].includes(ticket.status)) throw new AppError("INVALID_STATE", "Billing can only change before the ticket is resolved.");
  if (ticket.billable === input.billable) throw new AppError("INVALID_STATE", `This ticket is already ${input.billable ? "billable" : "free of charge"}.`);
  ticket.billable = input.billable;
  ticket.billingOverride = { billable: input.billable, reason: input.reason, by: actorRef(actor), at: new Date() };
  await ticket.save();
  await logActivity({
    entityType: "ticket",
    entityId: ticket._id,
    customerId: ticket.customerId,
    action: "billing_override",
    message: `Marked ${input.billable ? "billable" : "free of charge"}: ${input.reason}`,
    actor,
  });
  return { number: ticket.number };
}

export async function resolveTicket(input: ResolveTicketInput, actor: TicketActor, opts: { at?: Date } = {}) {
  return withTransaction(async (session) => {
    const now = opts.at ?? new Date();
    const ticket = await Ticket.findById(input.ticketId).session(session);
    if (!ticket) throw notFoundError("Ticket");
    if (!canWork(ticket, actor)) throw new AppError("FORBIDDEN", "Only the assigned technician can resolve this ticket.");
    assertTransition("ticket", TICKET_FLOW, ticket.status, "resolved");

    const invoiceLines: InvoiceLineInput[] = [];
    let costPaise = 0;

    // Parts fitted: bulk stock items.
    const partsUsed: ITicketPart[] = [];
    if (input.parts.length) {
      const products = await Product.find({ _id: { $in: input.parts.map((p) => p.productId) }, isSerialized: false, category: { $ne: "service" } }).session(session).lean();
      const byId = new Map(products.map((p) => [String(p._id), p]));
      for (const part of input.parts) {
        const product = byId.get(part.productId);
        if (!product) throw new AppError("VALIDATION", "Parts must be bulk stock items. Use Replacement for a serial-tracked unit.", { parts: "Pick bulk stock items" });
        await moveStock({ productId: product._id, qty: -part.qty, type: "service_issue", refType: "ticket", refId: ticket._id, refNumber: ticket.number, note: "Part fitted on service visit", actor, at: now }, session);
        partsUsed.push({ productId: product._id, sku: product.sku, name: product.name, qty: part.qty, unitPricePaise: product.pricePaise, unitCostPaise: product.costPaise, gstRate: product.gstRate, hsn: product.hsn });
        invoiceLines.push({ description: product.name, hsn: product.hsn, qty: part.qty, unitPricePaise: product.pricePaise, gstRate: product.gstRate });
        costPaise += part.qty * product.costPaise;
      }
    }

    // Replacement unit (BR-15): same product, from stock; warranty inherited when covered, fresh when paid.
    let replacementSerial: string | undefined;
    if (input.type === "replacement") {
      if (!ticket.serialUnitId) throw new AppError("VALIDATION", "A replacement needs the faulty unit's serial on the ticket.", { replacementSerial: "No faulty serial on this ticket" });
      const old = await SerialUnit.findById(ticket.serialUnitId).session(session);
      const fresh = await SerialUnit.findOne({ serial: input.replacementSerial }).session(session);
      if (!old) throw notFoundError("Faulty unit");
      if (!fresh) throw new AppError("VALIDATION", `${input.replacementSerial} isn't in the serial register.`, { replacementSerial: "Not in the serial register" });
      if (fresh.status !== "in_stock") throw new AppError("VALIDATION", `${fresh.serial} isn't in stock.`, { replacementSerial: "Not in stock" });
      if (!fresh.productId.equals(old.productId)) {
        throw new AppError("VALIDATION", `${fresh.serial} is a ${fresh.productName}; the faulty unit is a ${old.productName}.`, { replacementSerial: "Must be the same product" });
      }
      const product = await Product.findById(old.productId).session(session).lean();
      await moveStock({ productId: fresh.productId, qty: -1, type: "service_issue", serials: [fresh.serial], refType: "ticket", refId: ticket._id, refNumber: ticket.number, note: `Replaces ${old.serial}`, actor, at: now }, session);

      const inheritsCover = !ticket.billable && old.warrantyEndAt && old.warrantyEndAt.getTime() > now.getTime();
      const months = old.warrantyMonths || product?.warrantyMonths || 0;
      fresh.status = "installed";
      fresh.orderId = old.orderId;
      fresh.customerId = old.customerId;
      fresh.deliveredAt = now;
      fresh.warrantyStartAt = now;
      fresh.warrantyEndAt = inheritsCover ? old.warrantyEndAt : addMonths(now, months);
      fresh.warrantyMonths = months;
      fresh.replacesSerial = old.serial;
      fresh.history.push({ status: "installed", at: now, note: `Replaced ${old.serial} on ${ticket.number}${inheritsCover ? " (remaining warranty carried over)" : ""}`, by: actor.name });
      await fresh.save({ session });
      old.status = "replaced";
      old.replacedBySerial = fresh.serial;
      old.history.push({ status: "replaced", at: now, note: `Replaced by ${fresh.serial} on ${ticket.number}`, by: actor.name });
      await old.save({ session });

      replacementSerial = fresh.serial;
      costPaise += fresh.costPaise;
      if (product) invoiceLines.push({ description: `${product.name} (S/N ${fresh.serial}, replaces ${old.serial})`, hsn: product.hsn, qty: 1, unitPricePaise: product.pricePaise, gstRate: product.gstRate });
    }

    // Labour: billed at the service rate, costed at the technician's own rate.
    const technicianId = ticket.assignedTo?.id ?? toObjectId(actor.id);
    const tech = await User.findById(technicianId).select("name hourlyRatePaise").session(session).lean();
    costPaise += Math.round(input.labourHours * (tech?.hourlyRatePaise ?? 0));
    if (input.labourHours > 0) {
      invoiceLines.push({ description: `Service labour (${input.labourHours} h)`, hsn: SERVICE_SAC, qty: input.labourHours, unitPricePaise: SERVICE_LABOUR_RATE_RS * 100, gstRate: SERVICE_GST_RATE });
    }

    let invoiceNumber: string | undefined;
    let billedPaise = 0;
    if (ticket.billable && invoiceLines.length) {
      const invoice = await issueInvoice(
        { type: "service", customerId: ticket.customerId, orderId: ticket.orderId, ticketId: ticket._id, lines: invoiceLines, issuedAt: now, dueInDays: 7, notes: `Service ticket ${ticket.number}`, actor },
        session,
      );
      ticket.invoiceId = invoice._id;
      invoiceNumber = invoice.number;
      billedPaise = invoice.totalPaise;
    } else if (!ticket.billable && costPaise > 0) {
      ticket.serviceCostPaise = (ticket.serviceCostPaise ?? 0) + costPaise;
      if (ticket.orderId) {
        await Order.updateOne(
          { _id: ticket.orderId },
          { $push: { extraCosts: { label: `Warranty repair ${ticket.number} (${RESOLUTION_TYPE_LABELS[input.type].toLowerCase()})`, kind: "warranty", amountPaise: costPaise, at: now } } },
          { session },
        );
      }
    }

    ticket.resolution = {
      type: input.type,
      notes: input.notes,
      partsUsed,
      labourHours: input.labourHours,
      labourRatePaise: SERVICE_LABOUR_RATE_RS * 100,
      replacementSerial,
      resolvedAt: now,
      resolvedBy: actorRef(actor),
    };
    ticket.status = "resolved";
    await ticket.save({ session });

    if (ticket.jobId) {
      const job = await Job.findById(ticket.jobId).session(session);
      if (job && job.status !== "completed" && job.status !== "cancelled") {
        job.status = "completed";
        job.startedAt = job.startedAt ?? new Date(now.getTime() - input.labourHours * 3_600_000);
        job.finishedAt = now;
        job.notes = input.notes;
        if (input.labourHours > 0 && tech) job.timeLogs = [{ technicianId: tech._id, technicianName: tech.name, hours: input.labourHours, date: job.startedAt }];
        await job.save({ session });
      }
    }

    await logActivity(
      {
        entityType: "ticket",
        entityId: ticket._id,
        customerId: ticket.customerId,
        action: "resolved",
        message: `${RESOLUTION_TYPE_LABELS[input.type]}${replacementSerial ? ` with ${replacementSerial}` : ""}. ${
          invoiceNumber ? `Invoice ${invoiceNumber} for ${formatINR(billedPaise)}` : ticket.billable ? "Nothing to bill" : `₹0 to the customer (cost ${formatINR(costPaise)} charged to the installation)`
        } — waiting for the customer to confirm`,
        actor,
        at: now,
      },
      session,
    );
    return { number: ticket.number, invoiceNumber, billedPaise, costPaise, replacementSerial };
  });
}

/** BR-06: record who confirmed it works, how and when. */
export async function confirmTicket(input: ConfirmTicketInput, actor: Actor, opts: { at?: Date } = {}) {
  await connectDB();
  const now = opts.at ?? new Date();
  const ticket = await Ticket.findById(input.ticketId);
  if (!ticket) throw notFoundError("Ticket");
  assertTransition("ticket", TICKET_FLOW, ticket.status, "customer_confirmed");
  ticket.status = "customer_confirmed";
  ticket.customerConfirmedAt = now;
  ticket.confirmation = { confirmedBy: input.confirmedBy, channel: input.channel, note: input.note, recordedBy: actorRef(actor), at: now };
  await ticket.save();
  await logActivity({
    entityType: "ticket",
    entityId: ticket._id,
    customerId: ticket.customerId,
    action: "customer_confirmed",
    message: `${input.confirmedBy} confirmed it works (${CONFIRMATION_CHANNEL_LABELS[input.channel].toLowerCase()})${input.note ? `: ${input.note}` : ""}`,
    actor,
    at: now,
  });
  return { number: ticket.number };
}

export async function closeTicket(ticketId: string, actor: Actor, opts: { at?: Date } = {}) {
  await connectDB();
  const now = opts.at ?? new Date();
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw notFoundError("Ticket");
  if (ticket.status !== "customer_confirmed") {
    throw new AppError("INVALID_STATE", "A ticket closes only after the customer confirms everything works.");
  }
  ticket.status = "closed";
  ticket.closedAt = now;
  await ticket.save();
  await logActivity({ entityType: "ticket", entityId: ticket._id, customerId: ticket.customerId, action: "closed", message: "Closed", actor, at: now });
  return { number: ticket.number };
}

/** "Not fixed": back to In progress from resolved, confirmed or closed. */
export async function reopenTicket(ticketId: string, reason: string, actor: Actor) {
  await connectDB();
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw notFoundError("Ticket");
  assertTransition("ticket", TICKET_FLOW, ticket.status, "in_progress");
  ticket.status = "in_progress";
  ticket.reopenCount = (ticket.reopenCount ?? 0) + 1;
  ticket.closedAt = undefined;
  ticket.customerConfirmedAt = undefined;
  ticket.confirmation = undefined;
  await ticket.save();
  await logActivity({ entityType: "ticket", entityId: ticket._id, customerId: ticket.customerId, action: "reopened", message: `Not fixed — reopened: ${reason}`, actor });
  return { number: ticket.number };
}

/* --------------------------------- Reads -------------------------------- */

export async function listTickets(filter: { status?: string; q?: string; assignedTo?: string; page?: number; pageSize?: number }, now: Date) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.status === "open_all") query.status = { $nin: ["closed"] };
  else if (filter.status && (TICKET_STATUSES as readonly string[]).includes(filter.status)) query.status = filter.status;
  if (filter.assignedTo) query["assignedTo.id"] = toObjectId(filter.assignedTo);
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const digits = normalizePhone(q);
    const customers = await Customer.find({ $or: [{ name: rx }, ...(digits.length >= 4 ? [{ phone: { $regex: escapeRegex(digits) } }] : [])] }).select("_id").limit(100).lean();
    query.$or = [{ number: rx }, { serial: new RegExp(escapeRegex(q.toUpperCase())) }, { customerId: { $in: customers.map((c) => c._id) } }];
  }
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 20);
  const countQuery: Record<string, unknown> = { ...query };
  delete countQuery.status;

  const [rows, total, grouped] = await Promise.all([
    Ticket.find(query).sort({ status: 1, slaDueAt: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Ticket.countDocuments(query),
    Ticket.aggregate<{ _id: TicketStatus; n: number }>([{ $match: countQuery }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const customers = await Customer.find({ _id: { $in: rows.map((t) => t.customerId) } }).select("name address.city").lean();
  const customerById = new Map(customers.map((c) => [String(c._id), c]));
  const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n])) as Partial<Record<TicketStatus, number>>;

  return {
    items: rows.map((t) => ({
      id: String(t._id),
      number: t.number,
      status: t.status,
      priority: t.priority,
      category: t.category,
      serial: t.serial,
      productName: t.productName,
      customerName: customerById.get(String(t.customerId))?.name ?? "—",
      city: customerById.get(String(t.customerId))?.address.city ?? "",
      warranty: t.warranty.state,
      billable: t.billable,
      assignedTo: t.assignedTo?.name,
      createdAt: t.createdAt,
      slaDueAt: t.slaDueAt,
      overdue: !["resolved", "customer_confirmed", "closed"].includes(t.status) && t.slaDueAt.getTime() < now.getTime(),
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
    openCount: Object.entries(counts).filter(([s]) => s !== "closed").reduce((n, [, c]) => n + (c ?? 0), 0),
  };
}

export async function getTicketDetail(id: string, now: Date) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const t = await Ticket.findById(id).lean();
  if (!t) return null;
  const [customer, order, unit, job, invoice, parts] = await Promise.all([
    Customer.findById(t.customerId).select("name phone address discom").lean(),
    t.orderId ? Order.findById(t.orderId).select("number title commissionedAt").lean() : null,
    t.serialUnitId ? SerialUnit.findById(t.serialUnitId).lean() : null,
    t.jobId ? Job.findById(t.jobId).select("number status scheduledFor technicianIds").lean() : null,
    t.invoiceId ? Invoice.findById(t.invoiceId).select("number totalPaise paidPaise status").lean() : null,
    Product.find({ active: true, isSerialized: false, category: { $ne: "service" } }).select("sku name unit pricePaise costPaise stockQty").sort({ name: 1 }).lean(),
  ]);
  const replacements = unit
    ? await SerialUnit.find({ productId: unit.productId, status: "in_stock" }).select("serial").sort({ serial: 1 }).limit(8).lean()
    : [];

  return {
    ticket: {
      id: String(t._id),
      number: t.number,
      status: t.status,
      priority: t.priority,
      category: t.category,
      channel: t.channel,
      faultCode: t.faultCode,
      description: t.description,
      serial: t.serial,
      productName: t.productName,
      warranty: t.warranty,
      warrantyInfo: getWarrantyInfo(t.warranty.endsAt ? new Date(0) : null, t.warranty.endsAt, now),
      billable: t.billable,
      billingOverride: t.billingOverride,
      assignedTo: t.assignedTo ? { id: String(t.assignedTo.id), name: t.assignedTo.name } : undefined,
      resolution: t.resolution,
      confirmation: t.confirmation,
      serviceCostPaise: t.serviceCostPaise ?? 0,
      reopenCount: t.reopenCount ?? 0,
      slaDueAt: t.slaDueAt,
      overdue: !["resolved", "customer_confirmed", "closed"].includes(t.status) && t.slaDueAt.getTime() < now.getTime(),
      createdAt: t.createdAt,
      createdBy: t.createdBy.name,
      closedAt: t.closedAt,
    },
    customer: customer ? { id: String(customer._id), name: customer.name, phone: customer.phone, address: customer.address, discom: customer.discom } : null,
    order: order ? { id: String(order._id), number: order.number, title: order.title, commissionedAt: order.commissionedAt } : null,
    unit: unit
      ? {
          serial: unit.serial,
          productName: unit.productName,
          status: unit.status,
          warrantyStartAt: unit.warrantyStartAt,
          warrantyEndAt: unit.warrantyEndAt,
          replacedBySerial: unit.replacedBySerial,
          history: unit.history.map((h) => ({ status: h.status, at: h.at, note: h.note, by: h.by })),
        }
      : null,
    job: job ? { id: String(job._id), number: job.number, status: job.status, scheduledFor: job.scheduledFor } : null,
    invoice: invoice ? { id: String(invoice._id), number: invoice.number, totalPaise: invoice.totalPaise, paidPaise: invoice.paidPaise, status: invoice.status } : null,
    parts: parts.map((p) => ({ id: String(p._id), sku: p.sku, name: p.name, unit: p.unit, pricePaise: p.pricePaise, stockQty: p.stockQty })),
    replacements: replacements.map((r) => r.serial),
  };
}

/** Every ticket matching the /service filters, flattened for the CSV export (F17). */
export async function exportTickets(filter: { status?: string; assignedTo?: string }, now: Date) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (!filter.status || filter.status === "open_all") query.status = { $nin: ["closed"] };
  else if ((TICKET_STATUSES as readonly string[]).includes(filter.status)) query.status = filter.status;
  if (filter.assignedTo && Types.ObjectId.isValid(filter.assignedTo)) query["assignedTo.id"] = toObjectId(filter.assignedTo);
  const rows = await Ticket.find(query).sort({ createdAt: -1 }).limit(5000).lean();
  const customers = await Customer.find({ _id: { $in: rows.map((t) => t.customerId) } }).select("name address.city").lean();
  const byId = new Map(customers.map((c) => [String(c._id), c]));
  return rows.map((t) => ({
    number: t.number,
    createdAt: t.createdAt,
    status: t.status,
    priority: t.priority,
    category: t.category,
    customer: byId.get(String(t.customerId))?.name ?? "",
    city: byId.get(String(t.customerId))?.address.city ?? "",
    serial: t.serial,
    product: t.productName,
    warranty: t.warranty.state,
    basis: t.warranty.basis,
    billable: t.billable,
    technician: t.assignedTo?.name,
    ageDays: Math.floor((now.getTime() - t.createdAt.getTime()) / 86_400_000),
    overdue: !["resolved", "customer_confirmed", "closed"].includes(t.status) && t.slaDueAt.getTime() < now.getTime(),
  }));
}
