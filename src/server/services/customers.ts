/**
 * Customers are deduplicated by mobile number — the key support uses to find
 * someone in seconds. Every enquiry creates or reuses a customer here, so the
 * whole history (quotes, orders, serials, tickets) hangs off one record.
 */
import { Types, type ClientSession } from "mongoose";
import type { CustomerType, OrderStatus } from "@/lib/constants";
import { escapeRegex, normalizePhone } from "@/lib/format";
import { getWarrantyInfo, workmanshipEnd } from "@/lib/warranty";
import { connectDB } from "../db";
import { Customer, Invoice, Lead, Order, Payment, Quote, SerialUnit, Ticket, type ICustomer } from "../models";

export type CustomerContact = {
  name: string;
  phone: string;
  email?: string;
  city: string;
  pincode: string;
  addressLine?: string;
  customerType?: CustomerType;
  gstin?: string;
};

/** DISCOM by service area: TSNPDCL covers north Telangana, TSSPDCL the south incl. Hyderabad. */
const NORTH_DISCOM_CITIES = /warangal|hanamkonda|karimnagar|nizamabad|khammam|adilabad|mancherial|jagtial|peddapalli|kamareddy|siddipet/i;

export function discomForCity(city: string): "TSSPDCL" | "TSNPDCL" {
  return NORTH_DISCOM_CITIES.test(city) ? "TSNPDCL" : "TSSPDCL";
}

export async function upsertCustomerByPhone(
  input: CustomerContact,
  session?: ClientSession,
): Promise<{ customer: ICustomer; created: boolean }> {
  const existing = await Customer.findOne({ phone: input.phone }).session(session ?? null);
  if (existing) {
    // Keep the original record; only fill gaps (e.g. an email or GSTIN given on a later enquiry).
    let changed = false;
    if (input.email && !existing.email) {
      existing.email = input.email;
      changed = true;
    }
    if (input.gstin && !existing.gstin) {
      existing.gstin = input.gstin;
      changed = true;
    }
    if (changed) await existing.save({ session });
    return { customer: existing.toObject(), created: false };
  }

  const [customer] = await Customer.create(
    [
      {
        name: input.name,
        phone: input.phone,
        email: input.email,
        type: input.customerType ?? "residential",
        gstin: input.gstin,
        address: {
          line1: input.addressLine || input.city,
          city: input.city,
          state: "Telangana",
          pincode: input.pincode,
        },
        discom: discomForCity(input.city),
      },
    ],
    { session },
  );
  return { customer: customer.toObject(), created: true };
}

/* ------------------------------ Customer 360 ----------------------------- */

