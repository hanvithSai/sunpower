/**
 * Orders around the finished installations:
 *
 *   panel sets   a year of hardware-only sales: paid in full, dispatched with
 *                serials, delivered and so closed (no crew)
 *   cancelled    accepted quotes the customer walked away from before paying
 *   in flight    every stage five or more deep — awaiting payment, confirmed
 *                with installations booked across the next twelve weeks (some
 *                still waiting on DISCOM feasibility), packed, in transit,
 *                delivered and installing today — with this week's goods
 *                receipt sized so stock stays positive (a few items left low on
 *                purpose), and one commercial invoice voided and re-issued
 */
import { formatINR } from "@/lib/money";
import { Types } from "mongoose";
import { LEAD_SOURCE_LABELS, PAYMENT_MODE_LABELS, SYSTEM_TYPE_LABELS, type CustomerType, type LeadSource, type PaymentMode, type SubsidyStatus, type SystemType } from "@/lib/constants";
import { computeLine, summarize } from "@/lib/gst";
import { addMonths } from "@/lib/warranty";
import { Activity, Customer, Invoice, Job, Lead, Order, Payment, Product, Purchase, Quote, SerialUnit, StockMove, Survey, type ILineItem } from "@/server/models";
import { reserve, reserveInvoice, serialPrefix } from "../history";
import { seededPhone } from "../people";
import {
  BUSINESSES,
  PLACES,
  Timeline,
  addDays,
  addHours,
  customerDoc,
  gstinFor,
  insertOpts,
  ist,
  personName,
  photo,
  pick,
  placeOf,
  prng,
  quoteFigures,
  reference,
  surveyPhotos,
  weighted,
  who,
  workday,
  type Ctx,
  type Staff,
} from "./common";

type Stage = "pending_payment" | "confirmed" | "ready_to_dispatch" | "dispatched" | "delivered" | "installing" | "cancelled" | "closed";

type Plan = {
  stage: Stage;
  name: string;
  phone: string;
  type: CustomerType;
  gstin?: string;
  city: string;
  kw: number;
  systemType: SystemType;
  source: LeadSource;
  acceptedAt: Date;
  /** Day offset from today for the installation (confirmed and later). */
  installDay?: number;
  subsidy?: SubsidyStatus;
  fullPayment?: boolean;
  mode: PaymentMode;
  cancelReason?: string;
  voidInvoice?: boolean;
};

const CANCEL_REASONS = ["Customer moved to a rented flat before the advance", "Bank loan was not sanctioned", "Apartment society withdrew terrace permission", "Family decided to buy a second-hand inverter instead"];

const SUPPLIERS = [
  { name: "Waaree Energies Ltd", gstin: "27AAACW4285R1ZD" },
  { name: "Sri Venkateswara Solar Distributors", gstin: "36ABCFS7214K1Z8" },
  { name: "Deccan Electricals & Cables", gstin: "36AAGFD3381M1Z2" },
];

/** Monotonic per-run serial counter per prefix. */
class SerialMaker {
  private seq = new Map<string, number>();
  next(sku: string, tag: string): string {
    const prefix = `${serialPrefix(sku)}-${tag}`;
    const n = (this.seq.get(prefix) ?? 0) + 1;
    this.seq.set(prefix, n);
    return `${prefix}-${String(n).padStart(4, "0")}`;
  }
}

function ymd(d: Date): string {
  const i = new Date(d.getTime() + 330 * 60_000);
  return `${String(i.getUTCFullYear()).slice(2)}${String(i.getUTCMonth() + 1).padStart(2, "0")}${String(i.getUTCDate()).padStart(2, "0")}`;
}

function crewPicker(ctx: Ctx) {
  const busy = new Map<number, Set<string>>();
  let rot = 0;
  return (day: Date, size: number): Staff[] => {
    const key = ist(day, 0).getTime();
    const taken = busy.get(key) ?? new Set<string>();
    const crew: Staff[] = [];
    for (let k = 0; k < ctx.installers.length * 2 && crew.length < size; k++) {
      const t = ctx.installers[(rot + k) % ctx.installers.length]!;
      if (!taken.has(String(t._id))) {
        crew.push(t);
        taken.add(String(t._id));
      }
    }
    rot += size;
    busy.set(key, taken);
    return crew;
  };
}

/* ------------------------------------------------------------------ */

type Built = {
  customers: object[];
  leads: object[];
  surveys: object[];
  quotes: object[];
  orders: Record<string, unknown>[];
  jobs: object[];
  invoices: object[];
  payments: { at: Date; doc: Record<string, unknown> }[];
  units: Record<string, unknown>[];
  moves: object[];
  purchases: object[];
  t: Timeline;
};

const empty = (): Built => ({ customers: [], leads: [], surveys: [], quotes: [], orders: [], jobs: [], invoices: [], payments: [], units: [], moves: [], purchases: [], t: new Timeline() });

async function flush(b: Built) {
  const payNos = await reserve("SP-PAY", b.payments.length);
  const payments = b.payments.sort((x, y) => x.at.getTime() - y.at.getTime()).map((p, k) => ({ ...p.doc, number: payNos[k], createdAt: p.at, updatedAt: p.at }));
  await Customer.insertMany(b.customers, insertOpts);
  await Promise.all([
    Lead.insertMany(b.leads, insertOpts),
    Survey.insertMany(b.surveys, insertOpts),
    Quote.insertMany(b.quotes, insertOpts),
    Order.insertMany(b.orders, insertOpts),
    Job.insertMany(b.jobs, insertOpts),
    Invoice.insertMany(b.invoices, insertOpts),
    Payment.insertMany(payments, insertOpts),
    Purchase.insertMany(b.purchases, insertOpts),
    SerialUnit.insertMany(b.units, insertOpts),
    StockMove.insertMany(b.moves, insertOpts),
    Activity.insertMany(b.t.docs, insertOpts),
  ]);
}

