/**
 * Reports: the last twelve IST calendar months, in more depth than the
 * dashboard. Read-only aggregations over existing records — no estimates, no
 * new business rules:
 *
 *   installations  commissioned per month (count and kW)
 *   money          invoiced (excl. GST) and cash collected per month
 *   funnel         of leads created in the window: how many got a site survey,
 *                  a quote, and became an order (won)
 *   sources        leads and wins per channel
 *   mix            orders by system type (count and kW), cancelled excluded
 *   profit         margin bands and where the revenue went (material, labour,
 *                  site extras, warranty repairs, profit), from job costing
 *   service        tickets opened and closed per month, tickets by category
 */
import { LEAD_SOURCE_LABELS, SYSTEM_TYPE_LABELS, TICKET_CATEGORY_LABELS, type LeadSource, type SystemType, type TicketCategory } from "@/lib/constants";
import { getRange } from "@/lib/dates";
import { connectDB } from "../db";
import { Invoice, Lead, Order, Payment, Quote, Survey, Ticket } from "../models";
import { getProfitTable } from "./dashboard";

const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });
const TZ = "Asia/Kolkata";

export type Month = { key: string; label: string };

/** Twelve IST calendar months ending with this one; the 15th sits safely inside each month. */
function lastTwelveMonths(now: Date): { months: Month[]; start: Date; end: Date } {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const anchors = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 11 + i, 15)));
  const months = anchors.map((d) => {
    const istD = new Date(d.getTime() + 330 * 60_000);
    return { key: `${istD.getUTCFullYear()}-${String(istD.getUTCMonth() + 1).padStart(2, "0")}`, label: MONTH_FMT.format(d) };
  });
  return { months, start: getRange("month", anchors[0]!).start, end: getRange("month", now).end };
}

const byMonth = (field: string) => ({ $dateToString: { format: "%Y-%m", date: field, timezone: TZ } });

