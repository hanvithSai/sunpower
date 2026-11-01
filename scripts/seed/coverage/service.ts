/**
 * After-sales service across the installed base:
 *
 *   history   twelve months of tickets, every technician on at least one visit
 *             every month (so payroll shows service hours for everyone), all
 *             nine categories and five channels, repairs with parts, unit
 *             replacements, no-fault visits and phone advice, a few reopened;
 *             out-of-warranty and damage work billed (service invoices and
 *             payments, some still unpaid), in-warranty costs charged to the
 *             installation; spares and parts received in a monthly GRN
 *   live      today's desk: unassigned (one past SLA), visits booked today and
 *             this week, crews on site, fixes awaiting the customer's OK and
 *             confirmed ones waiting to close — every technician has one
 */
import { formatINR } from "@/lib/money";
import { Types } from "mongoose";
import {
  RESOLUTION_TYPE_LABELS,
  SERVICE_GST_RATE,
  SERVICE_LABOUR_RATE_RS,
  SERVICE_SAC,
  TICKET_CATEGORY_LABELS,
  TICKET_SLA_HOURS,
  type ConfirmationChannel,
  type ResolutionType,
  type TicketCategory,
  type TicketChannel,
  type TicketPriority,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { computeLine, summarize } from "@/lib/gst";
import { addMonths, workmanshipEnd } from "@/lib/warranty";
import { Activity, Customer, Invoice, Job, Order, Payment, Purchase, SerialUnit, StockMove, Ticket, type IOrder } from "@/server/models";
import { reserve, reserveInvoice, serialPrefix } from "../history";
import { seededPhone } from "../people";
import { Timeline, addDays, addHours, insertOpts, ist, pick, prng, reference, weighted, who, type Ctx, type Staff } from "./common";

/** The brief's live-demo customer (history.ts legacy spec 901). */
const SCENE_PHONE = seededPhone(901);

type Stage = "open" | "assigned" | "in_progress" | "resolved" | "customer_confirmed" | "closed";

const DESCRIPTIONS: Record<TicketCategory, string[]> = {
  no_power: ["No power since morning; inverter display is blank", "System tripped after a lightning storm", "Inverter not switching on after a grid outage"],
  fault_code: ["Inverter shows {code} and stops exporting", "{code} on the display every afternoon", "Inverter beeping with {code} after rain"],
  low_generation: ["Generation dropped from 14 to 9 units a day", "App shows fewer units than last month", "Generation is low in the afternoons"],
  physical_damage: ["Panel glass cracked — cricket ball from the next terrace", "Monkeys pulled the DC cable on the roof", "Hailstorm cracked one panel"],
  battery: ["Backup lasts only two hours now", "One battery is bulging", "Battery water-level warning on the PCU"],
  wiring_earthing: ["ACDB MCB trips in the afternoon", "Earth pit cover broken; resistance check needed", "Loose MC4 connector sparking on the roof"],
  structure: ["Water leaking at the structure anchor points after rain", "Structure leg rusting near the base", "Panels rattle in strong wind"],
  billing: ["Net-meter export is not reflected in the electricity bill", "DISCOM bill shows import only; export reading missing", "Wants the net-metering settlement explained"],
  other: ["Wants the inverter moved to the staircase wall", "Needs the monitoring app set up on a new phone", "Asking about adding two more panels"],
};

const PARTS_FOR: Partial<Record<TicketCategory, string[]>> = {
  no_power: ["SPR-SPD", "SPR-FUSE"],
  fault_code: ["SPR-FUSE", "SPR-FAN", "SPR-SPD"],
  low_generation: ["MC4-PAIR"],
  wiring_earthing: ["MC4-PAIR", "SPR-FUSE"],
  physical_damage: ["MC4-PAIR"],
};

const NOTES: Record<ResolutionType, string[]> = {
  repair: ["Replaced the blown part, tested generation and export", "Re-terminated the connections, sealed the box, tested", "Fixed on site and explained what happened to the customer"],
  replacement: ["Faulty unit swapped and tested; old unit returned to stores", "Replaced the unit and confirmed generation on the app"],
  no_fault: ["No fault found; grid voltage was high during the outage — reset and monitored", "Checked strings and inverter; readings normal, cleaned panels while on site"],
  advice: ["Explained the monthly panel-cleaning routine; generation back to normal", "Walked the customer through the net-meter readings on the bill", "Set up the monitoring app on the customer's phone"],
};

const SERVICE_CATS: readonly (readonly [TicketCategory, number])[] = [["fault_code", 22], ["no_power", 14], ["low_generation", 16], ["battery", 10], ["wiring_earthing", 12], ["billing", 6], ["other", 6], ["structure", 6], ["physical_damage", 8]];
const INSTALL_CATS: readonly (readonly [TicketCategory, number])[] = [["structure", 30], ["wiring_earthing", 25], ["physical_damage", 20], ["low_generation", 25]];

const priorityFor = (rand: () => number, c: TicketCategory): TicketPriority =>
  c === "no_power" ? (rand() < 0.6 ? "urgent" : "high") : c === "fault_code" || c === "battery" ? (rand() < 0.6 ? "high" : "medium") : c === "billing" || c === "other" ? "low" : rand() < 0.6 ? "medium" : "low";

function resolutionFor(rand: () => number, c: TicketCategory, hasUnit: boolean): ResolutionType {
  const table: Record<TicketCategory, readonly (readonly [ResolutionType, number])[]> = {
    no_power: [["repair", 6], ["replacement", 1], ["no_fault", 3]],
    fault_code: [["repair", 5], ["replacement", 2], ["no_fault", 2], ["advice", 1]],
    low_generation: [["advice", 4], ["repair", 3], ["no_fault", 3]],
    physical_damage: [["replacement", 6], ["repair", 4]],
    battery: [["repair", 5], ["replacement", 3], ["advice", 2]],
    wiring_earthing: [["repair", 1]],
    structure: [["repair", 1]],
    billing: [["advice", 8], ["no_fault", 2]],
    other: [["advice", 6], ["repair", 2], ["no_fault", 2]],
  };
  const r = weighted(rand, table[c]);
  return r === "replacement" && !hasUnit ? "repair" : r;
}

type Base = {
  orders: (Pick<IOrder, "_id" | "number" | "customerId" | "systemType" | "lines" | "commissionedAt"> & { legacy: boolean })[];
  units: Map<string, { _id: Types.ObjectId; serial: string; productId: Types.ObjectId; sku: string; productName: string; category: string; warrantyEndAt?: Date; warrantyMonths: number; costPaise: number; orderId: Types.ObjectId; customerId: Types.ObjectId }[]>;
  customers: Map<string, { name: string; phone: string; address: { line1: string; city: string; pincode: string; state: string; district?: string } }>;
};

export async function loadBase(): Promise<Base> {
  const orders = await Order.find({ status: { $in: ["commissioned", "closed"] }, commissionedAt: { $exists: true } }).select("number customerId systemType lines commissionedAt").lean();
  const [units, customers] = await Promise.all([
    SerialUnit.find({ status: "installed", orderId: { $in: orders.map((o) => o._id) } }).select("serial productId sku productName category warrantyEndAt warrantyMonths costPaise orderId customerId").lean(),
    Customer.find({ _id: { $in: orders.map((o) => o.customerId) } }).select("name phone address").lean(),
  ]);
  const byOrder = new Map<string, Base["units"] extends Map<string, infer V> ? V : never>();
  for (const u of units) byOrder.set(String(u.orderId), [...(byOrder.get(String(u.orderId)) ?? []), u as never]);
  const cutoff = Date.now() - 24 * 30.44 * 86_400_000;
  return {
    orders: orders.map((o) => ({ ...o, legacy: o.commissionedAt!.getTime() < cutoff })),
    units: byOrder,
    customers: new Map(customers.map((c) => [String(c._id), c as never])),
  };
}

export type TicketSpec = {
  stage: Stage;
  at: Date;
  tech?: Staff;
  category: TicketCategory;
  channel: TicketChannel;
  /** Visit offset from creation in hours (assigned and later), and how long on site. */
  visitAfterH?: number;
  hours?: number;
  phoneOnly?: boolean;
  reopen?: boolean;
  paid?: "paid" | "partial" | "unpaid";
  priority?: TicketPriority;
  /** The first invoice was voided (billed in error) and re-issued. */
  voidFirst?: boolean;
};

export class Builder {
  tickets: object[] = [];
  jobs: object[] = [];
  invoices: object[] = [];
  payments: { at: Date; doc: Record<string, unknown> }[] = [];
  spares: Record<string, unknown>[] = [];
  replaced: { id: Types.ObjectId; serial: string; spare: string; at: Date; by: string }[] = [];
  moves: object[] = [];
  /** Parts and spares issued per IST month, for the monthly service GRN. */
  issued = new Map<string, Map<string, { qty: number; serials: string[] }>>();
  orderCosts: { orderId: Types.ObjectId; label: string; amountPaise: number; at: Date }[] = [];
  t = new Timeline();
  used = new Set<string>();
  private spareSeq = new Map<string, number>();
  constructor(
    private ctx: Ctx,
    private base: Base,
    private rand: () => number,
  ) {}

  private monthKey = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 7);
  private issue(at: Date, productId: string, qty: number, serial?: string) {
    const key = this.monthKey(at);
    const m = this.issued.get(key) ?? new Map();
    const e = m.get(productId) ?? { qty: 0, serials: [] };
    e.qty += qty;
    if (serial) e.serials.push(serial);
    m.set(productId, e);
    this.issued.set(key, m);
  }

  pickOrder(s: TicketSpec) {
    const wantUnit = { fault_code: "inverter", no_power: "inverter", battery: "battery", low_generation: "panel", physical_damage: "panel" }[s.category as string] as string | undefined;
    // The brief's scene (Venkata Ramana Rao's 18-month inverter) stays without a ticket for the live demo.
    const pool = this.base.orders.filter(
      (o) => o.commissionedAt!.getTime() < s.at.getTime() - 12 * 86_400_000 && (s.category !== "battery" || o.systemType === "off_grid") && this.base.customers.get(String(o.customerId))?.phone !== SCENE_PHONE,
    );
    // Inverter faults on the oldest installations come out of warranty (billable) about a third of the time.
    const legacy = pool.filter((o) => o.legacy);
    const choose = wantUnit === "inverter" && legacy.length && this.rand() < 0.35 ? legacy : pool;
    for (let tries = 0; tries < 40; tries++) {
      const o = pick(this.rand, choose);
      const units = (this.base.units.get(String(o._id)) ?? []).filter((u) => u.category === wantUnit && !this.used.has(u.serial));
      if (wantUnit && !units.length) continue;
      return { order: o, unit: wantUnit ? pick(this.rand, units) : undefined };
    }
    return { order: pick(this.rand, pool), unit: undefined };
  }

  build(s: TicketSpec, number: string) {
    const { ctx, rand, t } = this;
    const { order, unit } = this.pickOrder(s);
    const customer = this.base.customers.get(String(order.customerId))!;
    const support = who(ctx.support);
    const id = new Types.ObjectId();
    const code = pick(rand, ["E-22", "F-03", "E-07", "W-12"]);
    const description = pick(rand, DESCRIPTIONS[s.category]).replace("{code}", code);
    const priority = s.priority ?? priorityFor(rand, s.category);
    const workEnd = workmanshipEnd(order);
    const end = unit ? unit.warrantyEndAt : workEnd;
    const inWarranty = !end || s.at.getTime() <= end.getTime();
    const damage = s.category === "physical_damage";
    const billable = !inWarranty || damage || (s.category === "other" && !s.phoneOnly);
    const ticket: Record<string, unknown> = {
      _id: id,
      number,
      customerId: order.customerId,
      orderId: order._id,
      serial: unit?.serial,
      serialUnitId: unit?._id,
      productName: unit?.productName,
      category: s.category,
      faultCode: s.category === "fault_code" ? code : undefined,
      description,
      priority,
      channel: s.channel,
      status: s.stage,
      warranty: { state: inWarranty ? "in_warranty" : "out_of_warranty", basis: unit ? "serial" : "workmanship", endsAt: end, checkedAt: s.at },
      billable,
      serviceCostPaise: 0,
      reopenCount: 0,
      slaDueAt: addHours(s.at, TICKET_SLA_HOURS[priority]),
      createdBy: support,
      createdAt: s.at,
      updatedAt: s.at,
    };
    if (unit) this.used.add(unit.serial);
    this.tickets.push(ticket);
    const label = TICKET_CATEGORY_LABELS[s.category];
    t.add("ticket", id, order.customerId, "created", `${label}${unit ? ` on ${unit.serial}` : ""}: ${inWarranty ? `in warranty${end ? ` until ${end.toISOString().slice(0, 10)}` : ""} — free of charge` : "out of warranty — parts and labour will be billed"}`, s.at, support);
    if (damage) {
      ticket.billingOverride = { billable: true, reason: "Physical damage by a third party or weather is not covered by warranty", by: support, at: addHours(s.at, 0.2) };
      t.add("ticket", id, order.customerId, "billing_override", "Marked billable: physical damage is not covered by warranty", addHours(s.at, 0.2), support);
    }
    if (s.category === "other" && billable) {
      ticket.billingOverride = { billable: true, reason: "Customer request outside warranty scope (relocation / additions)", by: support, at: addHours(s.at, 0.2) };
    }
    if (s.stage === "open") return;

    // Visit booked (or worked over the phone by the desk).
    let tech = s.tech;
    const visitAt = addHours(s.at, s.visitAfterH ?? 4);
    let jobId: Types.ObjectId | undefined;
    let job: Record<string, unknown> | undefined;
    if (!s.phoneOnly && tech) {
      jobId = new Types.ObjectId();
      job = {
        _id: jobId,
        type: "service",
        ticketId: id,
        orderId: order._id,
        customerId: order.customerId,
        title: `Service: ${label}`,
        siteAddress: customer.address,
        scheduledFor: visitAt,
        estimatedHours: 2,
        technicianIds: [tech._id],
        leadTechnicianId: tech._id,
        status: "scheduled",
        checklist: { mounting: false, panels: false, wiring: false, earthing: false, inverter: false, testing: false },
        photos: [],
        timeLogs: [],
        materialsUsed: [],
        createdAt: addHours(s.at, 0.5),
        updatedAt: addHours(s.at, 0.5),
      };
      this.jobs.push(job);
      Object.assign(ticket, { jobId, assignedTo: who(tech), status: "assigned", updatedAt: addHours(s.at, 0.5) });
      t.add("ticket", id, order.customerId, "assigned", `Visit booked with ${tech.name} for ${formatDateTime(visitAt)}`, addHours(s.at, 0.5), support);
    } else tech = undefined;
    if (s.stage === "assigned") return;

    if (job) {
      Object.assign(job, { status: "in_progress", startedAt: visitAt, updatedAt: visitAt });
      Object.assign(ticket, { status: "in_progress", updatedAt: visitAt });
      t.add("ticket", id, order.customerId, "started", `${tech!.name} is on site`, visitAt, who(tech!));
    }
    if (s.stage === "in_progress") return;

    // Resolved: parts, a replacement unit, labour — billed or absorbed.
    const resolvedBy: Staff = tech ?? ctx.support;
    const type: ResolutionType = s.phoneOnly ? (rand() < 0.8 ? "advice" : "no_fault") : resolutionFor(rand, s.category, !!unit);
    const hours = s.phoneOnly ? 0 : (s.hours ?? Math.round((0.75 + rand() * 2.75) * 4) / 4);
    const resolvedAt = addHours(visitAt, s.phoneOnly ? 0.5 : hours);
    const invoiceLines: { description: string; hsn: string; qty: number; unitPricePaise: number; gstRate: number }[] = [];
    let cost = 0;
    const partsUsed: object[] = [];
    if (type === "repair" && PARTS_FOR[s.category]) {
      const p = ctx.bySku.get(pick(rand, PARTS_FOR[s.category]!))!;
      const qty = p.sku === "MC4-PAIR" ? 2 : 1;
      partsUsed.push({ productId: p._id, sku: p.sku, name: p.name, qty, unitPricePaise: p.pricePaise, unitCostPaise: p.costPaise, gstRate: p.gstRate, hsn: p.hsn });
      invoiceLines.push({ description: p.name, hsn: p.hsn, qty, unitPricePaise: p.pricePaise, gstRate: p.gstRate });
      cost += qty * p.costPaise;
      this.issue(resolvedAt, String(p._id), qty);
      this.moves.push({ productId: p._id, sku: p.sku, qty: -qty, type: "service_issue", serials: [], refType: "ticket", refId: id, refNumber: number, note: "Part fitted on service visit", by: who(resolvedBy), at: resolvedAt, createdAt: resolvedAt, updatedAt: resolvedAt });
    }
    let replacementSerial: string | undefined;
    if (type === "replacement" && unit) {
      const prod = ctx.byId.get(String(unit.productId))!;
      const prefix = `${serialPrefix(prod.sku)}-S${this.monthKey(resolvedAt).replace("-", "").slice(2)}`;
      const seq = (this.spareSeq.get(prefix) ?? 0) + 1;
      this.spareSeq.set(prefix, seq);
      replacementSerial = `${prefix}-${String(seq).padStart(4, "0")}`;
      const inherits = inWarranty && !billable;
      this.spares.push({
        serial: replacementSerial,
        productId: unit.productId,
        sku: unit.sku,
        productName: unit.productName,
        category: unit.category,
        status: "installed",
        costPaise: prod.costPaise,
        orderId: order._id,
        customerId: order.customerId,
        deliveredAt: resolvedAt,
        warrantyStartAt: resolvedAt,
        warrantyEndAt: inherits ? unit.warrantyEndAt : addMonths(resolvedAt, unit.warrantyMonths),
        warrantyMonths: unit.warrantyMonths,
        replacesSerial: unit.serial,
        history: [
          { status: "in_stock", at: ist(resolvedAt, 0), note: "Received (service spares)", by: ctx.keeper.name },
          { status: "installed", at: resolvedAt, note: `Replaced ${unit.serial} on ${number}${inherits ? " (remaining warranty carried over)" : ""}`, by: resolvedBy.name },
        ],
        createdAt: ist(resolvedAt, 0),
        updatedAt: resolvedAt,
      });
      this.replaced.push({ id: unit._id, serial: unit.serial, spare: replacementSerial, at: resolvedAt, by: resolvedBy.name });
      this.issue(resolvedAt, String(unit.productId), 1, replacementSerial);
      this.moves.push({ productId: unit.productId, sku: unit.sku, qty: -1, type: "service_issue", serials: [replacementSerial], refType: "ticket", refId: id, refNumber: number, note: `Replaces ${unit.serial}`, by: who(resolvedBy), at: resolvedAt, createdAt: resolvedAt, updatedAt: resolvedAt });
      invoiceLines.push({ description: `${prod.name} (S/N ${replacementSerial}, replaces ${unit.serial})`, hsn: prod.hsn, qty: 1, unitPricePaise: prod.pricePaise, gstRate: prod.gstRate });
      cost += prod.costPaise;
    }
    cost += Math.round(hours * resolvedBy.hourlyRatePaise);
    if (hours > 0) invoiceLines.push({ description: `Service labour (${hours} h)`, hsn: SERVICE_SAC, qty: hours, unitPricePaise: SERVICE_LABOUR_RATE_RS * 100, gstRate: SERVICE_GST_RATE });

    let note = `${RESOLUTION_TYPE_LABELS[type]}${replacementSerial ? ` with ${replacementSerial}` : ""}.`;
    if (billable && invoiceLines.length) {
      const invoiceId = new Types.ObjectId();
      const totals = summarize(invoiceLines);
      if (s.voidFirst) {
        const wrong = [...invoiceLines, { description: "Visit charge", hsn: SERVICE_SAC, qty: 1, unitPricePaise: 500_00, gstRate: SERVICE_GST_RATE }];
        this.invoices.push({
          _id: new Types.ObjectId(),
          number: `pending:${this.invoices.length}`,
          type: "service",
          customerId: order.customerId,
          orderId: order._id,
          ticketId: id,
          billTo: { name: customer.name, phone: customer.phone, address: [customer.address.line1, customer.address.city, `Telangana ${customer.address.pincode}`].join(", ") },
          lines: wrong.map((l) => ({ ...l, ...computeLine(l) })),
          ...summarize(wrong),
          paidPaise: 0,
          status: "void",
          issuedAt: resolvedAt,
          dueAt: addDays(resolvedAt, 7),
          notes: `Service ticket ${number}. Voided: a visit charge was added in error; re-issued without it`,
          createdAt: resolvedAt,
          updatedAt: addHours(resolvedAt, 2),
        });
        t.add("ticket", id, order.customerId, "invoice_voided", "Service invoice voided (visit charge added in error) and re-issued", addHours(resolvedAt, 2), support);
      }
      const invoiceNo = `pending:${this.invoices.length}`;
      const paid = s.paid ?? "paid";
      const paidPaise = paid === "paid" ? totals.totalPaise : paid === "partial" ? Math.round(totals.totalPaise / 2 / 100) * 100 : 0;
      this.invoices.push({
        _id: invoiceId,
        number: invoiceNo,
        type: "service",
        customerId: order.customerId,
        orderId: order._id,
        ticketId: id,
        billTo: { name: customer.name, phone: customer.phone, address: [customer.address.line1, customer.address.city, `Telangana ${customer.address.pincode}`].join(", ") },
        lines: invoiceLines.map((l) => ({ ...l, ...computeLine(l) })),
        ...totals,
        paidPaise,
        status: paid === "paid" ? "paid" : paid === "partial" ? "partially_paid" : "issued",
        issuedAt: resolvedAt,
        dueAt: addDays(resolvedAt, 7),
        notes: `Service ticket ${number}`,
        createdAt: resolvedAt,
        updatedAt: resolvedAt,
      });
      ticket.invoiceId = invoiceId;
      if (paidPaise > 0) {
        const payAt = addHours(resolvedAt, 1 + rand() * 30);
        const mode = pick(rand, ["upi", "upi", "cash", "card"] as const);
        this.payments.push({ at: payAt, doc: { customerId: order.customerId, orderId: order._id, invoiceId, ticketId: id, amountPaise: paidPaise, mode, type: "service", reference: mode === "cash" ? undefined : reference(rand, mode === "card" ? "POS" : "UPI"), receivedAt: payAt, recordedBy: support } });
      }
      note += ` Billed ${formatINR(totals.totalPaise)}`;
    } else if (cost > 0) {
      ticket.serviceCostPaise = cost;
      this.orderCosts.push({ orderId: order._id, label: `Warranty repair ${number} (${RESOLUTION_TYPE_LABELS[type].toLowerCase()})`, amountPaise: cost, at: resolvedAt });
      note += ` ₹0 to the customer (cost ${formatINR(cost)} charged to the installation)`;
    }
    ticket.resolution = { type, notes: pick(rand, NOTES[type]), partsUsed, labourHours: hours, labourRatePaise: SERVICE_LABOUR_RATE_RS * 100, replacementSerial, resolvedAt, resolvedBy: who(resolvedBy) };
    Object.assign(ticket, { status: "resolved", updatedAt: resolvedAt });
    if (job) {
      Object.assign(job, {
        status: "completed",
        finishedAt: resolvedAt,
        notes: (ticket.resolution as { notes: string }).notes,
        timeLogs: hours > 0 ? [{ technicianId: tech!._id, technicianName: tech!.name, hours, date: visitAt }] : [],
        completedBy: tech!._id,
        updatedAt: resolvedAt,
      });
    }
    t.add("ticket", id, order.customerId, "resolved", `${note} — waiting for the customer to confirm`, resolvedAt, who(resolvedBy));
    if (s.stage === "resolved") return;

    let confirmAt = addHours(resolvedAt, 2 + rand() * 26);
    if (s.reopen) {
      const backAt = addHours(resolvedAt, 30);
      ticket.reopenCount = 1;
      t.add("ticket", id, order.customerId, "reopened", "Reopened: the customer called back — the problem returned the next day", backAt, support);
      t.add("ticket", id, order.customerId, "resolved", "Second visit: replaced the connector properly and load-tested for an hour", addHours(backAt, 20), who(resolvedBy));
      confirmAt = addHours(backAt, 30);
    }
    const channel: ConfirmationChannel = pick(rand, ["call", "whatsapp", "on_site"] as const);
    Object.assign(ticket, { status: "customer_confirmed", customerConfirmedAt: confirmAt, confirmation: { confirmedBy: customer.name, channel, recordedBy: support, at: confirmAt }, updatedAt: confirmAt });
    t.add("ticket", id, order.customerId, "confirmed", `${customer.name} confirmed it works (${channel === "call" ? "phone call" : channel === "whatsapp" ? "WhatsApp" : "on site"})`, confirmAt, support);
    if (s.stage === "customer_confirmed") return;

    const closedAt = addHours(confirmAt, 0.5 + rand() * 4);
    Object.assign(ticket, { status: "closed", closedAt, updatedAt: closedAt });
    t.add("ticket", id, order.customerId, "closed", "Closed after the customer confirmed", closedAt, support);
  }

  async flush(ticketNos: string[], jobNos: string[]) {
    const { ctx } = this;
    this.tickets.forEach((tk, i) => ((tk as Record<string, unknown>).number = ticketNos[i]));
    this.jobs.forEach((j, i) => ((j as Record<string, unknown>).number = jobNos[i]));
    for (const inv of this.invoices as Record<string, unknown>[]) inv.number = await reserveInvoice(inv.issuedAt as Date);
    const payNos = await reserve("SP-PAY", this.payments.length);
    const payments = this.payments.sort((a, b) => a.at.getTime() - b.at.getTime()).map((p, k) => ({ ...p.doc, number: payNos[k], createdAt: p.at, updatedAt: p.at }));
    // Monthly service-spares receipt: exactly what was issued, so stock levels are unchanged.
    const months = [...this.issued.entries()].sort(([a], [b]) => a.localeCompare(b));
    const grnNos = await reserve("SP-GRN", months.length);
    const purchases = months.map(([key, m], k) => {
      const pid = new Types.ObjectId();
      const receivedAt = ist(new Date(`${key}-02T00:00:00Z`), 11);
      const lines = [...m.entries()].map(([productId, e]) => {
        const p = ctx.byId.get(productId)!;
        return { productId: p._id, sku: p.sku, name: p.name, qty: e.qty, unitCostPaise: p.costPaise, serials: e.serials };
      });
      for (const l of lines) this.moves.push({ productId: l.productId, sku: l.sku, qty: l.qty, type: "purchase", serials: l.serials, refType: "purchase", refId: pid, refNumber: grnNos[k], note: "Service spares", by: who(ctx.keeper), at: receivedAt, createdAt: receivedAt, updatedAt: receivedAt });
      for (const sp of this.spares) if (l2(sp)) sp.purchaseId = pid;
      function l2(sp: Record<string, unknown>) {
        return lines.some((l) => l.serials.includes(sp.serial as string));
      }
      return { _id: pid, number: grnNos[k], supplier: { name: "Sri Venkateswara Solar Distributors", gstin: "36ABCFS7214K1Z8" }, invoiceNo: `SVSD/S/${key}`, invoiceDate: addDays(receivedAt, -1), lines, totalPaise: lines.reduce((s, l) => s + l.qty * l.unitCostPaise, 0), receivedAt, receivedBy: who(ctx.keeper), notes: "Service spares and parts for the month", createdAt: receivedAt, updatedAt: receivedAt };
    });
    // Spares arrive with the month's receipt; their first history entry is that date.
    for (const sp of this.spares) {
      const p = purchases.find((x) => String(x._id) === String(sp.purchaseId));
      if (p) {
        (sp.history as { at: Date }[])[0]!.at = p.receivedAt;
        sp.createdAt = p.receivedAt;
      }
    }

    await Promise.all([
      Ticket.insertMany(this.tickets, insertOpts),
      Job.insertMany(this.jobs, insertOpts),
      Invoice.insertMany(this.invoices, insertOpts),
      Payment.insertMany(payments, insertOpts),
      SerialUnit.insertMany(this.spares, insertOpts),
      StockMove.insertMany(this.moves, insertOpts),
      Purchase.insertMany(purchases, insertOpts),
      Activity.insertMany(this.t.docs, insertOpts),
    ]);
    if (this.replaced.length) {
      await SerialUnit.bulkWrite(
        this.replaced.map((r) => ({
          updateOne: { filter: { _id: r.id }, update: { $set: { status: "replaced", replacedBySerial: r.spare }, $push: { history: { status: "replaced", at: r.at, note: `Replaced by ${r.spare}`, by: r.by } } } },
        })),
      );
    }
    if (this.orderCosts.length) {
      await Order.bulkWrite(this.orderCosts.map((c) => ({ updateOne: { filter: { _id: c.orderId }, update: { $push: { extraCosts: { label: c.label, kind: "warranty", amountPaise: c.amountPaise, at: c.at } } } } })));
    }
    return { purchases: purchases.length, invoices: this.invoices.length, payments: payments.length, replacements: this.replaced.length };
  }
}