/** Lead (won), approved survey and accepted quote behind an order. */
function front(ctx: Ctx, rand: () => number, b: Built, p: Plan, nos: { lead: string; survey: string; quote: string }, i: number, salesUser: Staff) {
  const leadAt = ist(addDays(p.acceptedAt, -(12 + Math.floor(rand() * 14))), 9 + rand() * 9);
  const customer = customerDoc(rand, { name: p.name, phone: p.phone, place: placeOf(p.city), type: p.type, gstin: p.gstin, at: leadAt });
  const f = quoteFigures(ctx, p.kw, p.systemType, p.type);
  const surveyor = ctx.surveyors[i % ctx.surveyors.length]!;
  const contactedAt = addHours(leadAt, 0.4 + rand() * 1.5);
  const qualifiedAt = addHours(contactedAt, 20);
  const surveyAt = ist(addDays(qualifiedAt, 2), 10.5);
  const reviewedAt = addHours(surveyAt, 24);
  const sentAt = addHours(reviewedAt, 3);
  const ids = { lead: new Types.ObjectId(), survey: new Types.ObjectId(), quote: new Types.ObjectId(), order: new Types.ObjectId() };
  b.customers.push(customer);
  b.leads.push({
    _id: ids.lead,
    number: nos.lead,
    customerId: customer._id,
    name: p.name,
    phone: p.phone,
    city: p.city,
    source: p.source,
    requirement: { capacityKw: p.kw, systemType: p.systemType, wantsSubsidy: p.type === "residential" && p.systemType === "on_grid", monthlyBillRs: 500 * p.kw + Math.floor(rand() * 900) },
    qualification: { roofAreaSqft: 190 * p.kw + 220, shadowFreeAreaSqft: 120 * p.kw + 70, monthlyBillRs: 500 * p.kw + 400, gridSuitable: true, roofType: p.type === "commercial" ? "metal_sheet" : "rcc", qualifiedAt, qualifiedBy: salesUser._id },
    status: "won",
    assignedTo: salesUser._id,
    firstContactedAt: contactedAt,
    lastActivityAt: p.acceptedAt,
    surveyId: ids.survey,
    quoteId: ids.quote,
    orderId: ids.order,
    createdAt: leadAt,
    updatedAt: p.acceptedAt,
  });
  b.surveys.push({
    _id: ids.survey,
    number: nos.survey,
    leadId: ids.lead,
    customerId: customer._id,
    technicianId: surveyor._id,
    scheduledFor: surveyAt,
    status: "approved",
    measurements: { roofDirection: pick(rand, ["S", "S", "SE", "SW"] as const), tiltDeg: 12 + Math.floor(rand() * 8), roofType: p.type === "commercial" ? "metal_sheet" : "rcc", usableAreaSqft: 110 * p.kw + 80, shadingPct: Math.floor(rand() * 8), cableDistanceM: 10 + Math.floor(rand() * 25), floors: 1 + Math.floor(rand() * 3), earthingPossible: true, recommendedKw: p.kw, recommendedSystemType: p.systemType },
    photos: surveyPhotos(ctx, i + 3, { commercial: p.type === "commercial" }),
    completedAt: addHours(surveyAt, 1.2),
    reviewedBy: salesUser._id,
    reviewedAt,
    createdAt: addHours(qualifiedAt, 1),
    updatedAt: reviewedAt,
  });
  b.quotes.push({
    _id: ids.quote,
    number: nos.quote,
    version: 1,
    leadId: ids.lead,
    customerId: customer._id,
    packageId: f.pkg._id,
    packageCode: f.pkg.code,
    title: f.title,
    systemType: p.systemType,
    capacityKw: p.kw,
    lines: f.lines,
    taxablePaise: f.totals.taxablePaise,
    gstPaise: f.totals.gstPaise,
    totalPaise: f.totals.totalPaise,
    subsidyPaise: f.subsidyPaise,
    netCostPaise: f.totals.totalPaise - f.subsidyPaise,
    status: "accepted",
    validUntil: addDays(sentAt, 15),
    sentAt,
    acceptedAt: p.acceptedAt,
    createdBy: who(salesUser),
    createdAt: sentAt,
    updatedAt: p.acceptedAt,
  });
  const t = b.t;
  t.add("lead", ids.lead, customer._id, "created", `Enquiry received via ${LEAD_SOURCE_LABELS[p.source].toLowerCase()}: ${p.kw} kW`, leadAt);
  t.add("lead", ids.lead, customer._id, "contacted", "First call made; requirement noted", contactedAt, who(salesUser));
  t.add("survey", ids.survey, customer._id, "completed", "Survey submitted with roof photos and measurements", addHours(surveyAt, 1.2), who(surveyor));
  t.add("survey", ids.survey, customer._id, "review_approve", `Survey ${nos.survey} approved — quote unlocked`, reviewedAt, who(salesUser));
  t.add("quote", ids.quote, customer._id, "created", `Quote ${nos.quote} (v1) sent: ${f.title}`, sentAt, who(salesUser));
  t.add("quote", ids.quote, customer._id, "accepted", `Quote ${nos.quote} accepted`, p.acceptedAt, who(salesUser));
  return { customer, f, ids };
}