export async function getReports(now: Date) {
  await connectDB();
  const { months, start, end } = lastTwelveMonths(now);
  const inWindow = { $gte: start, $lt: end };

  const [installs, revenue, cash, leads, mix, ticketsOpened, ticketsClosed, ticketCategories, profit] = await Promise.all([
    Order.aggregate<{ _id: string; n: number; kw: number }>([
      { $match: { commissionedAt: inWindow } },
      { $group: { _id: byMonth("$commissionedAt"), n: { $sum: 1 }, kw: { $sum: "$capacityKw" } } },
    ]),
    Invoice.aggregate<{ _id: string; total: number }>([
      { $match: { issuedAt: inWindow, status: { $ne: "void" } } },
      { $group: { _id: byMonth("$issuedAt"), total: { $sum: "$taxablePaise" } } },
    ]),
    Payment.aggregate<{ _id: string; total: number }>([
      { $match: { receivedAt: inWindow } },
      { $group: { _id: byMonth("$receivedAt"), total: { $sum: "$amountPaise" } } },
    ]),
    Lead.find({ createdAt: inWindow }).select("_id source status").lean(),
    Order.aggregate<{ _id: SystemType; n: number; kw: number }>([
      { $match: { createdAt: inWindow, status: { $ne: "cancelled" } } },
      { $group: { _id: "$systemType", n: { $sum: 1 }, kw: { $sum: "$capacityKw" } } },
    ]),
    Ticket.aggregate<{ _id: string; n: number }>([{ $match: { createdAt: inWindow } }, { $group: { _id: byMonth("$createdAt"), n: { $sum: 1 } } }]),
    Ticket.aggregate<{ _id: string; n: number }>([{ $match: { closedAt: inWindow } }, { $group: { _id: byMonth("$closedAt"), n: { $sum: 1 } } }]),
    Ticket.aggregate<{ _id: TicketCategory; n: number }>([{ $match: { createdAt: inWindow } }, { $group: { _id: "$category", n: { $sum: 1 } } }]),
    getProfitTable({ start, end, limit: 1000 }),
  ]);

  const leadIds = leads.map((l) => l._id);
  const [surveyed, quoted] = await Promise.all([
    Survey.distinct("leadId", { leadId: { $in: leadIds }, status: { $in: ["completed", "approved", "rejected"] } }),
    Quote.distinct("leadId", { leadId: { $in: leadIds } }),
  ]);

  const pick = <T extends { _id: string }>(rows: T[], key: string) => rows.find((r) => r._id === key);

  const installsByMonth = months.map((m) => ({ ...m, installs: pick(installs, m.key)?.n ?? 0, kw: pick(installs, m.key)?.kw ?? 0 }));
  const moneyByMonth = months.map((m) => ({ ...m, revenuePaise: pick(revenue, m.key)?.total ?? 0, cashPaise: pick(cash, m.key)?.total ?? 0 }));
  const ticketsByMonth = months.map((m) => ({ ...m, opened: pick(ticketsOpened, m.key)?.n ?? 0, closed: pick(ticketsClosed, m.key)?.n ?? 0 }));

  const won = leads.filter((l) => l.status === "won").length;
  const funnel = [
    { stage: "Enquiries", n: leads.length },
    { stage: "Site survey done", n: surveyed.length },
    { stage: "Quoted", n: quoted.length },
    { stage: "Won (order)", n: won },
  ];

  const sources = (Object.keys(LEAD_SOURCE_LABELS) as LeadSource[])
    .map((s) => {
      const mine = leads.filter((l) => l.source === s);
      return { key: s, label: LEAD_SOURCE_LABELS[s], leads: mine.length, won: mine.filter((l) => l.status === "won").length };
    })
    .filter((s) => s.leads > 0)
    .sort((a, b) => b.leads - a.leads);

  const systemMix = (Object.keys(SYSTEM_TYPE_LABELS) as SystemType[]).map((t) => {
    const row = mix.find((r) => r._id === t);
    return { key: t, label: SYSTEM_TYPE_LABELS[t], orders: row?.n ?? 0, kw: row?.kw ?? 0 };
  });

  const BANDS = [
    { label: "Loss", test: (m: number) => m < 0 },
    { label: "0–10%", test: (m: number) => m >= 0 && m < 10 },
    { label: "10–15%", test: (m: number) => m >= 10 && m < 15 },
    { label: "15–20%", test: (m: number) => m >= 15 && m < 20 },
    { label: "20–25%", test: (m: number) => m >= 20 && m < 25 },
    { label: "25% or more", test: (m: number) => m >= 25 },
  ];
  const marginBands = BANDS.map((b) => ({ label: b.label, n: profit.filter((p) => b.test(p.marginPct)).length }));
  const sum = (k: "revenuePaise" | "materialPaise" | "labourPaise" | "sitePaise" | "warrantyPaise" | "profitPaise") => profit.reduce((t, p) => t + p[k], 0);
  const revenueTotal = sum("revenuePaise");
  const costShare = [
    { key: "material", label: "Material", paise: sum("materialPaise") },
    { key: "labour", label: "Crew labour", paise: sum("labourPaise") },
    { key: "site", label: "Site extras", paise: sum("sitePaise") },
    { key: "warranty", label: "Warranty repairs", paise: sum("warrantyPaise") },
    { key: "profit", label: "Profit", paise: sum("profitPaise") },
  ];

  const categories = ticketCategories
    .map((c) => ({ key: c._id, label: TICKET_CATEGORY_LABELS[c._id] ?? c._id, n: c.n }))
    .sort((a, b) => b.n - a.n);

  const installsTotal = installsByMonth.reduce((t, m) => t + m.installs, 0);
  return {
    window: { start, end, from: months[0]!.label, to: months[11]!.label },
    kpis: {
      installs: installsTotal,
      kw: installsByMonth.reduce((t, m) => t + m.kw, 0),
      revenuePaise: moneyByMonth.reduce((t, m) => t + m.revenuePaise, 0),
      cashPaise: moneyByMonth.reduce((t, m) => t + m.cashPaise, 0),
      marginPct: revenueTotal ? Math.round((sum("profitPaise") / revenueTotal) * 1000) / 10 : null,
      lossMakers: profit.filter((p) => p.profitPaise < 0).length,
      leads: leads.length,
      conversionPct: leads.length ? Math.round((won / leads.length) * 1000) / 10 : null,
      tickets: ticketsByMonth.reduce((t, m) => t + m.opened, 0),
    },
    installsByMonth,
    moneyByMonth,
    funnel,
    sources,
    systemMix,
    marginBands,
    costShare: { revenuePaise: revenueTotal, parts: costShare },
    ticketsByMonth,
    categories,
  };
}

export type ReportsData = Awaited<ReturnType<typeof getReports>>;