/* ------------------------------------------------------------------ */

const channelFor = (rand: () => number): TicketChannel => weighted(rand, [["phone", 35], ["whatsapp", 30], ["portal", 15], ["email", 10], ["walk_in", 10]] as const);

export async function seedServiceHistory(ctx: Ctx): Promise<string> {
  const rand = prng(55005);
  const base = await loadBase();
  const b = new Builder(ctx, base, rand);
  const specs: TicketSpec[] = [];
  const now = ctx.now;
  const earliest = addDays(now, -365);
  const latest = addDays(now, -7);
  for (let m = 12; m >= 0; m--) {
    const ist0 = new Date(now.getTime() + 330 * 60_000);
    const start = new Date(Date.UTC(ist0.getUTCFullYear(), ist0.getUTCMonth() - m, 1) - 330 * 60_000);
    const end = new Date(Date.UTC(ist0.getUTCFullYear(), ist0.getUTCMonth() - m + 1, 1) - 330 * 60_000);
    const from = Math.max(start.getTime(), earliest.getTime());
    const to = Math.min(end.getTime(), latest.getTime());
    if (to - from < 2 * 86_400_000) continue;
    // Visits land inside the month (booked within a day), so each month's payroll has them.
    const day = () => ist(new Date(from + rand() * (to - from - 2 * 86_400_000)), 9 + rand() * 6);
    // One visit per technician per month, by their skills; plus desk tickets solved over the phone.
    for (const tech of ctx.techs) {
      const category = weighted(rand, tech.skills.includes("service") ? SERVICE_CATS : INSTALL_CATS);
      specs.push({ stage: "closed", at: day(), tech, category, channel: channelFor(rand), visitAfterH: 3 + rand() * 20, reopen: rand() < 0.05, paid: rand() < 0.08 ? "unpaid" : rand() < 0.06 ? "partial" : "paid" });
    }
    if (m === 3) specs.push({ stage: "closed", at: day(), tech: ctx.servicers[0], category: "physical_damage", channel: "phone", visitAfterH: 20, voidFirst: true });
    for (let k = 0; k < 3; k++) specs.push({ stage: "closed", at: day(), category: pick(rand, ["billing", "billing", "other", "low_generation"] as const), channel: channelFor(rand), phoneOnly: true });
  }
  specs.sort((a, b) => a.at.getTime() - b.at.getTime());
  const [ticketNos, jobNos] = await Promise.all([reserve("SP-T", specs.length), reserve("SP-J", specs.filter((s) => !s.phoneOnly && s.tech).length)]);
  specs.forEach((s, i) => b.build(s, ticketNos[i]!));
  const r = await b.flush(ticketNos, jobNos);
  const cats = new Map<string, number>();
  for (const s of specs) cats.set(s.category, (cats.get(s.category) ?? 0) + 1);
  return `Service history: ${specs.length} closed tickets over 12 months (${[...cats.entries()].map(([c, n]) => `${c} ${n}`).join(", ")}), ${r.invoices} service invoices, ${r.payments} service payments, ${r.replacements} unit replacements, ${r.purchases} spares GRNs`;
}

