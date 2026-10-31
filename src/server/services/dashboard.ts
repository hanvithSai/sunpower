/**
 * The director's month-end, any day: "which installations made money, which
 * lost money, and what is still unfinished?" — for today, this week or this
 * month (IST), from live data.
 *
 *   KPIs        revenue (invoiced, excl. GST), cash collected, advances held on
 *               unfinished orders, stock purchased, technician hours, installs
 *               commissioned and their margin, new leads, open repairs
 *   trend       12 months of invoiced revenue and cash collected
 *   profit      per installation from actuals (services/costing.ts), losers first
 *   unfinished  every customer waiting on a step, step by step
 *   repairs     open tickets by age; subsidy files by stage
 *
 * `masked` hides customer names for read-only share links (initial + city).
 */
import type { Types } from "mongoose";
import { LEAD_FIRST_RESPONSE_SLA_HOURS, type OrderStatus, type SubsidyStatus } from "@/lib/constants";
import { getPreviousRange, getRange, type RangeKey } from "@/lib/dates";
import { maskName } from "@/lib/format";
import { SUBSIDY_STEPS } from "@/lib/workflows";
import { connectDB } from "../db";
import { Customer, Invoice, Job, Lead, Order, Payment, Purchase, Quote, Survey, Ticket } from "../models";
import { costOrders, type Costing } from "./costing";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });

/** Orders holding customer money for work not finished yet. */
const UNFINISHED: OrderStatus[] = ["confirmed", "ready_to_dispatch", "dispatched", "delivered", "installing"];

export { maskName };

type SumRow = { _id: null; total: number; n: number };
const sumOf = (rows: SumRow[]) => ({ total: rows[0]?.total ?? 0, n: rows[0]?.n ?? 0 });

