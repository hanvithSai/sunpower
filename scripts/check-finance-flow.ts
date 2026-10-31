/**
 * Smoke test for finance against the configured database (needs `npm run seed`):
 * job costing from actuals (GRN cost per serial, labour × rate, site extras,
 * warranty repairs), the dashboard's unfinished steps and advances held,
 * subsidy stages in order with their required details, share links that
 * expire and can be revoked, and payroll from time logs.
 *
 *   npx tsx scripts/check-finance-flow.ts
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { toDateInputValue } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { connectDB } from "@/server/db";
import { AppError } from "@/server/errors";
import { Job, Order, SerialUnit, ShareLink, User } from "@/server/models";
import { costOrder } from "@/server/services/costing";
import { getDashboard, maskName } from "@/server/services/dashboard";
import { advanceSubsidy, createShareLink, getPayroll, openShareLink, revokeShareLink } from "@/server/services/finance";
import { makeCommissionedOrder, makeConfirmedOrder, staff } from "./flows/order";

loadEnvConfig(process.cwd());

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
};
async function expectError(name: string, code: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, "(no error thrown)");
  } catch (error) {
    check(name, error instanceof AppError && error.code === code, error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  await connectDB();
  const sales = await staff("sales@sunpower.demo");
  const director = await staff("director@sunpower.demo");
  const now = new Date();

  /* ---- Costing from actuals ---- */
  const made = await makeCommissionedOrder({ kw: 3, systemType: "on_grid", name: "Costing Customer" });
  const order = (await Order.findById(made.orderId).lean())!;
  const units = await SerialUnit.find({ orderId: made.orderId }).lean();
  const job = (await Job.findOne({ orderId: made.orderId, type: "installation" }).lean())!;
  const crew = await User.find({ _id: { $in: job.technicianIds } }).lean();
  const costing = (await costOrder(made.orderId))!;
  const serialCost = units.reduce((s, u) => s + u.costPaise, 0);
  const bulkCost = order.pickList.filter((l) => !l.isSerialized).reduce((s, l) => s + l.qty * order.lines.find((x) => x.sku === l.sku)!.unitCostPaise, 0);
  const labour = job.timeLogs.reduce((s, t) => s + Math.round(t.hours * crew.find((c) => c._id.equals(t.technicianId))!.hourlyRatePaise), 0);
  check("revenue is the order value excluding GST", costing.revenuePaise === order.taxablePaise, formatINR(costing.revenuePaise));
  check("material uses each serial's own GRN cost plus bulk at cost", costing.materialPaise === serialCost + bulkCost && !costing.estimated, formatINR(costing.materialPaise));
  check("labour is time logs × each technician's rate", costing.labourPaise === labour && costing.labourHours === 15, `${costing.labourHours} h · ${formatINR(labour)}`);
  check("profit = revenue − all costs", costing.profitPaise === costing.revenuePaise - costing.materialPaise - costing.labourPaise - costing.sitePaise - costing.warrantyPaise, `${formatINR(costing.profitPaise)} (${costing.marginPct}%)`);

  await Order.updateOne({ _id: made.orderId }, { $push: { extraCosts: { label: "Extra 40 m DC cable", kind: "site", amountPaise: 208_000, at: now } } });
  await Order.updateOne({ _id: made.orderId }, { $push: { extraCosts: { label: "Warranty repair SP-T-9999", kind: "warranty", amountPaise: 2_500_000, at: now } } });
  const after = (await costOrder(made.orderId))!;
  check("site extras and warranty repairs are kept apart", after.sitePaise === costing.sitePaise + 208_000 && after.warrantyPaise === 2_500_000);
  check("a warranty repair comes straight off that job's profit", after.profitPaise === costing.profitPaise - 2_708_000, `${formatINR(after.profitPaise)} (${after.marginPct}%)`);

  const confirmedOnly = await makeConfirmedOrder({ kw: 2, systemType: "on_grid", name: "Estimate Customer" });
  check("before dispatch, material is the quote estimate", (await costOrder(confirmedOnly.orderId))!.estimated);

  /* ---- Dashboard ---- */
  const dash = await getDashboard("month", now);
  const row = dash.profit.find((p) => p.id === made.orderId);
  check("the installation is in this month's profit table", Boolean(row) && row!.profitPaise === after.profitPaise);
  check("losers sort first", dash.profit.every((p, i, a) => i === 0 || a[i - 1]!.marginPct <= p.marginPct));
  const toDispatch = dash.unfinished.find((s) => s.key === "to_dispatch")!;
  check("paid-but-not-dispatched customers are listed as unfinished", toDispatch.count >= 1 && toDispatch.items.length > 0, `${toDispatch.count}`);
  check("advances held on unfinished orders", dash.kpis.advancesHeldPaise >= confirmedOnly.advancePaise, formatINR(dash.kpis.advancesHeldPaise));
  const shared = await getDashboard("month", now, { masked: true });
  check("the shared view masks customer names", shared.profit.find((p) => p.id === made.orderId)?.customer === maskName("Costing Customer"), maskName("Costing Customer"));

  /* ---- Subsidy ---- */
  await expectError("stages can't be skipped", "INVALID_STATE", () => advanceSubsidy({ orderId: made.orderId, status: "inspected", applicationNo: undefined, disbursed: undefined, note: undefined }, sales));
  await advanceSubsidy({ orderId: made.orderId, status: "applied", applicationNo: "PMSG-TS-2026-118274", disbursed: undefined, note: undefined }, sales);
  for (const status of ["feasibility_approved", "net_meter_installed", "inspected"] as const) {
    await advanceSubsidy({ orderId: made.orderId, status, applicationNo: undefined, disbursed: undefined, note: undefined }, sales);
  }
  await advanceSubsidy({ orderId: made.orderId, status: "disbursed", applicationNo: undefined, disbursed: 7_800_000, note: "Credited to customer's SBI account" }, sales);
  const sub = (await Order.findById(made.orderId).lean())!.subsidy;
  check("subsidy reaches Disbursed with the amount and every dated step", sub.status === "disbursed" && sub.disbursedPaise === 7_800_000 && sub.history.length === 5, formatINR(sub.disbursedPaise));

  /* ---- Share links ---- */
  const link = await createShareLink({ days: 7, label: "Auditor" }, director);
  check("a fresh link opens", (await openShareLink(link.token, now)).ok);
  check("a link stops working after expiry", !(await openShareLink(link.token, new Date(now.getTime() + 8 * 86_400_000))).ok);
  check("a made-up token is refused", (await openShareLink("x".repeat(32), now)).ok === false);
  const stored = (await ShareLink.findOne({ token: link.token }).lean())!;
  await revokeShareLink(String(stored._id), director);
  const revoked = await openShareLink(link.token, now);
  check("a revoked link stops working at once", !revoked.ok && revoked.reason === "revoked");
  check("views are counted", stored.viewCount === 1);

  /* ---- Payroll ---- */
  const payroll = await getPayroll(toDateInputValue(now).slice(0, 7));
  const crewPay = payroll.people.filter((p) => job.technicianIds.some((t) => String(t) === p.id));
  check("crew hours this month appear on payroll", crewPay.length === 3 && crewPay.every((p) => p.hours >= 5));
  check("payout = hours × rate", payroll.people.every((p) => p.payPaise === Math.round(p.hours * p.ratePaise)), `${formatINR(payroll.totals.payPaise)} for ${payroll.totals.hours} h`);

  console.log(`\n${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
