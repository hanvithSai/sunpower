/**
 * Global ⌘K search (contract in src/lib/search.ts). Support types a phone
 * number (with or without +91, full or the last 4+ digits), a name, a serial
 * (full or last 4+ characters) or any document number and lands on the right
 * record. Results link where that role can act: support goes straight to
 * raising a ticket with the warranty already decided.
 */
import { statusMeta, type Role } from "@/lib/constants";
import { escapeRegex, formatPhone, normalizePhone } from "@/lib/format";
import type { SearchResult } from "@/lib/search";
import { getWarrantyInfo } from "@/lib/warranty";
import { connectDB } from "../db";
import { Customer, Invoice, Lead, Order, Quote, SerialUnit, Ticket } from "../models";

const PER_TYPE = 5;

/** Who may see which kind of record (admin sees everything). */
const VISIBLE: Record<SearchResult["type"], Role[]> = {
  customer: ["sales", "support"],
  lead: ["sales", "support"],
  quote: ["sales"],
  order: ["sales", "warehouse", "support"],
  serial: ["sales", "technician", "warehouse", "support"],
  ticket: ["support", "technician"],
  invoice: ["sales", "support"],
};

const can = (role: Role, type: SearchResult["type"]) => role === "admin" || VISIBLE[type].includes(role);

export async function searchRecords(raw: string, role: Role, now: Date): Promise<SearchResult[]> {
  await connectDB();
  const q = raw.trim().slice(0, 60);
  if (q.length < 2) return [];
  const rx = new RegExp(escapeRegex(q), "i");
  const looksLikePhone = /^[+\d\s()-]+$/.test(q);
  const digits = normalizePhone(q);
  const phoneRx = looksLikePhone && digits.length >= 4 ? new RegExp(escapeRegex(digits)) : null;
  const serialRx = new RegExp(escapeRegex(q.toUpperCase().replace(/\s+/g, "")));

  const [customers, leads, quotes, orders, serials, tickets, invoices] = await Promise.all([
    can(role, "customer") || can(role, "serial")
      ? Customer.find({ $or: [{ name: rx }, ...(phoneRx ? [{ phone: phoneRx }] : [])] }).select("name phone address.city").limit(PER_TYPE).lean()
      : [],
    can(role, "lead") ? Lead.find({ $or: [{ number: rx }, { name: rx }, ...(phoneRx ? [{ phone: phoneRx }] : [])] }).select("number name status city").sort({ createdAt: -1 }).limit(PER_TYPE).lean() : [],
    can(role, "quote") ? Quote.find({ number: rx }).select("number title status totalPaise").limit(PER_TYPE).lean() : [],
    can(role, "order") ? Order.find({ number: rx }).select("number title status customerId").limit(PER_TYPE).lean() : [],
    can(role, "serial") && q.length >= 3 ? SerialUnit.find({ serial: serialRx }).select("serial productName status customerId orderId warrantyStartAt warrantyEndAt").limit(PER_TYPE).lean() : [],
    can(role, "ticket") ? Ticket.find({ $or: [{ number: rx }, { serial: serialRx }] }).select("number status category customerId productName").sort({ createdAt: -1 }).limit(PER_TYPE).lean() : [],
    can(role, "invoice") ? Invoice.find({ number: rx }).select("number status totalPaise billTo.name").sort({ issuedAt: -1 }).limit(PER_TYPE).lean() : [],
  ]);

  // Names for serials and orders found without their customer.
  const missing = [...serials.map((s) => s.customerId), ...orders.map((o) => o.customerId), ...tickets.map((t) => t.customerId)].flatMap((id) => (id ? [id] : []));
  const owners = await Customer.find({ _id: { $in: missing } }).select("name address.city").lean();
  const ownerById = new Map(owners.map((c) => [String(c._id), c]));

  const results: SearchResult[] = [];

  if (can(role, "customer")) {
    for (const c of customers) {
      results.push({
        type: "customer",
        id: String(c._id),
        title: c.name,
        subtitle: `${formatPhone(c.phone)} · ${c.address.city}`,
        href: role === "sales" ? `/leads?q=${c.phone}` : `/service/new?customerId=${c._id}`,
      });
    }
  }
  for (const l of leads) {
    results.push({ type: "lead", id: String(l._id), title: `${l.number} · ${l.name}`, subtitle: l.city, href: `/leads/${l._id}`, badge: statusMeta("lead", l.status).label });
  }
  for (const qt of quotes) {
    results.push({ type: "quote", id: String(qt._id), title: qt.number, subtitle: qt.title, href: `/quotes/${qt._id}`, badge: statusMeta("quote", qt.status).label });
  }
  for (const o of orders) {
    const owner = ownerById.get(String(o.customerId));
    results.push({ type: "order", id: String(o._id), title: `${o.number} · ${owner?.name ?? ""}`, subtitle: o.title, href: `/orders/${o._id}`, badge: statusMeta("order", o.status).label });
  }
  for (const s of serials) {
    const owner = s.customerId ? ownerById.get(String(s.customerId)) : undefined;
    const href =
      role === "warehouse"
        ? `/inventory/serials?q=${s.serial}`
        : role === "sales"
          ? s.orderId
            ? `/orders/${s.orderId}`
            : null
          : s.customerId
            ? `/service/new?serial=${s.serial}`
            : role === "technician"
              ? null
              : `/inventory/serials?q=${s.serial}`;
    if (!href) continue;
    const warranty = s.warrantyEndAt ? getWarrantyInfo(s.warrantyStartAt, s.warrantyEndAt, now).label : statusMeta("serial", s.status).label;
    results.push({
      type: "serial",
      id: String(s._id),
      title: s.serial,
      subtitle: [s.productName, owner ? `${owner.name}, ${owner.address.city}` : null].filter(Boolean).join(" · "),
      href,
      badge: warranty,
    });
  }
  for (const t of tickets) {
    const owner = ownerById.get(String(t.customerId));
    results.push({ type: "ticket", id: String(t._id), title: `${t.number} · ${owner?.name ?? ""}`, subtitle: t.productName ?? undefined, href: `/service/${t._id}`, badge: statusMeta("ticket", t.status).label });
  }
  for (const inv of invoices) {
    results.push({ type: "invoice", id: String(inv._id), title: inv.number, subtitle: inv.billTo.name, href: `/invoices/${inv._id}`, badge: statusMeta("invoice", inv.status).label });
  }
  return results;
}