/* ------------------------------------------------------------------ */
/* Panel Set sales over the year                                       */
/* ------------------------------------------------------------------ */

export async function seedPanelSets(ctx: Ctx): Promise<string> {
  const rand = prng(53003);
  const N = 14;
  const plans: Plan[] = Array.from({ length: N }, (_, i) => {
    const commercial = i % 5 === 2;
    const biz = commercial ? BUSINESSES[(i * 3) % BUSINESSES.length]! : null;
    return {
      stage: "closed" as const,
      name: biz ? `${biz.name} (Unit ${2 + (i % 3)})` : personName(rand),
      phone: seededPhone(6500 + i),
      type: commercial ? "commercial" : "residential",
      gstin: commercial ? gstinFor(rand) : undefined,
      city: biz ? biz.city : pick(rand, PLACES).city,
      kw: pick(rand, [1, 2, 2, 3, 3, 4, 5]),
      systemType: "panel_set" as const,
      source: weighted(rand, [["walk_in", 4], ["phone", 3], ["other", 3], ["referral", 2], ["website", 2]] as const),
      acceptedAt: ist(addDays(ctx.now, -(20 + (340 * (N - i)) / N + rand() * 10)), 12),
      fullPayment: true,
      mode: pick(rand, ["card", "upi", "bank_transfer", "card"] as const),
    };
  });
  const [leadNos, surveyNos, quoteNos, orderNos, grnNos] = await Promise.all([reserve("SP-L", N), reserve("SP-SV", N), reserve("SP-Q", N), reserve("SP-O", N), reserve("SP-GRN", N)]);
  const b = empty();
  const serials = new SerialMaker();
  for (const [i, p] of plans.entries()) {
    const salesUser = ctx.sales[i % ctx.sales.length]!;
    const { customer, f, ids } = front(ctx, rand, b, p, { lead: leadNos[i]!, survey: surveyNos[i]!, quote: quoteNos[i]! }, i, salesUser);
    const confirmedAt = addHours(p.acceptedAt, 2 + rand() * 20);
    const receivedAt = ist(addDays(confirmedAt, 1), 11);
    const dispatchedAt = ist(addDays(confirmedAt, 3), 10.5);
    const deliveredAt = ist(addDays(confirmedAt, 3), 16);
    const purchaseId = new Types.ObjectId();
    const supplier = SUPPLIERS[0]!;
    const tag = `P${ymd(receivedAt)}`;
    const pickList = f.lines.map((l) => {
      const sn = l.isSerialized ? Array.from({ length: l.qty }, () => serials.next(l.sku, tag)) : [];
      for (const s of sn) {
        b.units.push({
          serial: s,
          productId: l.productId,
          sku: l.sku,
          productName: l.name,
          category: l.category,
          status: "dispatched",
          purchaseId,
          costPaise: l.unitCostPaise,
          orderId: ids.order,
          customerId: customer._id,
          allocatedAt: addHours(dispatchedAt, -18),
          dispatchedAt,
          deliveredAt,
          warrantyStartAt: deliveredAt,
          warrantyEndAt: addMonths(deliveredAt, l.warrantyMonths),
          warrantyMonths: l.warrantyMonths,
          history: [
            { status: "in_stock", at: receivedAt, note: "Received", by: ctx.keeper.name },
            { status: "allocated", at: addHours(dispatchedAt, -18), note: `Packed for ${orderNos[i]}`, by: ctx.keeper.name },
            { status: "dispatched", at: dispatchedAt, note: `Dispatched on ${orderNos[i]}`, by: ctx.keeper.name },
            { status: "dispatched", at: deliveredAt, note: `Delivered to site — ${l.warrantyMonths}-month warranty started`, by: ctx.keeper.name },
          ],
          createdAt: receivedAt,
          updatedAt: deliveredAt,
        });
      }
      b.moves.push({ productId: l.productId, sku: l.sku, qty: l.qty, type: "purchase", serials: sn, refType: "purchase", refId: purchaseId, refNumber: grnNos[i], note: "Received against a Panel Set order", by: who(ctx.keeper), at: receivedAt, createdAt: receivedAt, updatedAt: receivedAt });
      b.moves.push({ productId: l.productId, sku: l.sku, qty: -l.qty, type: "dispatch", serials: sn, refType: "order", refId: ids.order, refNumber: orderNos[i], note: "Dispatched", by: who(ctx.keeper), at: dispatchedAt, createdAt: dispatchedAt, updatedAt: dispatchedAt });
      return { productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, isSerialized: l.isSerialized, serials: sn, picked: true };
    });
    b.purchases.push({
      _id: purchaseId,
      number: grnNos[i],
      supplier,
      invoiceNo: `WEL/TS/${ymd(receivedAt)}/${100 + i}`,
      invoiceDate: addDays(receivedAt, -2),
      lines: pickList.map((l) => ({ productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, unitCostPaise: ctx.bySku.get(l.sku)!.costPaise, serials: l.serials })),
      totalPaise: pickList.reduce((s, l) => s + l.qty * ctx.bySku.get(l.sku)!.costPaise, 0),
      receivedAt,
      receivedBy: who(ctx.keeper),
      notes: `Direct shipment for a Panel Set order (${orderNos[i]})`,
      createdAt: receivedAt,
      updatedAt: receivedAt,
    });
    const invoiceId = new Types.ObjectId();
    const invNo = await reserveInvoice(dispatchedAt);
    b.invoices.push(saleInvoice(invoiceId, invNo, customer, ids.order, orderNos[i]!, f.lines, pickList, f.totals.totalPaise, dispatchedAt));
    b.payments.push({ at: confirmedAt, doc: { customerId: customer._id, orderId: ids.order, amountPaise: f.totals.totalPaise, mode: p.mode, type: "full", reference: reference(rand, p.mode === "card" ? "POS" : "UTR"), receivedAt: confirmedAt, recordedBy: who(salesUser) } });
    b.orders.push({
      _id: ids.order,
      number: orderNos[i],
      quoteId: ids.quote,
      leadId: ids.lead,
      customerId: customer._id,
      title: f.title,
      systemType: "panel_set",
      capacityKw: p.kw,
      siteAddress: customer.address,
      lines: f.lines,
      taxablePaise: f.totals.taxablePaise,
      gstPaise: f.totals.gstPaise,
      totalPaise: f.totals.totalPaise,
      paidPaise: f.totals.totalPaise,
      paymentStatus: "paid",
      status: "closed",
      pickList,
      dispatch: { vehicleNo: `TS 09 UC ${2000 + i * 37}`, driverName: pick(rand, ["Raju", "Srinu", "Mallesh"] as const), driverPhone: "9848123456", dispatchedAt, dispatchedBy: who(ctx.keeper), deliveredAt, deliveredBy: who(ctx.keeper), deliveryNote: `Received by ${p.name}` },
      invoiceId,
      subsidy: { applicable: false, status: "not_applicable", expectedPaise: 0, disbursedPaise: 0, history: [], documents: [] },
      extraCosts: [],
      salesUser: who(salesUser),
      confirmedAt,
      closedAt: deliveredAt,
      createdAt: p.acceptedAt,
      updatedAt: deliveredAt,
    });
    const t = b.t;
    t.add("order", ids.order, customer._id, "confirmed", `Order confirmed — pick list of ${pickList.length} items sent to the warehouse; hardware only, so no installation is booked`, confirmedAt, who(salesUser));
    t.add("order", ids.order, customer._id, "payment_recorded", `Full payment of ${formatINR(f.totals.totalPaise)} received by ${PAYMENT_MODE_LABELS[p.mode]}`, confirmedAt, who(salesUser));
    t.add("order", ids.order, customer._id, "dispatched", `Dispatched with ${pickList.reduce((s, l) => s + l.serials.length, 0)} serials; tax invoice ${invNo} issued`, dispatchedAt, who(ctx.keeper));
    t.add("order", ids.order, customer._id, "delivered", `Delivered, received by ${p.name}. Warranties started; hardware only, so the order is complete`, deliveredAt, who(ctx.keeper));
  }
  await flush(b);
  return `Panel Set sales: ${N} hardware-only orders over the year (paid in full, delivered and closed)`;
}

