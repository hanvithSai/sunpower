/**
 * Fourteen months of finished installations (plus three older ones from the
 * brief's scenes), written straight into the collections with their real
 * dates: enquiry → approved survey → accepted quote → advance → monthly GRN
 * with serials → dispatch (GST invoice) → delivery (warranty clocks) →
 * installation (crew time logs, signature) → balance → subsidy stages.
 *
 * Everything is internally consistent with what the services would have
 * written: serial units carry their GRN cost and warranty dates, the stock
 * ledger has a purchase and a dispatch for every unit (so today's stock is
 * unchanged), invoices use the same GST maths, and loss-making jobs have a
 * visible cause (extra cable, crane hire, overtime, a warranty repair).
 *
 * Runs once: skipped when the `seed:history` marker exists.
 */
import { Types } from "mongoose";
import { financialYear, addDays, addHours, startOfDayIST } from "@/lib/dates";
import { computeLine, summarize } from "@/lib/gst";
import { estimateSubsidyPaise } from "@/lib/subsidy";
import { addMonths } from "@/lib/warranty";
import type { SubsidyStatus } from "@/lib/constants";
import { Activity, Counter, Customer, Invoice, Job, Lead, Order, Package, Payment, Product, Purchase, Quote, SerialUnit, StockMove, Survey, Ticket, User, type ILineItem, type IProduct } from "@/server/models";
import { FACTORIES, FIRST_NAMES, LAST_NAMES, NORTH, PLACES, pick, prng, seededPhone, type Place } from "./people";

const MARKER = "seed:history";
/** Shown on the goods receipt page. */
export const GRN_NOTE = "Monthly replenishment against booked installations";
export const SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DAY = 86_400_000;

type Actor = { id: Types.ObjectId; name: string };
type Extra = { label: string; kind: "site" | "warranty"; amountPaise: number; daysAfter: number };

export type Spec = {
  name: string;
  phone: string;
  commercial?: { gstin: string };
  place: Place;
  area: string;
  kw: number;
  systemType: "on_grid" | "off_grid";
  commissionedAt: Date;
  overtimeHours: number;
  extras: Omit<Extra, "kind">[];
  unpaidBalance: boolean;
  subsidyRejected: boolean;
  /** Warranty replacement N days after commissioning (category of the unit). */
  repair?: { category: "inverter" | "panel"; daysAfter: number };
  source: "website" | "whatsapp" | "phone" | "walk_in" | "referral";
  /** Negotiated installation rate per kW (paise), e.g. a premium for an elevated structure. */
  installRatePaise?: number;
};

/** Reserve n document numbers in one round trip. */
export async function reserve(prefix: string, n: number): Promise<string[]> {
  if (n === 0) return [];
  const doc = await Counter.findOneAndUpdate({ _id: prefix }, { $inc: { seq: n } }, { upsert: true, returnDocument: "after" }).lean();
  const last = doc!.seq;
  return Array.from({ length: n }, (_, i) => `${prefix}-${String(last - n + 1 + i).padStart(4, "0")}`);
}