export async function listCustomers(filter: { q?: string; type?: string; page?: number; pageSize?: number }) {
  await connectDB();
  const query: Record<string, unknown> = {};
  const q = filter.q?.trim();
  if (q) {
    const digits = normalizePhone(q);
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ name: rx }, { "address.city": rx }, ...(/^[+\d\s()-]+$/.test(q) && digits.length >= 4 ? [{ phone: new RegExp(escapeRegex(digits)) }] : [])];
  }
  if (filter.type === "residential" || filter.type === "commercial") query.type = filter.type;
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 25);
  const [rows, total] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Customer.countDocuments(query),
  ]);
  const ids = rows.map((c) => c._id);
  const [orders, tickets] = await Promise.all([
    Order.aggregate<{ _id: Types.ObjectId; n: number; kw: number; totalPaise: number; paidPaise: number; last: OrderStatus }>([
      { $match: { customerId: { $in: ids }, status: { $ne: "cancelled" } } },
      { $sort: { createdAt: 1 } },
      { $group: { _id: "$customerId", n: { $sum: 1 }, kw: { $sum: "$capacityKw" }, totalPaise: { $sum: "$totalPaise" }, paidPaise: { $sum: "$paidPaise" }, last: { $last: "$status" } } },
    ]),
    Ticket.aggregate<{ _id: Types.ObjectId; open: number }>([
      { $match: { customerId: { $in: ids }, status: { $ne: "closed" } } },
      { $group: { _id: "$customerId", open: { $sum: 1 } } },
    ]),
  ]);
  const orderBy = new Map(orders.map((o) => [String(o._id), o]));
  const ticketBy = new Map(tickets.map((t) => [String(t._id), t.open]));
  return {
    items: rows.map((c) => {
      const o = orderBy.get(String(c._id));
      return {
        id: String(c._id),
        name: c.name,
        phone: c.phone,
        city: c.address.city,
        type: c.type,
        orders: o?.n ?? 0,
        kw: o?.kw ?? 0,
        duePaise: o ? Math.max(0, o.totalPaise - o.paidPaise) : 0,
        lastOrderStatus: o?.last,
        openTickets: ticketBy.get(String(c._id)) ?? 0,
        since: c.createdAt,
      };
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * One customer and everything that hangs off them: enquiries and quotes,
 * orders with what is paid and due, every serial on their roof with its
 * warranty, the workmanship warranty, tickets, invoices and payments (R-01).
 */
export async function getCustomer360(id: string, now: Date) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const customer = await Customer.findById(id).lean();
  if (!customer) return null;
  const customerId = customer._id;
  const [leads, quotes, orders, units, tickets, invoices, payments] = await Promise.all([
    Lead.find({ customerId }).sort({ createdAt: -1 }).select("number status source requirement createdAt").lean(),
    Quote.find({ customerId }).sort({ createdAt: -1 }).select("number version status totalPaise capacityKw systemType createdAt").lean(),
    Order.find({ customerId })
      .sort({ createdAt: -1 })
      .select("number title status paymentStatus capacityKw systemType totalPaise paidPaise lines commissionedAt dispatch installationJobId subsidy createdAt")
      .lean(),
    SerialUnit.find({ customerId, status: { $in: ["dispatched", "installed", "replaced", "faulty"] } })
      .select("serial productName category status orderId deliveredAt warrantyStartAt warrantyEndAt replacedBySerial replacesSerial")
      .sort({ category: 1, serial: 1 })
      .lean(),
    Ticket.find({ customerId }).sort({ createdAt: -1 }).select("number status category priority serial productName warranty billable createdAt").lean(),
    Invoice.find({ customerId }).sort({ issuedAt: -1 }).select("number type status totalPaise paidPaise issuedAt dueAt").lean(),
    Payment.find({ customerId }).sort({ receivedAt: -1 }).select("number amountPaise mode type reference receivedAt orderId").lean(),
  ]);
  const orderNumber = new Map(orders.map((o) => [String(o._id), o.number]));
  const live = orders.filter((o) => o.status !== "cancelled");

  return {
    customer: {
      id: String(customerId),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: customer.type,
      address: customer.address,
      discom: customer.discom,
      consumerNumber: customer.consumerNumber,
      gstin: customer.gstin,
      since: customer.createdAt,
    },
    totals: {
      orders: live.length,
      kw: live.reduce((s, o) => s + o.capacityKw, 0),
      billedPaise: live.reduce((s, o) => s + o.totalPaise, 0),
      paidPaise: live.reduce((s, o) => s + o.paidPaise, 0),
      duePaise: live.reduce((s, o) => s + Math.max(0, o.totalPaise - o.paidPaise), 0),
      openTickets: tickets.filter((t) => t.status !== "closed").length,
      units: units.filter((u) => u.status !== "replaced").length,
      inWarranty: units.filter((u) => u.status !== "replaced" && (!u.warrantyEndAt || u.warrantyEndAt.getTime() >= now.getTime())).length,
    },
    leads: leads.map((l) => ({ id: String(l._id), number: l.number, status: l.status, source: l.source, capacityKw: l.requirement.capacityKw, createdAt: l.createdAt })),
    quotes: quotes.map((q) => ({ id: String(q._id), number: q.number, version: q.version, status: q.status, totalPaise: q.totalPaise, capacityKw: q.capacityKw, systemType: q.systemType, createdAt: q.createdAt })),
    orders: orders.map((o) => {
      const end = workmanshipEnd(o);
      return {
        id: String(o._id),
        number: o.number,
        title: o.title,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalPaise: o.totalPaise,
        paidPaise: o.paidPaise,
        deliveredAt: o.dispatch?.deliveredAt,
        commissionedAt: o.commissionedAt,
        jobId: o.installationJobId ? String(o.installationJobId) : undefined,
        subsidy: o.subsidy.applicable ? o.subsidy.status : undefined,
        workmanship: end ? getWarrantyInfo(o.commissionedAt, end, now) : undefined,
        createdAt: o.createdAt,
      };
    }),
    units: units.map((u) => ({
      id: String(u._id),
      serial: u.serial,
      productName: u.productName,
      category: u.category,
      status: u.status,
      orderId: u.orderId ? String(u.orderId) : undefined,
      orderNumber: u.orderId ? orderNumber.get(String(u.orderId)) : undefined,
      deliveredAt: u.deliveredAt,
      replacedBySerial: u.replacedBySerial,
      replacesSerial: u.replacesSerial,
      warranty: getWarrantyInfo(u.warrantyStartAt, u.warrantyEndAt, now),
    })),
    tickets: tickets.map((t) => ({
      id: String(t._id),
      number: t.number,
      status: t.status,
      category: t.category,
      priority: t.priority,
      serial: t.serial,
      productName: t.productName,
      warrantyState: t.warranty.state,
      billable: t.billable,
      createdAt: t.createdAt,
    })),
    invoices: invoices.map((i) => ({
      id: String(i._id),
      number: i.number,
      type: i.type,
      status: i.status,
      totalPaise: i.totalPaise,
      duePaise: Math.max(0, i.totalPaise - i.paidPaise),
      issuedAt: i.issuedAt,
      overdue: ["issued", "partially_paid"].includes(i.status) && i.dueAt.getTime() < now.getTime(),
    })),
    payments: payments.map((p) => ({
      id: String(p._id),
      number: p.number,
      amountPaise: p.amountPaise,
      mode: p.mode,
      type: p.type,
      reference: p.reference,
      receivedAt: p.receivedAt,
      orderNumber: p.orderId ? orderNumber.get(String(p.orderId)) : undefined,
    })),
  };
}
