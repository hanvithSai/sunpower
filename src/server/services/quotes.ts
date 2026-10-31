/**
 * Quotes: built from a package template after the site survey is approved.
 *
 * Gate: a quote can only be created when the lead's survey is approved — so
 * prices always rest on real roof measurements. Saving re-reads every product
 * from the catalog (cost, GST, HSN, warranty) and recomputes totals; sales may
 * only adjust quantities and unit prices. Accepting a quote creates the Order.
 */
import { Types } from "mongoose";
import { QUOTE_STATUSES, QUOTE_VALIDITY_DAYS, SYSTEM_TYPE_LABELS, type QuoteStatus } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { escapeRegex, formatDate } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { lineFromProduct, quoteTotals, type CatalogProduct } from "@/lib/quote-calc";
import { isSubsidyEligible } from "@/lib/subsidy";
import type { SaveQuoteInput } from "@/lib/validation/quotes";
import { LEAD_FLOW, QUOTE_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import { actorRef, type Actor } from "../lib/actor";
import { Customer, Lead, Order, Package, Product, Quote, Survey, type IProduct } from "../models";
import { getActiveCatalog } from "./catalog";
import { logActivity } from "./core/activity";
import { nextNumber } from "./core/counters";

const QUOTABLE_LEAD_STATUSES = new Set(["survey_approved", "quoted"]);

/** Why a lead can't be quoted yet (null = allowed). */
async function quoteGate(leadId: Types.ObjectId, leadStatus: string): Promise<string | null> {
  if (!QUOTABLE_LEAD_STATUSES.has(leadStatus)) {
    return "Quotes unlock after the site survey is approved.";
  }
  const approved = await Survey.exists({ leadId, status: "approved" });
  return approved ? null : "This lead has no approved site survey yet.";
}

/* ------------------------------------------------------------------ */
/* Builder context                                                     */
/* ------------------------------------------------------------------ */

export async function getQuoteBuilderContext(leadId: string, fromQuoteId?: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(leadId)) return null;
  const lead = await Lead.findById(leadId).lean();
  if (!lead) return null;

  const [customer, survey, catalog, from] = await Promise.all([
    Customer.findById(lead.customerId).select("type address").lean(),
    Survey.findOne({ leadId: lead._id, status: "approved" }).sort({ reviewedAt: -1 }).lean(),
    getActiveCatalog(),
    fromQuoteId && Types.ObjectId.isValid(fromQuoteId) ? Quote.findOne({ _id: fromQuoteId, leadId: lead._id }).lean() : Promise.resolve(null),
  ]);
  const blocked = await quoteGate(lead._id, lead.status);

  const recommendedKw = survey?.measurements?.recommendedKw ?? lead.requirement.capacityKw;
  const recommendedType = survey?.measurements?.recommendedSystemType ?? (lead.requirement.systemType === "off_grid" ? "off_grid" : "on_grid");
  const defaultPackage =
    catalog.packages.find((p) => p.capacityKw === recommendedKw && p.systemType === recommendedType) ??
    catalog.packages.find((p) => p.systemType === recommendedType) ??
    catalog.packages[0];

  return {
    lead: {
      id: String(lead._id),
      number: lead.number,
      name: lead.name,
      city: lead.city,
      status: lead.status,
      wantsSubsidy: lead.requirement.wantsSubsidy,
    },
    customerType: customer?.type ?? "residential",
    blockedReason: blocked,
    survey: survey?.measurements
      ? { number: survey.number, recommendedKw, recommendedSystemType: recommendedType, shadingPct: survey.measurements.shadingPct }
      : null,
    catalog,
    defaultPackageId: defaultPackage?.id,
    from: from
      ? {
          number: from.number,
          capacityKw: from.capacityKw,
          systemType: from.systemType,
          packageId: from.packageId ? String(from.packageId) : undefined,
          notes: from.notes,
          lines: from.lines.map((l) => ({ productId: String(l.productId), qty: l.qty, unitPricePaise: l.unitPricePaise })),
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Save                                                                */
/* ------------------------------------------------------------------ */

function toCatalogProduct(p: IProduct): CatalogProduct {
  return {
    id: String(p._id),
    sku: p.sku,
    name: p.name,
    category: p.category,
    unit: p.unit,
    pricePaise: p.pricePaise,
    costPaise: p.costPaise,
    gstRate: p.gstRate,
    hsn: p.hsn,
    isSerialized: p.isSerialized,
    warrantyMonths: p.warrantyMonths,
  };
}

export async function saveQuote(
  input: SaveQuoteInput,
  actor: Actor,
): Promise<{ quoteId: string; number: string; totalPaise: number; packageCode?: string }> {
  await connectDB();
  // Merge duplicate products (e.g. the same cable added twice) into one line.
  const merged = new Map<string, { qty: number; unitPriceRs: number }>();
  for (const line of input.lines) {
    const existing = merged.get(line.productId);
    merged.set(line.productId, { qty: (existing?.qty ?? 0) + line.qty, unitPriceRs: line.unitPriceRs });
  }
  const products = await Product.find({ _id: { $in: [...merged.keys()] }, active: true }).lean();
  if (products.length !== merged.size) {
    throw new AppError("VALIDATION", "Some items are no longer in the catalog. Refresh and try again.", { lines: "Unknown product" });
  }
  const lines = products.map((p) => {
    const entry = merged.get(String(p._id))!;
    return lineFromProduct(toCatalogProduct(p), entry.qty, Math.round(entry.unitPriceRs * 100));
  });
  // Keep the catalog's natural order (panels first, services last).
  lines.sort((a, b) => (a.category === "service" ? 1 : 0) - (b.category === "service" ? 1 : 0));

  return withTransaction(async (session) => {
    const now = new Date();
    const lead = await Lead.findById(input.leadId).session(session);
    if (!lead) throw notFoundError("Lead");
    const blocked = await quoteGate(lead._id, lead.status);
    if (blocked) throw new AppError("INVALID_STATE", blocked);

    const customer = await Customer.findById(lead.customerId).session(session).lean();
    const totals = quoteTotals(lines, {
      capacityKw: input.capacityKw,
      systemType: input.systemType,
      customerType: customer?.type ?? "residential",
      wantsSubsidy: lead.requirement.wantsSubsidy,
    });
    const version = (await Quote.countDocuments({ leadId: lead._id }).session(session)) + 1;
    const number = await nextNumber("quote", session);
    const packageDoc = input.packageId ? await Package.findById(input.packageId).select("code").session(session).lean() : null;

    const [quote] = await Quote.create(
      [
        {
          number,
          version,
          leadId: lead._id,
          customerId: lead.customerId,
          packageId: packageDoc?._id,
          packageCode: packageDoc?.code,
          title: `${input.capacityKw} kW ${SYSTEM_TYPE_LABELS[input.systemType]} system`,
          systemType: input.systemType,
          capacityKw: input.capacityKw,
          lines,
          taxablePaise: totals.taxablePaise,
          gstPaise: totals.gstPaise,
          totalPaise: totals.totalPaise,
          subsidyPaise: totals.subsidyPaise,
          netCostPaise: totals.netCostPaise,
          status: input.send ? "sent" : "draft",
          sentAt: input.send ? now : undefined,
          validUntil: addDays(now, QUOTE_VALIDITY_DAYS),
          notes: input.notes,
          createdBy: actorRef(actor),
        },
      ],
      { session },
    );

    if (lead.status === "survey_approved") {
      assertTransition("lead", LEAD_FLOW, lead.status, "quoted");
      lead.status = "quoted";
    }
    lead.quoteId = quote._id;
    lead.lastActivityAt = now;
    await lead.save({ session });

    const message = `Quote ${number} (v${version}) ${input.send ? "sent" : "drafted"}: ${input.capacityKw} kW ${SYSTEM_TYPE_LABELS[input.systemType]} for ${formatINR(totals.totalPaise)}${totals.subsidyPaise ? ` (${formatINR(totals.netCostPaise)} after subsidy)` : ""}`;
    await logActivity({ entityType: "quote", entityId: quote._id, customerId: lead.customerId, action: "created", message, actor }, session);
    await logActivity({ entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "quoted", message, actor }, session);
    return { quoteId: String(quote._id), number, totalPaise: totals.totalPaise, packageCode: packageDoc?.code };
  });
}

/* ------------------------------------------------------------------ */
/* Lists & detail                                                      */
/* ------------------------------------------------------------------ */

export async function listQuotes(filter: { status?: string; q?: string; page?: number; pageSize?: number }) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.status && (QUOTE_STATUSES as readonly string[]).includes(filter.status)) query.status = filter.status;
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const leadIds = await Lead.find({ $or: [{ name: rx }, { city: rx }] }).select("_id").limit(200).lean();
    query.$or = [{ number: rx }, { leadId: { $in: leadIds.map((l) => l._id) } }];
  }
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 20);
  const countQuery = { ...query };
  delete countQuery.status;
  const [quotes, total, grouped] = await Promise.all([
    Quote.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Quote.countDocuments(query),
    Quote.aggregate<{ _id: QuoteStatus; n: number }>([{ $match: countQuery }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const leads = await Lead.find({ _id: { $in: quotes.map((x) => x.leadId) } }).select("name city number").lean();
  const leadById = new Map(leads.map((l) => [String(l._id), l]));
  return {
    items: quotes.map((x) => {
      const lead = leadById.get(String(x.leadId));
      return {
        id: String(x._id),
        number: x.number,
        version: x.version,
        customerName: lead?.name ?? "—",
        city: lead?.city ?? "",
        leadId: String(x.leadId),
        title: x.title,
        totalPaise: x.totalPaise,
        netCostPaise: x.netCostPaise,
        status: x.status,
        validUntil: x.validUntil,
        createdAt: x.createdAt,
      };
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: Object.fromEntries(grouped.map((g) => [g._id, g.n])) as Partial<Record<QuoteStatus, number>>,
  };
}

export async function getQuoteDetail(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const quote = await Quote.findById(id).lean();
  if (!quote) return null;
  const [lead, customer, order] = await Promise.all([
    Lead.findById(quote.leadId).select("number name phone email city status").lean(),
    Customer.findById(quote.customerId).lean(),
    Order.findOne({ quoteId: quote._id }).select("number status").lean(),
  ]);
  const costPaise = quote.lines.reduce((sum, l) => sum + Math.round(l.qty * l.unitCostPaise), 0);
  return {
    quote: {
      id: String(quote._id),
      number: quote.number,
      version: quote.version,
      title: quote.title,
      packageCode: quote.packageCode,
      systemType: quote.systemType,
      capacityKw: quote.capacityKw,
      lines: quote.lines.map((l) => ({ ...l, productId: String(l.productId) })),
      taxablePaise: quote.taxablePaise,
      gstPaise: quote.gstPaise,
      totalPaise: quote.totalPaise,
      subsidyPaise: quote.subsidyPaise,
      netCostPaise: quote.netCostPaise,
      marginPaise: quote.taxablePaise - costPaise,
      status: quote.status,
      validUntil: quote.validUntil,
      sentAt: quote.sentAt,
      acceptedAt: quote.acceptedAt,
      rejectedReason: quote.rejectedReason,
      notes: quote.notes,
      createdBy: quote.createdBy.name,
      createdAt: quote.createdAt,
    },
    lead: lead ? { id: String(lead._id), number: lead.number, name: lead.name, phone: lead.phone, email: lead.email, city: lead.city, status: lead.status } : null,
    customer: customer
      ? { id: String(customer._id), name: customer.name, phone: customer.phone, email: customer.email, type: customer.type, address: customer.address, gstin: customer.gstin }
      : null,
    order: order ? { id: String(order._id), number: order.number, status: order.status } : null,
  };
}

/* ------------------------------------------------------------------ */
/* Status changes                                                      */
/* ------------------------------------------------------------------ */

export async function markQuoteSent(quoteId: string, actor: Actor): Promise<void> {
  await withTransaction(async (session) => {
    const quote = await Quote.findById(quoteId).session(session);
    if (!quote) throw notFoundError("Quote");
    assertTransition("quote", QUOTE_FLOW, quote.status, "sent");
    quote.status = "sent";
    quote.sentAt = new Date();
    await quote.save({ session });
    await logActivity(
      { entityType: "quote", entityId: quote._id, customerId: quote.customerId, action: "sent", message: `Quote ${quote.number} sent to the customer`, actor },
      session,
    );
  });
}

export async function rejectQuote(quoteId: string, reason: string, actor: Actor): Promise<void> {
  await withTransaction(async (session) => {
    const quote = await Quote.findById(quoteId).session(session);
    if (!quote) throw notFoundError("Quote");
    assertTransition("quote", QUOTE_FLOW, quote.status, "rejected");
    quote.status = "rejected";
    quote.rejectedReason = reason;
    await quote.save({ session });
    await logActivity(
      { entityType: "quote", entityId: quote._id, customerId: quote.customerId, action: "rejected", message: `Quote ${quote.number} declined: ${reason}`, actor },
      session,
    );
  });
}

/**
 * The customer said yes: the quote becomes an Order (awaiting payment), the
 * lead is won, and any other open quotes for the lead are superseded.
 */
export async function acceptQuote(quoteId: string, actor: Actor): Promise<{ orderId: string; number: string }> {
  return withTransaction(async (session) => {
    const now = new Date();
    const quote = await Quote.findById(quoteId).session(session);
    if (!quote) throw notFoundError("Quote");
    assertTransition("quote", QUOTE_FLOW, quote.status, "accepted");
    if (quote.validUntil < now) {
      throw new AppError("INVALID_STATE", `This quote expired on ${formatDate(quote.validUntil)}. Create a revised quote first.`);
    }
    const lead = await Lead.findById(quote.leadId).session(session);
    if (!lead) throw notFoundError("Lead");
    const customer = await Customer.findById(quote.customerId).session(session).lean();
    if (!customer) throw notFoundError("Customer");

    quote.status = "accepted";
    quote.acceptedAt = now;
    await quote.save({ session });

    const others = await Quote.find({ leadId: lead._id, _id: { $ne: quote._id }, status: { $in: ["draft", "sent"] } }).session(session);
    for (const other of others) {
      other.status = "rejected";
      other.rejectedReason = `Superseded by ${quote.number}`;
      await other.save({ session });
    }

    const subsidyApplicable = isSubsidyEligible(quote.systemType, customer.type) && lead.requirement.wantsSubsidy;
    const number = await nextNumber("order", session);
    const [order] = await Order.create(
      [
        {
          number,
          quoteId: quote._id,
          leadId: lead._id,
          customerId: customer._id,
          title: quote.title,
          systemType: quote.systemType,
          capacityKw: quote.capacityKw,
          siteAddress: customer.address,
          lines: quote.lines,
          taxablePaise: quote.taxablePaise,
          gstPaise: quote.gstPaise,
          totalPaise: quote.totalPaise,
          paidPaise: 0,
          paymentStatus: "unpaid",
          status: "pending_payment",
          pickList: [],
          dispatch: {},
          subsidy: {
            applicable: subsidyApplicable,
            status: subsidyApplicable ? "not_applied" : "not_applicable",
            expectedPaise: subsidyApplicable ? quote.subsidyPaise : 0,
            disbursedPaise: 0,
            history: [],
          },
          extraCosts: [],
          salesUser: actorRef(actor),
        },
      ],
      { session },
    );

    assertTransition("lead", LEAD_FLOW, lead.status, "won");
    lead.status = "won";
    lead.orderId = order._id;
    lead.lastActivityAt = now;
    await lead.save({ session });

    const message = `Quote ${quote.number} accepted — order ${number} created for ${formatINR(quote.totalPaise)}`;
    await logActivity({ entityType: "quote", entityId: quote._id, customerId: customer._id, action: "accepted", message, actor }, session);
    await logActivity({ entityType: "lead", entityId: lead._id, customerId: customer._id, action: "won", message, actor }, session);
    await logActivity(
      { entityType: "order", entityId: order._id, customerId: customer._id, action: "created", message: `Order ${number} created from quote ${quote.number}. Awaiting advance payment.`, actor },
      session,
    );
    return { orderId: String(order._id), number };
  });
}