export async function reserveInvoice(at: Date): Promise<string> {
  const fy = financialYear(at);
  const doc = await Counter.findOneAndUpdate({ _id: `INV/${fy}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }).lean();
  return `INV/${fy}/${String(doc!.seq).padStart(4, "0")}`;
}

/** 09:30 IST on the day of `d`, plus hours. */
export const at = (d: Date, hours = 9.5) => addHours(startOfDayIST(d), hours);

function buildSpecs(now: Date): Spec[] {
  const rand = prng(20261031);
  const specs: Spec[] = [];
  const COUNT = 118;
  const start = addMonths(now, -14).getTime() + 10 * DAY;
  const span = now.getTime() - 6 * DAY - start;
  const kws = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5];
  for (let i = 0; i < COUNT; i++) {
    const factory = i % 29 === 7 ? FACTORIES[Math.floor(i / 29) % FACTORIES.length]! : null;
    const place = factory ? PLACES.find((p) => p.city === factory.city)! : pick(rand, PLACES);
    const offGrid = !factory && rand() < 0.18;
    const commissionedAt = new Date(start + (span * (i + rand() * 0.6)) / COUNT);
    const extras: Spec["extras"] = [];
    if (i % 17 === 4) extras.push({ label: "Extra 40 m DC cable — longer run than surveyed", amountPaise: 40 * 5_200, daysAfter: 0 });
    if (i % 23 === 11) extras.push({ label: "Crane hire for a 4th-floor roof", amountPaise: 6_500_00, daysAfter: 0 });
    if (i % 31 === 19) extras.push({ label: "Rework: structure re-anchored after rain", amountPaise: 9_800_00, daysAfter: 9 });
    // The jobs that lost money, each with a cause the director can see.
    if (i === 33) extras.push({ label: "Roof leak rework: re-waterproofing and re-mounting the stands", amountPaise: 46_500_00, daysAfter: 21 });
    if (i === 58) extras.push({ label: "Wrong inverter dispatched: return freight and second crew visit", amountPaise: 39_000_00, daysAfter: 3 });
    if (i === 87) extras.push({ label: "Re-wiring after DISCOM inspection failed (earthing resistance)", amountPaise: 36_500_00, daysAfter: 30 });
    specs.push({
      name: factory ? factory.name : `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`,
      phone: seededPhone(1000 + i),
      commercial: factory ? { gstin: factory.gstin } : undefined,
      place,
      area: pick(rand, place.areas),
      kw: factory ? 5 : i === 58 || i === 87 ? 2 : pick(rand, kws),
      systemType: offGrid ? "off_grid" : "on_grid",
      commissionedAt,
      overtimeHours: i % 13 === 5 ? 6 : 0,
      extras,
      unpaidBalance: now.getTime() - commissionedAt.getTime() < 60 * DAY ? rand() < 0.35 : rand() < 0.05,
      subsidyRejected: i === 21 || i === 64,
      repair: i === 15 ? { category: "inverter", daysAfter: 150 } : i === 40 ? { category: "panel", daysAfter: 90 } : undefined,
      source: pick(rand, ["website", "website", "whatsapp", "whatsapp", "phone", "walk_in", "referral"] as const),
    });
  }
  // The brief's scenes: 18 months (inverter still covered), ~25 months (workmanship), 28 months (inverter expired).
  const legacy = (name: string, city: string, months: number, kw: number, n: number): Spec => {
    const place = PLACES.find((p) => p.city === city)!;
    return { name, phone: seededPhone(n), place, area: place.areas[0]!, kw, systemType: "on_grid", commissionedAt: at(addMonths(now, -months), 15), overtimeHours: 0, extras: [], unpaidBalance: false, subsidyRejected: false, source: "referral" };
  };
  specs.push(legacy("Venkata Ramana Rao", "Kukatpally", 18, 3, 901), legacy("Lakshmi Prasanna", "Secunderabad", 25, 2, 902), legacy("Padmavathi Devi", "LB Nagar", 28, 3, 903));
  return specs.sort((a, b) => a.commissionedAt.getTime() - b.commissionedAt.getTime());
}

export function serialPrefix(sku: string): string {
  return sku.replace(/^(PNL|INV|PCU|BAT|CC)-/, "").replace(/-/g, "");
}

export async function seedHistory(now = new Date()): Promise<string> {
  if (await Counter.exists({ _id: MARKER })) return "History: already seeded";
  const result = await insertInstallations(buildSpecs(now), { now, tag: "H", seed: 777 });
  await Counter.create({ _id: MARKER, seq: result.installations });
  return `History: ${result.summary}`;
}

/**
 * Write finished installations for the given specs. `tag` keeps serial
 * numbers and supplier invoice numbers apart between batches (H = history,
 * L = legacy installed base, R = recent).
 */
export async function insertInstallations(specs: Spec[], run: { now: Date; tag: string; seed: number }): Promise<{ installations: number; summary: string }> {
  const now = run.now;
  const [products, packages, users] = await Promise.all([Product.find().lean(), Package.find().lean(), User.find({ active: true }).lean()]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const sales = users.filter((u) => u.role === "sales");
  const installers = users.filter((u) => u.role === "technician" && u.skills.includes("installation"));
  const surveyors = users.filter((u) => u.role === "technician" && u.skills.includes("survey"));
  const keeper = users.find((u) => u.role === "warehouse")!;
  const support = users.find((u) => u.role === "support")!;
  const rate = new Map(users.map((u) => [String(u._id), u.hourlyRatePaise]));
  const actor = (u: (typeof users)[number]): Actor => ({ id: u._id, name: u.name });
  const rand = prng(run.seed);

  const n = specs.length;
  const [leadNos, surveyNos, quoteNos, orderNos, jobNos] = await Promise.all([reserve("SP-L", n), reserve("SP-SV", n), reserve("SP-Q", n), reserve("SP-O", n), reserve("SP-J", n)]);

  const docs = {
    customers: [] as object[],
    leads: [] as object[],
    surveys: [] as object[],
    quotes: [] as object[],
    orders: [] as object[],
    payments: [] as { receivedAt: Date; doc: Record<string, unknown> }[],
    jobs: [] as object[],
    invoices: [] as object[],
    units: [] as Record<string, unknown>[],
    moves: [] as object[],
    activities: [] as object[],
    tickets: [] as object[],
  };
  /** Units needed per GRN month: monthKey → productId → serials + costs. */
  const grnMonths = new Map<string, { receivedAt: Date; lines: Map<string, { qty: number; serials: string[]; costPaise: number }> }>();
  const serialSeq = new Map<string, number>();
  const log = (entityType: string, entityId: Types.ObjectId, customerId: Types.ObjectId, action: string, message: string, when: Date, who?: Actor) =>
    docs.activities.push({ entityType, entityId, customerId, action, message, actorId: who?.id, actorName: who?.name, createdAt: when, updatedAt: when });

  for (let i = 0; i < n; i++) {
    const s = specs[i]!;
    const c = s.commissionedAt;
    const salesUser = sales[i % sales.length]!;
    const crew = [0, 1, 2].map((k) => installers[(i * 3 + k) % installers.length]!);
    const surveyor = surveyors[i % surveyors.length]!;
    const leadAt = at(addDays(c, -(26 + Math.floor(rand() * 18))), 10 + rand() * 8);
    const contactedAt = addHours(leadAt, 0.4 + rand() * 2.5);
    const qualifiedAt = addHours(contactedAt, 20);
    const surveyAt = at(addDays(leadAt, 3 + Math.floor(rand() * 3)), 10);
    const reviewedAt = addHours(surveyAt, 26);
    const sentAt = addHours(reviewedAt, 2);
    const acceptedAt = addHours(sentAt, 24 * (2 + Math.floor(rand() * 4)));
    const confirmedAt = addHours(acceptedAt, 3 + rand() * 30);
    const dispatchedAt = at(addDays(c, -2), 10.5);
    const deliveredAt = at(addDays(c, -1), 15);
    const startAt = at(c, 9.5);
    const hours = Math.round((4 + 1.5 * s.kw + rand() * 1.5 + s.overtimeHours) * 4) / 4;
    const finishAt = addHours(startAt, hours);

    const ids = { customer: new Types.ObjectId(), lead: new Types.ObjectId(), survey: new Types.ObjectId(), quote: new Types.ObjectId(), order: new Types.ObjectId(), job: new Types.ObjectId(), invoice: new Types.ObjectId() };
    const discom = NORTH.has(s.place.city) ? "TSNPDCL" : "TSSPDCL";
    const address = { line1: `${1 + Math.floor(rand() * 400)}-${Math.floor(rand() * 90)}, ${s.area}`, city: s.place.city, district: s.place.district, state: "Telangana", pincode: s.place.pincode };
    docs.customers.push({
      _id: ids.customer,
      name: s.name,
      phone: s.phone,
      type: s.commercial ? "commercial" : "residential",
      address,
      discom,
      consumerNumber: `${discom === "TSSPDCL" ? "1" : "2"}${String(10_000_000 + Math.floor(rand() * 89_999_999))}`,
      gstin: s.commercial?.gstin,
      createdAt: leadAt,
      updatedAt: leadAt,
    });

    // Bill of materials from the package template, priced and costed from the catalog.
    const pkg = packages.find((p) => p.capacityKw === s.kw && p.systemType === s.systemType)!;
    const lines: ILineItem[] = pkg.lines.map((l) => {
      const p = productById.get(String(l.productId))! as IProduct;
      return { productId: p._id, sku: p.sku, name: p.name, category: p.category, unit: p.unit, qty: l.qty, unitPricePaise: p.category === "service" && s.installRatePaise ? s.installRatePaise : p.pricePaise, unitCostPaise: p.costPaise, gstRate: p.gstRate, hsn: p.hsn, isSerialized: p.isSerialized, warrantyMonths: p.warrantyMonths };
    });
    const totals = summarize(lines);
    const subsidyPaise = estimateSubsidyPaise(s.kw, s.systemType, s.commercial ? "commercial" : "residential");
    const title = `${s.kw} kW ${s.systemType === "on_grid" ? "On-Grid" : "Off-Grid"} system`;

    docs.leads.push({
      _id: ids.lead,
      number: leadNos[i],
      customerId: ids.customer,
      name: s.name,
      phone: s.phone,
      city: s.place.city,
      source: s.source,
      requirement: { capacityKw: s.kw, systemType: s.systemType, wantsSubsidy: !s.commercial && s.systemType === "on_grid", monthlyBillRs: 600 * s.kw + Math.floor(rand() * 900) },
      qualification: { roofAreaSqft: 180 * s.kw + 200, shadowFreeAreaSqft: 120 * s.kw + 60, monthlyBillRs: 600 * s.kw + 400, gridSuitable: true, roofType: "rcc", qualifiedAt, qualifiedBy: salesUser._id },
      status: "won",
      assignedTo: salesUser._id,
      firstContactedAt: contactedAt,
      lastActivityAt: confirmedAt,
      surveyId: ids.survey,
      quoteId: ids.quote,
      orderId: ids.order,
      createdAt: leadAt,
      updatedAt: confirmedAt,
    });
    log("lead", ids.lead, ids.customer, "created", `Enquiry received via ${s.source.replace("_", "-")}: ${s.kw} kW ${s.systemType === "on_grid" ? "on-grid" : "off-grid"}`, leadAt);

    docs.surveys.push({
      _id: ids.survey,
      number: surveyNos[i],
      leadId: ids.lead,
      customerId: ids.customer,
      technicianId: surveyor._id,
      scheduledFor: surveyAt,
      status: "approved",
      measurements: { roofDirection: pick(rand, ["S", "S", "SE", "SW", "E"] as const), tiltDeg: 12 + Math.floor(rand() * 8), roofType: "rcc", usableAreaSqft: 110 * s.kw + 80, shadingPct: Math.floor(rand() * 10), cableDistanceM: 10 + Math.floor(rand() * 25), floors: 1 + Math.floor(rand() * 3), earthingPossible: true, recommendedKw: s.kw, recommendedSystemType: s.systemType },
      photos: [],
      completedAt: surveyAt,
      reviewedBy: salesUser._id,
      reviewedAt,
      createdAt: addHours(qualifiedAt, 1),
      updatedAt: reviewedAt,
    });

    docs.quotes.push({
      _id: ids.quote,
      number: quoteNos[i],
      version: 1,
      leadId: ids.lead,
      customerId: ids.customer,
      packageId: pkg._id,
      packageCode: pkg.code,
      title,
      systemType: s.systemType,
      capacityKw: s.kw,
      lines,
      taxablePaise: totals.taxablePaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      subsidyPaise,
      netCostPaise: totals.totalPaise - subsidyPaise,
      status: "accepted",
      validUntil: addDays(sentAt, 15),
      sentAt,
      acceptedAt,
      createdBy: actor(salesUser),
      createdAt: sentAt,
      updatedAt: acceptedAt,
    });

    // Serial units come from that month's goods receipt, at slightly different costs per batch.
    const monthKey = `${startOfDayIST(dispatchedAt).toISOString().slice(0, 7)}`;
    const month = grnMonths.get(monthKey) ?? { receivedAt: at(addDays(dispatchedAt, -12), 11), lines: new Map() };
    if (month.receivedAt.getTime() > addDays(dispatchedAt, -3).getTime()) month.receivedAt = at(addDays(dispatchedAt, -12), 11);
    grnMonths.set(monthKey, month);
    const batch = 0.97 + rand() * 0.06;

    const pickList = lines
      .filter((l) => l.category !== "service")
      .map((l) => {
        const serials: string[] = [];
        if (l.isSerialized) {
          const prefix = `${serialPrefix(l.sku)}-${run.tag}${monthKey.replace("-", "").slice(2)}`;
          for (let k = 0; k < l.qty; k++) {
            const seq = (serialSeq.get(prefix) ?? 0) + 1;
            serialSeq.set(prefix, seq);
            const serial = `${prefix}-${String(seq).padStart(4, "0")}`;
            serials.push(serial);
            const costPaise = Math.round((l.unitCostPaise * batch) / 100) * 100;
            docs.units.push({
              serial,
              productId: l.productId,
              sku: l.sku,
              productName: l.name,
              category: l.category,
              status: "installed",
              costPaise,
              orderId: ids.order,
              customerId: ids.customer,
              allocatedAt: addHours(dispatchedAt, -20),
              dispatchedAt,
              deliveredAt,
              warrantyStartAt: deliveredAt,
              warrantyEndAt: addMonths(deliveredAt, l.warrantyMonths),
              warrantyMonths: l.warrantyMonths,
              history: [
                { status: "in_stock", at: month.receivedAt, note: "Received", by: keeper.name },
                { status: "allocated", at: addHours(dispatchedAt, -20), note: `Packed for ${orderNos[i]}`, by: keeper.name },
                { status: "dispatched", at: dispatchedAt, note: `Dispatched on ${orderNos[i]}`, by: keeper.name },
                { status: "installed", at: finishAt, note: `Installed by job ${jobNos[i]}`, by: crew[0]!.name },
              ],
              _month: monthKey,
              createdAt: month.receivedAt,
              updatedAt: finishAt,
            });
            const acc = month.lines.get(String(l.productId)) ?? { qty: 0, serials: [], costPaise: costPaise };
            acc.qty += 1;
            acc.serials.push(serial);
            month.lines.set(String(l.productId), acc);
          }
        } else {
          const acc = month.lines.get(String(l.productId)) ?? { qty: 0, serials: [], costPaise: l.unitCostPaise };
          acc.qty += l.qty;
          month.lines.set(String(l.productId), acc);
        }
        docs.moves.push({ productId: l.productId, sku: l.sku, qty: -l.qty, type: "dispatch", serials, refType: "order", refId: ids.order, refNumber: orderNos[i], note: "Dispatched", by: actor(keeper), at: dispatchedAt, createdAt: dispatchedAt, updatedAt: dispatchedAt });
        return { productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, isSerialized: l.isSerialized, serials, picked: !l.isSerialized };
      });

    // Payments: advance at confirmation, balance after commissioning (some still unpaid).
    const advance = Math.round((totals.totalPaise * (0.4 + rand() * 0.2)) / 100_000) * 100_000;
    const balanceAt = at(addDays(c, Math.floor(rand() * 15)), 13);
    const balancePaid = !s.unpaidBalance && balanceAt.getTime() < now.getTime();
    const paid = advance + (balancePaid ? totals.totalPaise - advance : 0);
    docs.payments.push({ receivedAt: confirmedAt, doc: { customerId: ids.customer, orderId: ids.order, amountPaise: advance, mode: pick(rand, ["upi", "upi", "bank_transfer", "cheque"] as const), type: "advance", reference: `UTR${String(Math.floor(rand() * 1e10)).padStart(10, "0")}`, receivedAt: confirmedAt, recordedBy: actor(salesUser) } });
    if (balancePaid) {
      docs.payments.push({ receivedAt: balanceAt, doc: { customerId: ids.customer, orderId: ids.order, invoiceId: ids.invoice, amountPaise: totals.totalPaise - advance, mode: pick(rand, ["upi", "bank_transfer", "bank_transfer", "cash"] as const), type: "balance", reference: `UTR${String(Math.floor(rand() * 1e10)).padStart(10, "0")}`, receivedAt: balanceAt, recordedBy: actor(salesUser) } });
    }

    // Site extras and later warranty repairs (the loss-makers have a visible cause).
    const extraCosts: { label: string; kind: "site" | "warranty"; amountPaise: number; at: Date }[] = s.extras.map((e) => ({ label: e.label, kind: "site", amountPaise: e.amountPaise, at: addDays(finishAt, e.daysAfter) }));
    if (s.overtimeHours) extraCosts.push({ label: "Overtime: crew stayed back for a second-day finish", kind: "site", amountPaise: 3 * 1_800_00, at: finishAt });

    // Subsidy: residential on-grid only; stages dated through the PM Surya Ghar process.
    const applicable = !s.commercial && s.systemType === "on_grid";
    type Step = { status: SubsidyStatus; at: Date };
    const plan: Step[] = s.subsidyRejected
      ? [
          { status: "applied", at: addDays(confirmedAt, 2) },
          { status: "rejected", at: addDays(confirmedAt, 20) },
        ]
      : [
          { status: "applied", at: addDays(confirmedAt, 2) },
          { status: "feasibility_approved", at: addDays(confirmedAt, 9) },
          { status: "net_meter_installed", at: addDays(c, 12) },
          { status: "inspected", at: addDays(c, 28) },
          { status: "disbursed", at: addDays(c, 50 + Math.floor(rand() * 25)) },
        ];
    const steps = applicable ? plan.filter((st) => st.at.getTime() < now.getTime()) : [];
    const subsidyStatus: SubsidyStatus = applicable ? (steps.at(-1)?.status ?? "not_applied") : "not_applicable";

    docs.orders.push({
      _id: ids.order,
      number: orderNos[i],
      quoteId: ids.quote,
      leadId: ids.lead,
      customerId: ids.customer,
      title,
      systemType: s.systemType,
      capacityKw: s.kw,
      siteAddress: address,
      lines,
      taxablePaise: totals.taxablePaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      paidPaise: paid,
      paymentStatus: paid >= totals.totalPaise ? "paid" : "partial",
      status: "commissioned",
      pickList,
      dispatch: { vehicleNo: `TS ${String(7 + (i % 6)).padStart(2, "0")} UB ${1000 + Math.floor(rand() * 8999)}`, driverName: pick(rand, ["Raju", "Srinu", "Yadagiri", "Mallesh"] as const), dispatchedAt, dispatchedBy: actor(keeper), deliveredAt, deliveredBy: actor(keeper), deliveryNote: `Received by ${s.name}` },
      installationJobId: ids.job,
      invoiceId: ids.invoice,
      subsidy: {
        applicable,
        status: subsidyStatus,
        applicationNo: steps.length ? `PMSG-TS-${dispatchedAt.getUTCFullYear()}-${100000 + i * 37}` : undefined,
        expectedPaise: subsidyPaise,
        disbursedPaise: subsidyStatus === "disbursed" ? subsidyPaise : 0,
        history: steps.map((st) => ({ status: st.status, at: st.at, by: salesUser.name, note: st.status === "rejected" ? "Name mismatch on the electricity bill — reapply" : undefined })),
      },
      extraCosts,
      salesUser: actor(salesUser),
      confirmedAt,
      commissionedAt: finishAt,
      notes: MARKER,
      createdAt: acceptedAt,
      updatedAt: finishAt,
    });

    // Sale invoice at dispatch, serials on the lines.
    const serialsBySku = new Map(pickList.map((p) => [p.sku, p.serials]));
    const invLines = lines.map((l) => {
      const sn = serialsBySku.get(l.sku) ?? [];
      return { description: sn.length ? `${l.name} (S/N ${sn.join(", ")})` : l.name, hsn: l.hsn, qty: l.qty, unitPricePaise: l.unitPricePaise, gstRate: l.gstRate, ...computeLine(l) };
    });
    const invTotals = summarize(lines);
    docs.invoices.push({
      _id: ids.invoice,
      number: await reserveInvoice(dispatchedAt),
      type: "sale",
      customerId: ids.customer,
      orderId: ids.order,
      billTo: { name: s.name, phone: s.phone, address: [address.line1, address.city, `Telangana ${address.pincode}`].join(", "), gstin: s.commercial?.gstin },
      lines: invLines,
      ...invTotals,
      paidPaise: paid,
      status: paid >= invTotals.totalPaise ? "paid" : "partially_paid",
      issuedAt: dispatchedAt,
      dueAt: addDays(dispatchedAt, 15),
      notes: `Against order ${orderNos[i]}`,
      createdAt: dispatchedAt,
      updatedAt: balancePaid ? balanceAt : dispatchedAt,
    });

    docs.jobs.push({
      _id: ids.job,
      number: jobNos[i],
      type: "installation",
      orderId: ids.order,
      customerId: ids.customer,
      title: `${s.kw} kW ${s.systemType === "on_grid" ? "On-Grid" : "Off-Grid"} installation`,
      siteAddress: address,
      scheduledFor: startAt,
      estimatedHours: 4 + 1.5 * s.kw,
      technicianIds: crew.map((u) => u._id),
      leadTechnicianId: crew[0]!._id,
      status: "completed",
      startedAt: startAt,
      finishedAt: finishAt,
      confirmedKw: s.kw,
      generationReadingKw: Math.round(s.kw * (0.62 + rand() * 0.2) * 100) / 100,
      checklist: { mounting: true, panels: true, wiring: true, earthing: true, inverter: true, testing: true },
      kitCheck: { complete: true },
      photos: [],
      signature: { dataUrl: SIGNATURE, signedBy: s.name, signedAt: finishAt },
      timeLogs: crew.map((u) => ({ technicianId: u._id, technicianName: u.name, hours, date: startAt })),
      materialsUsed: [],
      completedBy: crew[0]!._id,
      createdAt: confirmedAt,
      updatedAt: finishAt,
    });

    log("order", ids.order, ids.customer, "confirmed", `Order confirmed — pick list of ${pickList.length} items sent to the warehouse; installation ${jobNos[i]} booked (${crew.map((u) => u.name).join(", ")})`, confirmedAt, actor(salesUser));
    log("order", ids.order, ids.customer, "dispatched", `Dispatched with ${pickList.reduce((k, p) => k + p.serials.length, 0)} serials; tax invoice issued`, dispatchedAt, actor(keeper));
    log("order", ids.order, ids.customer, "delivered", `Delivered, received by ${s.name}. Warranties started`, deliveredAt, actor(keeper));
    log("order", ids.order, ids.customer, "commissioned", `Commissioned: ${s.kw} kW installed, signed by ${s.name}`, finishAt, actor(crew[0]!));
    log("job", ids.job, ids.customer, "completed", `Completed: ${crew.length} crew × ${hours} h logged; accepted by ${s.name}`, finishAt, actor(crew[0]!));

    // A warranty replacement later in the job's life: ₹0 to the customer, charged to this installation.
    if (s.repair && addDays(finishAt, s.repair.daysAfter).getTime() < now.getTime()) {
      const repairAt = at(addDays(finishAt, s.repair.daysAfter), 14);
      const old = docs.units.find((u) => u.orderId === ids.order && u.category === s.repair!.category)!;
      const prod = bySku.get(String(old.sku))!;
      const prefix = `${serialPrefix(prod.sku)}-${run.tag}${monthKey.replace("-", "").slice(2)}`;
      const seq = (serialSeq.get(prefix) ?? 0) + 1;
      serialSeq.set(prefix, seq);
      const spare = `${prefix}-${String(seq).padStart(4, "0")}`;
      const tech = installers.find((u) => u.skills.includes("service")) ?? installers[0]!;
      const labourCost = Math.round(2.5 * (rate.get(String(tech._id)) ?? 0));
      const spareCost = old.costPaise as number;
      old.status = "replaced";
      old.replacedBySerial = spare;
      (old.history as object[]).push({ status: "replaced", at: repairAt, note: `Replaced by ${spare} under warranty`, by: tech.name });
      docs.units.push({ ...old, serial: spare, status: "installed", replacesSerial: old.serial, replacedBySerial: undefined, deliveredAt: repairAt, warrantyStartAt: repairAt, history: [{ status: "installed", at: repairAt, note: `Replaced ${old.serial} (remaining warranty carried over)`, by: tech.name }] });
      const acc = month.lines.get(String(prod._id))!;
      acc.qty += 1;
      acc.serials.push(spare);
      docs.moves.push({ productId: prod._id, sku: prod.sku, qty: -1, type: "service_issue", serials: [spare], refType: "ticket", note: `Warranty replacement for ${old.serial}`, by: actor(keeper), at: repairAt, createdAt: repairAt, updatedAt: repairAt });
      extraCosts.push({ label: `Warranty repair (${s.repair.category === "inverter" ? "inverter IGBT failure" : "cracked panel"}) — unit replaced`, kind: "warranty", amountPaise: spareCost + labourCost, at: repairAt });
      docs.tickets.push({
        _ref: { customerId: ids.customer, orderId: ids.order, serial: old.serial, productName: old.productName, endsAt: old.warrantyEndAt, at: addHours(repairAt, -30), repairAt, spare, tech, cost: spareCost + labourCost, category: s.repair.category === "inverter" ? "fault_code" : "physical_damage" },
      });
    }
  }

  // Monthly goods receipts for everything that left the warehouse, with the matching ledger entries.
  const months = [...grnMonths.entries()].sort((a, b) => a[1].receivedAt.getTime() - b[1].receivedAt.getTime());
  const grnNos = await reserve("SP-GRN", months.length);
  const purchases = months.map(([key, m], idx) => {
    const id = new Types.ObjectId();
    const lines = [...m.lines.entries()].map(([pid, l]) => {
      const p = productById.get(pid)!;
      return { productId: p._id, sku: p.sku, name: p.name, qty: l.qty, unitCostPaise: l.costPaise, serials: l.serials };
    });
    for (const l of lines) docs.moves.push({ productId: l.productId, sku: l.sku, qty: l.qty, type: "purchase", serials: l.serials, refType: "purchase", refId: id, refNumber: grnNos[idx], note: "Monthly replenishment", by: actor(keeper), at: m.receivedAt, createdAt: m.receivedAt, updatedAt: m.receivedAt });
    for (const u of docs.units) if (u._month === key) u.purchaseId = id;
    return {
      _id: id,
      number: grnNos[idx],
      supplier: { name: "Sri Venkateswara Solar Distributors", gstin: "36ABCFS7214K1Z8" },
      invoiceNo: `SVSD/${run.tag}/${key}`,
      invoiceDate: addDays(m.receivedAt, -1),
      lines,
      totalPaise: lines.reduce((s, l) => s + l.qty * l.unitCostPaise, 0),
      receivedAt: m.receivedAt,
      receivedBy: actor(keeper),
      notes: GRN_NOTE,
      createdAt: m.receivedAt,
      updatedAt: m.receivedAt,
    };
  });
  for (const u of docs.units) delete u._month;

  // Historical tickets for the warranty replacements (closed after the customer confirmed).
  const ticketNos = await reserve("SP-T", docs.tickets.length);
  const tickets = (docs.tickets as { _ref: { customerId: Types.ObjectId; orderId: Types.ObjectId; serial: string; productName: string; endsAt: Date; at: Date; repairAt: Date; spare: string; tech: (typeof users)[number]; cost: number; category: string } }[]).map(({ _ref: r }, k) => {
    const id = new Types.ObjectId();
    log("ticket", id, r.customerId, "created", `${r.category === "fault_code" ? "Inverter fault code" : "Physical damage"} on ${r.serial}: in warranty until ${r.endsAt.toISOString().slice(0, 10)} — free of charge`, r.at, actor(support));
    log("ticket", id, r.customerId, "resolved", `Unit replaced with ${r.spare}. ₹0 to the customer (cost charged to the installation)`, r.repairAt, actor(r.tech));
    log("ticket", id, r.customerId, "closed", "Customer confirmed it works; closed", addHours(r.repairAt, 20), actor(support));
    return {
      _id: id,
      number: ticketNos[k],
      customerId: r.customerId,
      orderId: r.orderId,
      serial: r.serial,
      productName: r.productName,
      category: r.category,
      description: r.category === "fault_code" ? "Inverter showing a fault code, zero power since the storm" : "One panel cracked after a hailstorm",
      priority: "high",
      channel: "phone",
      status: "closed",
      warranty: { state: "in_warranty", basis: "serial", endsAt: r.endsAt, checkedAt: r.at },
      billable: false,
      assignedTo: { id: r.tech._id, name: r.tech.name },
      resolution: { type: "replacement", notes: "Faulty unit swapped and tested", partsUsed: [], labourHours: 2.5, labourRatePaise: 60_000, replacementSerial: r.spare, resolvedAt: r.repairAt, resolvedBy: { id: r.tech._id, name: r.tech.name } },
      customerConfirmedAt: addHours(r.repairAt, 18),
      confirmation: { confirmedBy: "Customer", channel: "call", recordedBy: { id: support._id, name: support.name }, at: addHours(r.repairAt, 18) },
      serviceCostPaise: r.cost,
      reopenCount: 0,
      slaDueAt: addHours(r.at, 24),
      closedAt: addHours(r.repairAt, 20),
      createdBy: { id: support._id, name: support.name },
      createdAt: r.at,
      updatedAt: addHours(r.repairAt, 20),
    };
  });

  const paymentNos = await reserve("SP-PAY", docs.payments.length);
  const payments = docs.payments.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()).map((p, k) => ({ ...p.doc, number: paymentNos[k], createdAt: p.receivedAt, updatedAt: p.receivedAt }));

  const opts = { ordered: false } as const;
  await Customer.insertMany(docs.customers, opts);
  await Promise.all([
    Lead.insertMany(docs.leads, opts),
    Survey.insertMany(docs.surveys, opts),
    Quote.insertMany(docs.quotes, opts),
    Order.insertMany(docs.orders, opts),
    Job.insertMany(docs.jobs, opts),
    Invoice.insertMany(docs.invoices, opts),
    Payment.insertMany(payments, opts),
    Purchase.insertMany(purchases, opts),
    SerialUnit.insertMany(docs.units, opts),
    StockMove.insertMany(docs.moves, opts),
    Ticket.insertMany(tickets, opts),
    Activity.insertMany(docs.activities, opts),
  ]);
  const losers = docs.orders.filter((o) => (o as { extraCosts: unknown[] }).extraCosts.length).length;
  return { installations: n, summary: `${n} installations (${docs.units.length} serials, ${purchases.length} monthly GRNs, ${payments.length} payments, ${tickets.length} warranty repairs, ${losers} jobs with extra costs)` };
}