function saleInvoice(id: Types.ObjectId, number: string, customer: ReturnType<typeof customerDoc>, orderId: Types.ObjectId, orderNo: string, lines: ILineItem[], pickList: { sku: string; serials: string[] }[], paidPaise: number, at: Date, extra: Record<string, unknown> = {}) {
  const serialsBySku = new Map(pickList.map((p) => [p.sku, p.serials]));
  const totals = summarize(lines);
  return {
    _id: id,
    number,
    type: "sale",
    customerId: customer._id,
    orderId,
    billTo: { name: customer.name, phone: customer.phone, address: [customer.address.line1, customer.address.city, `Telangana ${customer.address.pincode}`].join(", "), gstin: customer.gstin },
    lines: lines.map((l) => {
      const sn = serialsBySku.get(l.sku) ?? [];
      return { description: sn.length ? `${l.name} (S/N ${sn.join(", ")})` : l.name, hsn: l.hsn, qty: l.qty, unitPricePaise: l.unitPricePaise, gstRate: l.gstRate, ...computeLine(l) };
    }),
    ...totals,
    paidPaise: Math.min(paidPaise, totals.totalPaise),
    status: paidPaise >= totals.totalPaise ? "paid" : paidPaise > 0 ? "partially_paid" : "issued",
    issuedAt: at,
    dueAt: addDays(at, 15),
    notes: `Against order ${orderNo}`,
    createdAt: at,
    updatedAt: at,
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Cancelled and in-flight orders, with the forward schedule           */
/* ------------------------------------------------------------------ */

/** Install dates (days from today): at most six days apart, so every week of the next three months has one. */
const FORWARD_DAYS = [2, 3, 5, 8, 11, 15, 19, 24, 29, 35, 41, 47, 53, 59, 65, 71, 77, 83, 89];

export async function seedInFlight(ctx: Ctx): Promise<string> {
  const rand = prng(54004);
  const now = ctx.now;
  let k = 0;
  const plan = (stage: Stage, extra: Partial<Plan> = {}): Plan => {
    const commercial = extra.type === "commercial";
    const biz = commercial ? BUSINESSES[(k * 7) % BUSINESSES.length]! : null;
    const systemType = extra.systemType ?? (rand() < 0.2 ? "off_grid" : "on_grid");
    return {
      stage,
      name: biz ? `${biz.name}` : personName(rand),
      phone: seededPhone(7000 + k++),
      type: commercial ? "commercial" : "residential",
      gstin: commercial ? gstinFor(rand) : undefined,
      city: biz ? biz.city : pick(rand, PLACES).city,
      kw: commercial ? 5 : pick(rand, [1, 2, 3, 3, 3, 4, 5]),
      source: pick(rand, ["website", "whatsapp", "phone", "walk_in", "referral", "other"] as const),
      acceptedAt: addDays(now, -(2 + rand() * 4)),
      mode: weighted(rand, [["upi", 5], ["bank_transfer", 3], ["cheque", 1], ["card", 2], ["cash", 1]] as const),
      ...extra,
      systemType,
    };
  };
  const plans: Plan[] = [
    ...Array.from({ length: 5 }, (_, i) => plan("pending_payment", { acceptedAt: addDays(now, -(0.3 + i * 1.1)) })),
    ...CANCEL_REASONS.map((r, i) => plan("cancelled", { cancelReason: r, acceptedAt: addDays(now, -(40 + i * 70)) })),
    ...FORWARD_DAYS.map((d, i) =>
      plan("confirmed", {
        installDay: d,
        acceptedAt: addDays(now, -(3 + (i % 6))),
        systemType: i === 6 ? "panel_set" : undefined,
        // Bookings beyond three weeks wait on DISCOM feasibility; the near ones are approved (one still waiting: the warning case).
        subsidy: d <= 5 ? (i === 1 ? "applied" : "feasibility_approved") : i % 4 === 0 ? "not_applied" : i % 5 === 0 ? "rejected" : i % 2 ? "applied" : "feasibility_approved",
        fullPayment: i === 3,
      }),
    ),
    ...[1, 1, 2, 3, 3].map((d, i) => plan("ready_to_dispatch", { installDay: d, acceptedAt: addDays(now, -(7 + i)), systemType: i === 4 ? "panel_set" : undefined, subsidy: "feasibility_approved" })),
    ...[1, 1, 2, 2, 3].map((d, i) => plan("dispatched", { installDay: d, acceptedAt: addDays(now, -(9 + i)), subsidy: "feasibility_approved", type: i === 0 ? "commercial" : undefined, voidInvoice: i === 0 })),
    ...[0, 0, 1, 1, 2].map((d, i) => plan("delivered", { installDay: d, acceptedAt: addDays(now, -(11 + i)), subsidy: "feasibility_approved" })),
    ...[0, 0, 0, 0].map((d, i) => plan("installing", { installDay: d, acceptedAt: addDays(now, -(12 + i)), subsidy: "feasibility_approved", type: i === 3 ? "commercial" : undefined })),
  ];
  for (const p of plans) {
    if (p.type === "commercial" || p.systemType !== "on_grid") p.subsidy = undefined;
    if (p.systemType === "panel_set") p.installDay = undefined;
  }
  const n = plans.length;
  const withJob = plans.filter((p) => p.systemType !== "panel_set" && !["pending_payment", "cancelled"].includes(p.stage)).length;
  const [leadNos, surveyNos, quoteNos, orderNos, jobNos, grnNos] = await Promise.all([reserve("SP-L", n), reserve("SP-SV", n), reserve("SP-Q", n), reserve("SP-O", n), reserve("SP-J", withJob), reserve("SP-GRN", 1)]);

  const b = empty();
  const crewFor = crewPicker(ctx);
  const receivedAt = ist(addDays(now, -5), 11.5);
  const purchaseId = new Types.ObjectId();
  const serials = new SerialMaker();
  const grnTag = `N${ymd(receivedAt)}`;
  /** New serial units received this week, by product id, handed out to packed and later orders. */
  const fresh = new Map<string, Record<string, unknown>[]>();
  const grnQty = new Map<string, number>();
  const dispatchedQty = new Map<string, number>();
  const newReserved = new Map<string, number>();
  const inc = (m: Map<string, number>, id: string, q: number) => m.set(id, (m.get(id) ?? 0) + q);
  const takeUnit = (l: ILineItem) => {
    const id = String(l.productId);
    inc(grnQty, id, 1);
    const unit: Record<string, unknown> = {
      serial: serials.next(l.sku, grnTag),
      productId: l.productId,
      sku: l.sku,
      productName: l.name,
      category: l.category,
      status: "in_stock",
      purchaseId,
      costPaise: l.unitCostPaise,
      warrantyMonths: l.warrantyMonths,
      history: [{ status: "in_stock", at: receivedAt, note: "Received", by: ctx.keeper.name }],
      createdAt: receivedAt,
      updatedAt: receivedAt,
    };
    fresh.set(id, [...(fresh.get(id) ?? []), unit]);
    b.units.push(unit);
    return unit;
  };

  let jn = 0;
  let voidedInvoice = "";
  for (const [i, p] of plans.entries()) {
    const salesUser = ctx.sales[i % ctx.sales.length]!;
    const { customer, f, ids } = front(ctx, rand, b, p, { lead: leadNos[i]!, survey: surveyNos[i]!, quote: quoteNos[i]! }, i + 40, salesUser);
    const t = b.t;
    const order: Record<string, unknown> = {
      _id: ids.order,
      number: orderNos[i],
      quoteId: ids.quote,
      leadId: ids.lead,
      customerId: customer._id,
      title: f.title,
      systemType: p.systemType,
      capacityKw: p.kw,
      siteAddress: customer.address,
      lines: f.lines,
      taxablePaise: f.totals.taxablePaise,
      gstPaise: f.totals.gstPaise,
      totalPaise: f.totals.totalPaise,
      paidPaise: 0,
      paymentStatus: "unpaid",
      status: p.stage,
      pickList: [],
      dispatch: {},
      subsidy: { applicable: !!p.subsidy || (p.type === "residential" && p.systemType === "on_grid"), status: "not_applicable", expectedPaise: f.subsidyPaise, disbursedPaise: 0, history: [], documents: [] },
      extraCosts: [],
      salesUser: who(salesUser),
      createdAt: p.acceptedAt,
      updatedAt: p.acceptedAt,
    };
    b.orders.push(order);
    t.add("order", ids.order, customer._id, "created", `Order ${orderNos[i]} created from quote ${quoteNos[i]}. Awaiting advance payment.`, p.acceptedAt, who(salesUser));
    const subsidy = order.subsidy as { applicable: boolean; status: SubsidyStatus; applicationNo?: string; history: object[]; documents: object[]; expectedPaise: number };
    if (!subsidy.applicable) subsidy.expectedPaise = 0;
    else subsidy.status = "not_applied";

    if (p.stage === "pending_payment") continue;
    if (p.stage === "cancelled") {
      const at = addDays(p.acceptedAt, 3 + rand() * 6);
      Object.assign(order, { notes: `Cancelled: ${p.cancelReason}`, updatedAt: at });
      t.add("order", ids.order, customer._id, "cancelled", `Order cancelled: ${p.cancelReason}`, at, who(salesUser));
      continue;
    }

    // Advance (or full) payment confirms the order and books the crew.
    const confirmedAt = addHours(p.acceptedAt, 3 + rand() * 20);
    const advance = p.fullPayment || p.systemType === "panel_set" ? f.totals.totalPaise : Math.round((f.totals.totalPaise * (0.4 + rand() * 0.2)) / 100_000) * 100_000;
    b.payments.push({ at: confirmedAt, doc: { customerId: customer._id, orderId: ids.order, amountPaise: advance, mode: p.mode, type: advance === f.totals.totalPaise ? "full" : "advance", reference: reference(rand, p.mode === "card" ? "POS" : p.mode === "cheque" ? "CHQ" : "UTR"), receivedAt: confirmedAt, recordedBy: who(salesUser) } });
    Object.assign(order, { paidPaise: advance, paymentStatus: advance >= f.totals.totalPaise ? "paid" : "partial", confirmedAt, updatedAt: confirmedAt });
    const pickList = f.lines.filter((l) => l.category !== "service").map((l) => ({ productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, isSerialized: l.isSerialized, serials: [] as string[], picked: false }));
    order.pickList = pickList;
    t.add("order", ids.order, customer._id, "payment_recorded", `${advance === f.totals.totalPaise ? "Full payment" : "Advance"} of ${formatINR(advance)} received by ${PAYMENT_MODE_LABELS[p.mode]}`, confirmedAt, who(salesUser));

    // Subsidy file: applied after confirmation, feasibility a week later (or rejected).
    if (subsidy.applicable && p.subsidy && p.subsidy !== "not_applied") {
      const appliedAt = addDays(confirmedAt, 1);
      subsidy.applicationNo = `PMSG-TS-2026-${200000 + i * 53}`;
      subsidy.history.push({ status: "applied", at: appliedAt, by: salesUser.name });
      subsidy.documents.push({ kind: "application", fileId: photo(ctx, "doc_application", i), at: appliedAt, by: salesUser.name });
      subsidy.status = "applied";
      if (p.subsidy === "feasibility_approved") {
        const okAt = addDays(appliedAt, 2 + rand() * 3);
        subsidy.history.push({ status: "feasibility_approved", at: okAt, by: salesUser.name });
        subsidy.documents.push({ kind: "feasibility_letter", fileId: photo(ctx, "doc_feasibility", i), at: okAt, by: salesUser.name });
        subsidy.status = "feasibility_approved";
      } else if (p.subsidy === "rejected") {
        const noAt = addDays(appliedAt, 2);
        subsidy.history.push({ status: "rejected", at: noAt, by: salesUser.name, note: "Name on the electricity bill differs from the applicant — reapply after the name transfer" });
        subsidy.status = "rejected";
      }
    }

    const hardwareOnly = p.systemType === "panel_set";
    let job: Record<string, unknown> | null = null;
    if (!hardwareOnly) {
      const day = workday(ist(addDays(now, p.installDay ?? 4), 9.5));
      const crew = crewFor(day, p.kw >= 4 ? 3 : 2);
      job = {
        _id: new Types.ObjectId(),
        number: jobNos[jn++],
        type: "installation",
        orderId: ids.order,
        customerId: customer._id,
        title: `${p.kw} kW ${SYSTEM_TYPE_LABELS[p.systemType]} installation`,
        siteAddress: customer.address,
        scheduledFor: day,
        estimatedHours: 4 + 1.5 * p.kw,
        technicianIds: crew.map((c) => c._id),
        leadTechnicianId: crew[0]?._id,
        status: "scheduled",
        checklist: { mounting: false, panels: false, wiring: false, earthing: false, inverter: false, testing: false },
        photos: [],
        timeLogs: [],
        materialsUsed: [],
        createdAt: confirmedAt,
        updatedAt: confirmedAt,
      };
      b.jobs.push(job);
      order.installationJobId = job._id;
      t.add("order", ids.order, customer._id, "confirmed", `Order confirmed — pick list of ${pickList.length} items sent to the warehouse; installation ${job.number} booked with ${crew.map((c) => c.name).join(", ")}`, confirmedAt, who(salesUser));
      t.add("job", job._id as Types.ObjectId, customer._id, "scheduled", `Installation booked (${crew.map((c) => c.name).join(", ")})`, confirmedAt, who(salesUser));
    } else {
      t.add("order", ids.order, customer._id, "confirmed", `Order confirmed — pick list of ${pickList.length} items sent to the warehouse; hardware only, so no installation is booked`, confirmedAt, who(salesUser));
    }
    if (p.stage === "confirmed") {
      for (const l of pickList) inc(newReserved, String(l.productId), l.qty);
      continue;
    }

    // Packed: serials scanned from this week's receipt, bulk items ticked.
    const packedAt = p.stage === "ready_to_dispatch" ? addHours(now, -(2 + rand() * 20)) : addDays(now, -(2 + rand() * 1.5));
    for (const line of pickList) {
      const l = f.lines.find((x) => x.sku === line.sku)!;
      if (line.isSerialized) {
        for (let q = 0; q < line.qty; q++) {
          const u = takeUnit(l);
          Object.assign(u, { status: "allocated", orderId: ids.order, allocatedAt: packedAt, updatedAt: packedAt });
          (u.history as object[]).push({ status: "allocated", at: packedAt, note: `Packed for ${orderNos[i]}`, by: ctx.keeper.name });
          line.serials.push(u.serial as string);
        }
      } else inc(grnQty, String(line.productId), line.qty);
      line.picked = true;
    }
    order.updatedAt = packedAt;
    t.add("order", ids.order, customer._id, "packed", `Packed: ${pickList.reduce((s, l) => s + l.serials.length, 0)} serials scanned, bulk items ticked`, packedAt, who(ctx.keeper));
    if (p.stage === "ready_to_dispatch") {
      for (const l of pickList) inc(newReserved, String(l.productId), l.qty);
      continue;
    }

    // Dispatched: stock leaves, tax invoice issued (the advance counts towards it).
    const dispatchedAt = addHours(packedAt, 16 + rand() * 6) > now ? addHours(now, -1.5) : addHours(packedAt, 16 + rand() * 6);
    const vehicleNo = `TS 08 UD ${3100 + i * 17}`;
    for (const line of pickList) {
      inc(dispatchedQty, String(line.productId), line.qty);
      b.moves.push({ productId: line.productId, sku: line.sku, qty: -line.qty, type: "dispatch", serials: line.serials, refType: "order", refId: ids.order, refNumber: orderNos[i], note: `Dispatched in ${vehicleNo}`, by: who(ctx.keeper), at: dispatchedAt, createdAt: dispatchedAt, updatedAt: dispatchedAt });
      for (const s of line.serials) {
        const u = b.units.find((x) => x.serial === s)!;
        Object.assign(u, { status: "dispatched", customerId: customer._id, dispatchedAt, updatedAt: dispatchedAt });
        (u.history as object[]).push({ status: "dispatched", at: dispatchedAt, note: `Dispatched on ${orderNos[i]} in ${vehicleNo}`, by: ctx.keeper.name });
      }
    }
    const invoiceId = new Types.ObjectId();
    if (p.voidInvoice) {
      const voidNo = await reserveInvoice(dispatchedAt);
      voidedInvoice = voidNo;
      const voidId = new Types.ObjectId();
      b.invoices.push(saleInvoice(voidId, voidNo, { ...customer, gstin: undefined }, ids.order, orderNos[i]!, f.lines, pickList, 0, dispatchedAt, { status: "void", paidPaise: 0, notes: `Against order ${orderNos[i]}. Voided: issued without the customer's GSTIN, re-issued` }));
      t.add("invoice", voidId, customer._id, "voided", `Invoice ${voidNo} voided: issued without the customer's GSTIN`, addHours(dispatchedAt, 0.5), who(ctx.director));
    }
    const invNo = await reserveInvoice(dispatchedAt);
    b.invoices.push(saleInvoice(invoiceId, invNo, customer, ids.order, orderNos[i]!, f.lines, pickList, advance, addHours(dispatchedAt, p.voidInvoice ? 0.6 : 0)));
    Object.assign(order, {
      invoiceId,
      dispatch: { vehicleNo, driverName: pick(rand, ["Raju", "Srinu", "Yadagiri", "Mallesh"] as const), driverPhone: "9848123456", dispatchedAt, dispatchedBy: who(ctx.keeper) },
      updatedAt: dispatchedAt,
    });
    t.add("order", ids.order, customer._id, "dispatched", `Dispatched in ${vehicleNo} with ${pickList.reduce((s, l) => s + l.serials.length, 0)} serials; tax invoice ${invNo} issued`, dispatchedAt, who(ctx.keeper));
    if (p.stage === "dispatched") continue;

    // Delivered: warranty clocks start; the crew can begin.
    const deliveredAt = addHours(dispatchedAt, 5) > now ? addHours(now, -0.5) : addHours(dispatchedAt, 5);
    for (const u of b.units.filter((x) => String(x.orderId) === String(ids.order))) {
      Object.assign(u, { deliveredAt, warrantyStartAt: deliveredAt, warrantyEndAt: addMonths(deliveredAt, u.warrantyMonths as number), updatedAt: deliveredAt });
      (u.history as object[]).push({ status: "dispatched", at: deliveredAt, note: `Delivered to site — ${u.warrantyMonths}-month warranty started`, by: ctx.keeper.name });
    }
    (order.dispatch as Record<string, unknown>).deliveredAt = deliveredAt;
    (order.dispatch as Record<string, unknown>).deliveredBy = who(ctx.keeper);
    (order.dispatch as Record<string, unknown>).deliveryNote = `Received by ${p.name}`;
    order.updatedAt = deliveredAt;
    t.add("order", ids.order, customer._id, "delivered", `Delivered, received by ${p.name}. Warranties started`, deliveredAt, who(ctx.keeper));
    if (p.stage === "delivered") continue;

    // Installing: the crew started this morning.
    const startedAt = ist(now, 9.5).getTime() < now.getTime() - 3_600_000 ? ist(now, 9.5) : addHours(now, -1);
    Object.assign(job!, { status: "in_progress", startedAt, scheduledFor: startedAt, updatedAt: startedAt });
    order.updatedAt = startedAt;
    t.add("order", ids.order, customer._id, "installing", `Installation ${job!.number} started`, startedAt, who(ctx.installers[0]!));
  }

  // This week's goods receipt: everything packed or dispatched above, plus cover for the confirmed bookings
  // (except a few items deliberately left short, so Low stock has something to show).
  const short = new Set(["BAT-LUM-200", "LA-CU-1M", "SPR-SPD", "PCU-LUM-5K"]);
  const reservedOld = await Order.aggregate<{ _id: Types.ObjectId; qty: number }>([
    { $match: { status: { $in: ["confirmed", "ready_to_dispatch"] } } },
    { $unwind: "$pickList" },
    { $group: { _id: "$pickList.productId", qty: { $sum: "$pickList.qty" } } },
  ]);
  const heldOld = new Map(reservedOld.map((r) => [String(r._id), r.qty]));
  const live = new Map((await Product.find().select("stockQty").lean()).map((p) => [String(p._id), p.stockQty]));
  for (const p of ctx.products) {
    if (p.category === "service") continue;
    const id = String(p._id);
    const after = (live.get(id) ?? 0) + (grnQty.get(id) ?? 0) - (dispatchedQty.get(id) ?? 0) - (heldOld.get(id) ?? 0) - (newReserved.get(id) ?? 0);
    // Short items still never go below zero available; they just sit under their reorder level.
    const want = short.has(p.sku) ? 1 : p.reorderLevel + (p.unit === "m" ? 250 : p.isSerialized ? 3 + Math.floor(rand() * 5) : 6);
    if (after >= want) continue;
    const extra = want - after;
    if (p.isSerialized) {
      const l = { productId: p._id, sku: p.sku, name: p.name, category: p.category, unitCostPaise: p.costPaise, warrantyMonths: p.warrantyMonths } as ILineItem;
      for (let q = 0; q < extra; q++) takeUnit(l);
    } else inc(grnQty, id, extra);
  }
  const grnLines = [...grnQty.entries()].map(([id, qty]) => {
    const p = ctx.byId.get(id)!;
    return { productId: p._id, sku: p.sku, name: p.name, qty, unitCostPaise: p.costPaise, serials: (fresh.get(id) ?? []).map((u) => u.serial as string) };
  });
  b.purchases.push({
    _id: purchaseId,
    number: grnNos[0],
    supplier: SUPPLIERS[1],
    invoiceNo: `SVSD/26-27/${ymd(receivedAt)}`,
    invoiceDate: addDays(receivedAt, -1),
    lines: grnLines,
    totalPaise: grnLines.reduce((s, l) => s + l.qty * l.unitCostPaise, 0),
    receivedAt,
    receivedBy: who(ctx.keeper),
    notes: "Weekly replenishment for booked installations",
    createdAt: receivedAt,
    updatedAt: receivedAt,
  });
  for (const l of grnLines) b.moves.push({ productId: l.productId, sku: l.sku, qty: l.qty, type: "purchase", serials: l.serials, refType: "purchase", refId: purchaseId, refNumber: grnNos[0], note: "Weekly replenishment", by: who(ctx.keeper), at: receivedAt, createdAt: receivedAt, updatedAt: receivedAt });

  await flush(b);
  await Product.bulkWrite(
    ctx.products
      .map((p) => ({ id: String(p._id), delta: (grnQty.get(String(p._id)) ?? 0) - (dispatchedQty.get(String(p._id)) ?? 0) }))
      .filter((d) => d.delta !== 0)
      .map((d) => ({ updateOne: { filter: { _id: new Types.ObjectId(d.id) }, update: { $inc: { stockQty: d.delta } } } })),
  );
  const count = (s: Stage) => plans.filter((p) => p.stage === s).length;
  return `Orders in flight: awaiting payment ${count("pending_payment")}, confirmed ${count("confirmed")} (installs booked up to ${FORWARD_DAYS.at(-1)} days out), packed ${count("ready_to_dispatch")}, in transit ${count("dispatched")}, delivered ${count("delivered")}, installing ${count("installing")}, cancelled ${count("cancelled")}; GRN ${grnNos[0]} (${grnLines.length} lines); voided ${voidedInvoice}`;
}