export async function seedLiveTickets(ctx: Ctx): Promise<string> {
  const rand = prng(56006);
  const base = await loadBase();
  const b = new Builder(ctx, base, rand);
  const now = ctx.now;
  const techs = ctx.techs;
  const sv = (k: number) => ctx.servicers[k % ctx.servicers.length]!;
  const ago = (h: number) => addHours(now, -h);
  const specs: TicketSpec[] = [
    // Unassigned: one urgent already past its 4-hour SLA.
    { stage: "open", at: ago(6), category: "no_power", channel: "phone", priority: "urgent" },
    { stage: "open", at: ago(1.5), category: "low_generation", channel: "portal" },
    { stage: "open", at: ago(0.6), category: "billing", channel: "email" },
    { stage: "open", at: ago(26), category: "structure", channel: "whatsapp" },
    { stage: "open", at: ago(3), category: "other", channel: "walk_in" },
  ];
  // Every technician has something on the desk: visits booked today and this week, crews on site, fixes awaiting OK.
  const stages: Stage[] = ["assigned", "assigned", "assigned", "assigned", "assigned", "assigned", "assigned", "in_progress", "in_progress", "in_progress", "resolved", "resolved", "resolved", "customer_confirmed", "customer_confirmed"];
  techs.forEach((tech, i) => {
    const stage = stages[i % stages.length]!;
    const category = weighted(rand, tech.skills.includes("service") ? SERVICE_CATS : INSTALL_CATS);
    const visitIn = [2, 5, 20, 28, 44, 70, 96][i % 7]!;
    if (stage === "assigned") specs.push({ stage, at: ago(3 + i), tech, category, channel: channelFor(rand), visitAfterH: 3 + i + visitIn });
    else if (stage === "in_progress") specs.push({ stage, at: ago(5 + i), tech, category, channel: channelFor(rand), visitAfterH: 3.5 + i * 0.2 });
    else specs.push({ stage, at: ago(30 + i * 3), tech, category, channel: channelFor(rand), visitAfterH: 18, hours: 1.5 + (i % 3) * 0.5, paid: i % 2 ? "unpaid" : "paid" });
  });
  specs.push({ stage: "resolved", at: ago(28), tech: sv(1), category: "fault_code", channel: "phone", visitAfterH: 20, hours: 2, paid: "unpaid" });
  specs.push({ stage: "customer_confirmed", at: ago(50), category: "billing", channel: "whatsapp", phoneOnly: true });
  specs.sort((a, c) => a.at.getTime() - c.at.getTime());
  const [ticketNos, jobNos] = await Promise.all([reserve("SP-T", specs.length), reserve("SP-J", specs.filter((s) => !s.phoneOnly && s.tech && s.stage !== "open").length)]);
  specs.forEach((s, i) => b.build(s, ticketNos[i]!));
  await b.flush(ticketNos, jobNos);
  const by = (st: Stage) => specs.filter((s) => s.stage === st).length;
  return `Live tickets: ${specs.length} (open ${by("open")}, visit booked ${by("assigned")}, on site ${by("in_progress")}, awaiting confirmation ${by("resolved")}, confirmed ${by("customer_confirmed")}) across all ${techs.length} technicians`;
}