async function totals(start: Date, end: Date) {
  const [revenue, cash, purchases, hours, leads, commissioned] = await Promise.all([
    Invoice.aggregate<SumRow>([{ $match: { issuedAt: { $gte: start, $lt: end }, status: { $ne: "void" } } }, { $group: { _id: null, total: { $sum: "$taxablePaise" }, n: { $sum: 1 } } }]),
    Payment.aggregate<SumRow>([{ $match: { receivedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: "$amountPaise" }, n: { $sum: 1 } } }]),
    Purchase.aggregate<SumRow>([{ $match: { receivedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: "$totalPaise" }, n: { $sum: 1 } } }]),
    Job.aggregate<SumRow>([
      { $unwind: "$timeLogs" },
      { $match: { "timeLogs.date": { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$timeLogs.hours" }, n: { $sum: 1 } } },
    ]),
    Lead.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Order.find({ commissionedAt: { $gte: start, $lt: end } }).select("taxablePaise lines pickList extraCosts").lean(),
  ]);
  return { revenue: sumOf(revenue), cash: sumOf(cash), purchases: sumOf(purchases), hours: sumOf(hours), leads, commissioned };
}

export type ProfitRow = {
  id: string;
  number: string;
  customer: string;
  city: string;
  capacityKw: number;
  systemType: string;
  commissionedAt?: Date;
  status: OrderStatus;
} & Costing;

/** Profit per installation, worst first. `scope: "all"` ignores the period. */
export async function getProfitTable(opts: { start?: Date; end?: Date; masked?: boolean; limit?: number } = {}): Promise<ProfitRow[]> {
  await connectDB();
  const query: Record<string, unknown> = { commissionedAt: opts.start && opts.end ? { $gte: opts.start, $lt: opts.end } : { $exists: true } };
  const orders = await Order.find(query).sort({ commissionedAt: -1 }).limit(opts.limit ?? 200).lean();
  const [costs, customers] = await Promise.all([costOrders(orders), Customer.find({ _id: { $in: orders.map((o) => o.customerId) } }).select("name address.city").lean()]);
  const customerById = new Map(customers.map((c) => [String(c._id), c]));
  return orders
    .map((o) => {
      const c = customerById.get(String(o.customerId));
      return {
        id: String(o._id),
        number: o.number,
        customer: c ? (opts.masked ? maskName(c.name) : c.name) : "—",
        city: c?.address.city ?? o.siteAddress.city,
        capacityKw: o.capacityKw,
        systemType: o.systemType,
        commissionedAt: o.commissionedAt,
        status: o.status,
        ...costs.get(String(o._id))!,
      };
    })
    .sort((a, b) => a.marginPct - b.marginPct);
}

export type UnfinishedStep = {
  key: string;
  label: string;
  /** Who acts next. */
  owner: string;
  count: number;
  href: string;
  items: { id: string; title: string; subtitle: string; href: string; since: Date }[];
};

async function unfinishedSteps(now: Date, masked: boolean): Promise<UnfinishedStep[]> {
  const slaCutoff = new Date(now.getTime() - LEAD_FIRST_RESPONSE_SLA_HOURS * HOUR_MS);
  const name = (n?: string) => (n ? (masked ? maskName(n) : n) : "—");
  const take = 5;

  const [leads, leadsN, surveys, surveysN, quotes, quotesN, toDispatch, toDispatchN, toInstall, toInstallN, balance, subsidy, subsidyN, toConfirm, toConfirmN] = await Promise.all([
    Lead.find({ status: "new", createdAt: { $lt: slaCutoff } }).sort({ createdAt: 1 }).limit(take).select("number name city createdAt").lean(),
    Lead.countDocuments({ status: "new", createdAt: { $lt: slaCutoff } }),
    Survey.find({ status: "completed" }).sort({ updatedAt: 1 }).limit(take).select("number customerId updatedAt").lean(),
    Survey.countDocuments({ status: "completed" }),
    Quote.find({ status: "sent", validUntil: { $gte: now } }).sort({ sentAt: 1 }).limit(take).select("number title customerId sentAt createdAt").lean(),
    Quote.countDocuments({ status: "sent", validUntil: { $gte: now } }),
    Order.find({ status: { $in: ["confirmed", "ready_to_dispatch"] } }).sort({ confirmedAt: 1 }).limit(take).select("number title customerId confirmedAt").lean(),
    Order.countDocuments({ status: { $in: ["confirmed", "ready_to_dispatch"] } }),
    Order.find({ status: { $in: ["delivered", "installing"] } }).sort({ "dispatch.deliveredAt": 1 }).limit(take).select("number title customerId dispatch.deliveredAt").lean(),
    Order.countDocuments({ status: { $in: ["delivered", "installing"] } }),
    Order.find({ status: { $in: ["commissioned", "closed"] }, $expr: { $lt: ["$paidPaise", "$totalPaise"] } }).sort({ commissionedAt: 1 }).select("number title customerId commissionedAt closedAt totalPaise paidPaise").lean(),
    Order.find({ "subsidy.applicable": true, "subsidy.status": { $nin: ["disbursed", "not_applicable"] }, status: { $in: ["commissioned", "closed"] } }).sort({ commissionedAt: 1 }).limit(take).select("number customerId subsidy commissionedAt").lean(),
    Order.countDocuments({ "subsidy.applicable": true, "subsidy.status": { $nin: ["disbursed", "not_applicable"] }, status: { $in: ["commissioned", "closed"] } }),
    Ticket.find({ status: "resolved" }).sort({ updatedAt: 1 }).limit(take).select("number customerId updatedAt").lean(),
    Ticket.countDocuments({ status: "resolved" }),
  ]);
  const customerIds = [...surveys, ...quotes, ...toDispatch, ...toInstall, ...balance, ...subsidy, ...toConfirm].map((d) => d.customerId as Types.ObjectId);
  const customers = await Customer.find({ _id: { $in: customerIds } }).select("name address.city").lean();
  const cust = new Map(customers.map((c) => [String(c._id), c]));
  const who = (id: Types.ObjectId) => cust.get(String(id));

  return [
    {
      key: "uncontacted",
      label: "Enquiries not called back",
      owner: "Sales",
      count: leadsN,
      href: "/leads?status=new",
      items: leads.map((l) => ({ id: String(l._id), title: name(l.name), subtitle: `${l.number} · ${l.city}`, href: `/leads/${l._id}`, since: l.createdAt })),
    },
    {
      key: "survey_review",
      label: "Surveys waiting for approval",
      owner: "Sales",
      count: surveysN,
      href: "/surveys?status=completed",
      items: surveys.map((s) => ({ id: String(s._id), title: name(who(s.customerId)?.name), subtitle: s.number, href: `/surveys/${s._id}`, since: s.updatedAt })),
    },
    {
      key: "quote_reply",
      label: "Quotes waiting for the customer",
      owner: "Sales",
      count: quotesN,
      href: "/quotes?status=sent",
      items: quotes.map((q) => ({ id: String(q._id), title: name(who(q.customerId)?.name), subtitle: `${q.number} · ${q.title}`, href: `/quotes/${q._id}`, since: q.sentAt ?? q.createdAt })),
    },
    {
      key: "to_dispatch",
      label: "Paid, not dispatched",
      owner: "Warehouse",
      count: toDispatchN,
      href: "/dispatch",
      items: toDispatch.map((o) => ({ id: String(o._id), title: name(who(o.customerId)?.name), subtitle: `${o.number} · ${o.title}`, href: `/dispatch/${o._id}`, since: o.confirmedAt ?? now })),
    },
    {
      key: "to_install",
      label: "Delivered, not installed",
      owner: "Crew",
      count: toInstallN,
      href: "/jobs",
      items: toInstall.map((o) => ({ id: String(o._id), title: name(who(o.customerId)?.name), subtitle: `${o.number} · ${o.title}`, href: `/orders/${o._id}`, since: o.dispatch?.deliveredAt ?? now })),
    },
    {
      key: "balance_due",
      label: "Completed, balance unpaid",
      owner: "Accounts",
      count: balance.length,
      href: "/invoices?status=open",
      items: balance.slice(0, take).map((o) => ({ id: String(o._id), title: name(who(o.customerId)?.name), subtitle: `${o.number} · ₹${Math.round((o.totalPaise - o.paidPaise) / 100).toLocaleString("en-IN")} due`, href: `/orders/${o._id}`, since: o.commissionedAt ?? o.closedAt ?? now })),
    },
    {
      key: "subsidy",
      label: "Subsidy not yet disbursed",
      owner: "Sales",
      count: subsidyN,
      href: "/subsidy",
      items: subsidy.map((o) => ({ id: String(o._id), title: name(who(o.customerId)?.name), subtitle: `${o.number} · ${o.subsidy.status.replace(/_/g, " ")}`, href: `/orders/${o._id}`, since: o.commissionedAt ?? now })),
    },
    {
      key: "confirm_fix",
      label: "Repairs waiting for the customer's OK",
      owner: "Support",
      count: toConfirmN,
      href: "/service?status=resolved",
      items: toConfirm.map((t) => ({ id: String(t._id), title: name(who(t.customerId)?.name), subtitle: t.number, href: `/service/${t._id}`, since: t.updatedAt })),
    },
  ];
}

export async function getDashboard(range: RangeKey, now: Date, opts: { masked?: boolean } = {}) {
  await connectDB();
  const masked = Boolean(opts.masked);
  const current = getRange(range, now);
  const previous = getPreviousRange(range, now);
  // Twelve IST calendar months ending with this one; the 15th sits safely inside each month.
  const ist = new Date(now.getTime() + 330 * 60_000);
  const monthAnchors = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 11 + i, 15)));
  const trendStart = getRange("month", monthAnchors[0]!).start;

  const [cur, prev, advances, openTickets, revenueByMonth, cashByMonth, profit, steps, repairs, subsidyRows] = await Promise.all([
    totals(current.start, current.end),
    totals(previous.start, previous.end),
    Order.aggregate<SumRow>([{ $match: { status: { $in: UNFINISHED } } }, { $group: { _id: null, total: { $sum: "$paidPaise" }, n: { $sum: 1 } } }]),
    Ticket.countDocuments({ status: { $nin: ["closed"] } }),
    Invoice.aggregate<{ _id: string; total: number }>([
      { $match: { issuedAt: { $gte: trendStart }, status: { $ne: "void" } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$issuedAt", timezone: "Asia/Kolkata" } }, total: { $sum: "$taxablePaise" } } },
    ]),
    Payment.aggregate<{ _id: string; total: number }>([
      { $match: { receivedAt: { $gte: trendStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$receivedAt", timezone: "Asia/Kolkata" } }, total: { $sum: "$amountPaise" } } },
    ]),
    getProfitTable({ start: current.start, end: current.end, masked }),
    unfinishedSteps(now, masked),
    Ticket.find({ status: { $nin: ["closed"] } }).select("number status priority createdAt customerId category").sort({ createdAt: 1 }).lean(),
    Order.aggregate<{ _id: SubsidyStatus; n: number; expected: number; disbursed: number }>([
      { $match: { "subsidy.applicable": true, status: { $ne: "cancelled" } } },
      { $group: { _id: "$subsidy.status", n: { $sum: 1 }, expected: { $sum: "$subsidy.expectedPaise" }, disbursed: { $sum: "$subsidy.disbursedPaise" } } },
    ]),
  ]);

  const commissionedCosts = await costOrders(cur.commissioned);
  const marginRevenue = cur.commissioned.reduce((s, o) => s + o.taxablePaise, 0);
  const marginProfit = [...commissionedCosts.values()].reduce((s, c) => s + c.profitPaise, 0);

  const rev = new Map(revenueByMonth.map((r) => [r._id, r.total]));
  const cash = new Map(cashByMonth.map((r) => [r._id, r.total]));
  const months = monthAnchors.map((d) => {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: MONTH_FMT.format(d), revenuePaise: rev.get(key) ?? 0, cashPaise: cash.get(key) ?? 0 };
  });

  const ages = [
    { label: "Under a day", max: 1 },
    { label: "1–3 days", max: 3 },
    { label: "3–7 days", max: 7 },
    { label: "Over a week", max: Infinity },
  ];
  const repairCustomers = await Customer.find({ _id: { $in: repairs.slice(0, 6).map((t) => t.customerId) } }).select("name").lean();
  const repairName = new Map(repairCustomers.map((c) => [String(c._id), c.name]));
  const bySubsidy = new Map(subsidyRows.map((r) => [r._id, r]));

  return {
    range,
    period: current,
    kpis: {
      revenuePaise: cur.revenue.total,
      revenuePrevPaise: prev.revenue.total,
      cashPaise: cur.cash.total,
      cashPrevPaise: prev.cash.total,
      advancesHeldPaise: advances[0]?.total ?? 0,
      advancesOrders: advances[0]?.n ?? 0,
      purchasedPaise: cur.purchases.total,
      purchases: cur.purchases.n,
      hoursLogged: cur.hours.total,
      newLeads: cur.leads,
      newLeadsPrev: prev.leads,
      commissioned: cur.commissioned.length,
      marginPct: marginRevenue ? Math.round((marginProfit / marginRevenue) * 1000) / 10 : null,
      openTickets,
    },
    trend: months,
    profit,
    unfinished: steps,
    repairs: {
      byAge: ages.map((a, i) => ({
        label: a.label,
        count: repairs.filter((t) => {
          const days = (now.getTime() - t.createdAt.getTime()) / DAY_MS;
          return days < a.max && days >= (i ? ages[i - 1]!.max : 0);
        }).length,
      })),
      oldest: repairs.slice(0, 6).map((t) => ({
        id: String(t._id),
        number: t.number,
        status: t.status,
        priority: t.priority,
        customer: masked ? maskName(repairName.get(String(t.customerId)) ?? "—") : (repairName.get(String(t.customerId)) ?? "—"),
        createdAt: t.createdAt,
      })),
    },
    subsidy: SUBSIDY_STEPS.concat("rejected").map((status) => ({
      status,
      count: bySubsidy.get(status)?.n ?? 0,
      expectedPaise: bySubsidy.get(status)?.expected ?? 0,
      disbursedPaise: bySubsidy.get(status)?.disbursed ?? 0,
    })),
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/* ------------------------------------------------------------------ */
/* Lifecycle pipeline                                                   */
/* ------------------------------------------------------------------ */

export type PipelineStage = { key: string; label: string; count: number; note: string; href: string };

/**
 * Where every open project sits right now, from enquiry to commissioning
 * (the dashboard's top strip). Counts current statuses only — nothing is
 * estimated. Commissioned counts the last 30 days.
 */
export async function getPipeline(now: Date): Promise<PipelineStage[]> {
  await connectDB();
  const [leads, orders, commissioned] = await Promise.all([
    Lead.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.countDocuments({ commissionedAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) } }),
  ]);
  const lead = (...s: string[]) => leads.filter((r) => s.includes(r._id)).reduce((t, r) => t + r.n, 0);
  const order = (...s: string[]) => orders.filter((r) => s.includes(r._id)).reduce((t, r) => t + r.n, 0);
  return [
    { key: "enquiry", label: "Enquiry", count: lead("new", "contacted", "qualified"), note: "being called and qualified", href: "/leads" },
    { key: "survey", label: "Survey", count: lead("survey_scheduled", "survey_completed"), note: "booked or awaiting review", href: "/surveys" },
    { key: "quote", label: "Quote", count: lead("survey_approved", "quoted"), note: "ready to quote or with the customer", href: "/quotes" },
    { key: "order", label: "Order", count: order("pending_payment", "confirmed"), note: "awaiting payment or packing", href: "/orders" },
    { key: "dispatch", label: "Dispatch", count: order("ready_to_dispatch", "dispatched"), note: "packed or on the road", href: "/dispatch" },
    { key: "install", label: "Installation", count: order("delivered", "installing"), note: "delivered or on the roof", href: "/jobs" },
    { key: "commissioned", label: "Commissioned", count: commissioned, note: "in the last 30 days", href: "/orders" },
  ];
}
