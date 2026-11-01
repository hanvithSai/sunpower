/**
 * Demo-readiness check: asks the same services the screens use for every
 * filter, tab, stage, category and period a reviewer can pick, and fails on
 * anything that would show an empty state or a zero.
 *
 *   npm run check:demo-data              (reads MONGODB_URI from .env.local)
 *
 * Read-only. "Today" figures are reported but only warn: they depend on the
 * hour you run it (re-run the seed on demo morning to fill the day).
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import {
  INVOICE_STATUSES,
  INVOICE_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  QUOTE_STATUSES,
  SERIAL_STATUSES,
  SUBSIDY_STATUSES,
  SURVEY_STATUSES,
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  CUSTOMER_TYPES,
  PAYMENT_MODES,
  PAYMENT_TYPES,
  RESOLUTION_TYPES,
  STOCK_MOVE_TYPES,
  SYSTEM_TYPES,
} from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { connectDB } from "@/server/db";
import { Job, Payment, ShareLink, StockMove, Ticket, User } from "@/server/models";
import { listProducts } from "@/server/services/catalog";
import { listCustomers } from "@/server/services/customers";
import { getDashboard } from "@/server/services/dashboard";
import { listDispatchQueue } from "@/server/services/dispatch";
import { getPayroll, getSubsidyBoard, listInvoices } from "@/server/services/finance";
import { listPurchases, listSerials, listStock } from "@/server/services/inventory";
import { getJobCalendar, getMyWork } from "@/server/services/jobs";
import { listLeadBoard, listLeads } from "@/server/services/leads";
import { listOrders } from "@/server/services/orders";
import { listQuotes } from "@/server/services/quotes";
import { getReports } from "@/server/services/reports";
import { listSurveys } from "@/server/services/surveys";
import { listTickets } from "@/server/services/tickets";

loadEnvConfig(process.cwd());

const problems: string[] = [];
const warnings: string[] = [];
let checks = 0;
function expect(label: string, n: number, min = 1) {
  if (min === 1) min = Number.MIN_VALUE;
  checks += 1;
  if (n < min) problems.push(`${label}: ${n}${min > 1 ? ` (want ${min}+)` : ""}`);
}

async function main() {
  await connectDB();
  const now = new Date();
  console.log(`Checking ${mongoose.connection.host} / ${mongoose.connection.name}`);

  // Leads: every status, every source, every status × source, the board columns (5+ so they scroll).
  for (const status of LEAD_STATUSES) expect(`leads status=${status}`, (await listLeads({ status }, now)).total, status === "won" || status === "lost" ? 20 : 6);
  for (const source of LEAD_SOURCES) {
    const r = await listLeads({ source }, now);
    for (const status of LEAD_STATUSES) expect(`leads source=${source} × ${status}`, r.counts[status] ?? 0);
  }
  for (const col of await listLeadBoard({}, now)) expect(`lead board column ${col.title}`, col.total, 6);
  for (const u of await User.find({ role: "sales" }).lean()) for (const col of await listLeadBoard({ assignedTo: String(u._id) }, now)) if (!["new"].includes(col.key)) expect(`lead board (mine: ${u.name}) ${col.title}`, col.total);

  for (const status of SURVEY_STATUSES) expect(`surveys status=${status}`, (await listSurveys({ status })).total, 3);
  for (const status of QUOTE_STATUSES) expect(`quotes status=${status}`, (await listQuotes({ status })).total, 2);
  for (const status of ORDER_STATUSES) expect(`orders status=${status}`, (await listOrders({ status })).total, 4);
  for (const tab of ["to_pack", "in_transit", "delivered"] as const) {
    const q = await listDispatchQueue(tab);
    expect(`dispatch tab=${tab}`, (q as { orders?: unknown[]; items?: unknown[] }).orders?.length ?? (q as { items?: unknown[] }).items?.length ?? 0, 4);
  }

  // Warehouse.
  for (const view of ["all", "low", "serialized"] as const) expect(`stock view=${view}`, (await listStock({ view })).items.length, view === "low" ? 2 : 5);
  const stock = await listStock({ view: "all" });
  for (const r of stock.items) if (r.available < 0) problems.push(`stock ${r.sku}: available ${r.available} (negative)`);
  for (const status of SERIAL_STATUSES) expect(`serials status=${status}`, (await listSerials({ status })).total);
  expect("goods receipts", (await listPurchases({})).total, 10);
  for (const type of STOCK_MOVE_TYPES) expect(`stock moves type=${type}`, await StockMove.countDocuments({ type }));

  // Catalog and customers.
  for (const category of PRODUCT_CATEGORIES) expect(`catalog category=${category}`, (await listProducts({ category })).length);
  for (const type of CUSTOMER_TYPES) expect(`customers type=${type}`, (await listCustomers({ type })).total, 5);

  // Finance.
  for (const status of INVOICE_STATUSES)
    for (const type of INVOICE_TYPES) {
      // A sale invoice is issued at dispatch, after the advance, so it is never wholly unpaid (by design).
      if (type === "sale" && status === "issued") continue;
      expect(`invoices ${type} × ${status}`, (await listInvoices({ status, type }, now)).total);
    }
  for (const mode of PAYMENT_MODES) expect(`payments mode=${mode}`, await Payment.countDocuments({ mode }));
  for (const type of PAYMENT_TYPES) expect(`payments type=${type}`, await Payment.countDocuments({ type }));
  const board = await getSubsidyBoard();
  for (const status of SUBSIDY_STATUSES.filter((s) => s !== "not_applicable")) expect(`subsidy column ${status}`, board.get(status)?.length ?? 0, 5);
  expect("dashboard share links", await ShareLink.countDocuments({ scope: "dashboard" }), 3);
  expect("certificate links", await ShareLink.countDocuments({ scope: "certificate" }));

  // Service: every tab, every technician, every category / channel / priority / resolution.
  const techs = await User.find({ role: "technician", active: true }).lean();
  for (const status of ["open_all", ...TICKET_STATUSES]) expect(`tickets status=${status}`, (await listTickets({ status }, now)).total, 3);
  for (const t of techs) expect(`tickets open for ${t.name}`, (await listTickets({ status: "open_all", assignedTo: String(t._id) }, now)).total);
  for (const category of TICKET_CATEGORIES) expect(`tickets category=${category}`, await Ticket.countDocuments({ category }), 5);
  for (const channel of TICKET_CHANNELS) expect(`tickets channel=${channel}`, await Ticket.countDocuments({ channel }), 5);
  for (const priority of TICKET_PRIORITIES) expect(`tickets priority=${priority}`, await Ticket.countDocuments({ priority }), 5);
  for (const type of RESOLUTION_TYPES) expect(`tickets resolution=${type}`, await Ticket.countDocuments({ "resolution.type": type }), 3);
  for (const state of ["in_warranty", "out_of_warranty"]) expect(`tickets warranty=${state}`, await Ticket.countDocuments({ "warranty.state": state as "in_warranty" }));
  expect("tickets reopened", await Ticket.countDocuments({ reopenCount: { $gt: 0 } }));
  expect("tickets past SLA (open)", await Ticket.countDocuments({ status: { $nin: ["closed", "resolved", "customer_confirmed"] }, slaDueAt: { $lt: now } }));

  // Jobs: the crew calendar four weeks back to twelve ahead; payroll every month for every technician.
  for (let w = -4; w <= 12; w++) expect(`job calendar week ${w >= 0 ? "+" : ""}${w}`, (await getJobCalendar(addDays(now, 7 * w))).jobs.length);
  expect("cancelled jobs or orders", await Job.countDocuments({ status: "cancelled" }) + (await listOrders({ status: "cancelled" })).total);
  const ist = new Date(now.getTime() + 330 * 60_000);
  for (let m = 12; m >= 1; m--) {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - m, 1));
    const month = d.toISOString().slice(0, 7);
    const pay = await getPayroll(month);
    for (const p of pay.people) {
      expect(`payroll ${month} ${p.name} hours`, p.hours);
      expect(`payroll ${month} ${p.name} service hours`, p.serviceHours);
    }
  }
  for (const t of techs) {
    const w = await getMyWork(String(t._id), now);
    expect(`my work for ${t.name} (today + upcoming + in progress)`, w.today.length + w.upcoming.length + w.inProgress.length);
  }

  // Dashboard periods and the twelve-month reports (the current month is young in its first two days).
  const dayOfMonth = new Date(now.getTime() + 330 * 60_000).getUTCDate();
  for (const range of ["today", "week", "month"] as const) {
    const d = await getDashboard(range, now);
    const k = d.kpis;
    const line = `revenue ${k.revenuePaise}, cash ${k.cashPaise}, leads ${k.newLeads}, installs ${k.commissioned}, hours ${k.hoursLogged}`;
    if (range === "today") {
      if (!k.newLeads || !k.cashPaise) warnings.push(`dashboard today is thin (${line}) — re-run the seed later in the day`);
    } else
      for (const [key, v] of Object.entries({ revenue: k.revenuePaise, cash: k.cashPaise, leads: k.newLeads, installs: k.commissioned, hours: k.hoursLogged })) {
        if (range === "month" && dayOfMonth <= 2 && !v) warnings.push(`dashboard month ${key} is 0 on day ${dayOfMonth} of the month`);
        else expect(`dashboard ${range} ${key}`, v);
      }
    console.log(`  dashboard ${range}: ${line}`);
  }
  const rep = await getReports(now);
  for (const [i, m] of rep.installsByMonth.entries()) if (i < 11 || dayOfMonth > 2) expect(`reports installs ${m.label}`, m.installs);
  for (const m of rep.moneyByMonth) expect(`reports cash ${m.label}`, m.cashPaise);
  for (const m of rep.ticketsByMonth) expect(`reports tickets opened ${m.label}`, m.opened);
  for (const s of LEAD_SOURCES) expect(`reports source ${s}`, rep.sources.find((x) => x.key === s)?.leads ?? 0);
  for (const s of SYSTEM_TYPES) expect(`reports system mix ${s}`, rep.systemMix.find((x) => x.key === s)?.orders ?? 0);
  for (const b of rep.marginBands) expect(`reports margin band ${b.label}`, b.n);
  for (const c of TICKET_CATEGORIES) expect(`reports ticket category ${c}`, rep.categories.find((x) => x.key === c)?.n ?? 0);
  for (const f of rep.funnel) expect(`reports funnel ${f.stage}`, f.n);
  console.log(`  reports: conversion ${rep.kpis.conversionPct}%, margin ${rep.kpis.marginPct}%, ${rep.kpis.lossMakers} loss-makers`);

  await mongoose.disconnect();
  for (const w of warnings) console.log(`  warn: ${w}`);
  if (problems.length) {
    console.log(`\n${problems.length} of ${checks} checks found empty or thin data:`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(`\nAll ${checks} checks passed: every filter, stage and category has data.`);
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
