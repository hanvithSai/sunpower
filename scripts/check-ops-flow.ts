/**
 * Smoke test for operations against the configured database (needs
 * `npm run seed` for staff, catalog and goods receipts):
 *   confirmed order → packing (scan guards, bulk ticks) → dispatch gate →
 *   dispatch (stock out, sale invoice) → delivery (warranty clocks).
 * Builds its own fresh order each run, so it can be re-run safely.
 *
 *   npx tsx scripts/check-ops-flow.ts
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { startOfDayIST } from "@/lib/dates";
import { addMonths } from "@/lib/warranty";
import { connectDB } from "@/server/db";
import { AppError } from "@/server/errors";
import { Invoice, Job, Order, Product, Purchase, SerialUnit } from "@/server/models";
import { deliverOrder, dispatchOrder, getDispatchDetail, scanSerial, setBulkPicked, unscanSerial } from "@/server/services/dispatch";
import { receiveGoods } from "@/server/services/inventory";
import { recordPayment } from "@/server/services/payments";
import { formatINR } from "@/lib/money";
import { makeConfirmedOrder, staff } from "./flows/order";

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

const sameDay = (a?: Date | null, b?: Date | null) => Boolean(a && b && Math.abs(a.getTime() - b.getTime()) < 1000);

async function main() {
  await connectDB();
  if (!(await Purchase.exists({}))) throw new Error("No goods receipts — run npm run seed first");
  const warehouse = await staff("warehouse@sunpower.demo");
  const sales = await staff("sales@sunpower.demo");

  /* ---- Goods receipt guards ---- */
  const panel = await Product.findOne({ sku: "PNL-WAA-545" }).lean();
  const existingSerial = (await SerialUnit.findOne({ productId: panel!._id }).lean())!.serial;
  const grn = { supplierName: "Check Supplier", supplierGstin: undefined, invoiceNo: "CHK-1", invoiceDate: "2026-10-01", notes: undefined };
  await expectError("GRN: serial count must match quantity", "VALIDATION", () =>
    receiveGoods({ ...grn, lines: [{ productId: String(panel!._id), qty: 2, unitCostRs: 12000, serials: ["CHK-ONLY-ONE"] }] }, warehouse),
  );
  await expectError("GRN: a serial can be received only once", "CONFLICT", () =>
    receiveGoods({ ...grn, lines: [{ productId: String(panel!._id), qty: 1, unitCostRs: 12000, serials: [existingSerial] }] }, warehouse),
  );

  /* ---- Packing ---- */
  const made = await makeConfirmedOrder({ kw: 3, systemType: "on_grid" });
  const { orderId } = made;
  console.log(`\nOrder ${made.orderNumber} (${formatINR(made.totalPaise)}, advance ${formatINR(made.advancePaise)})\n`);
  let detail = (await getDispatchDetail(orderId))!;
  check("pick list ready for packing", detail.canPack && detail.lines.length === 12, `${detail.lines.length} lines`);
  check("8 serial-tracked units to scan (6 panels, inverter, charge controller)", detail.progress.serialRequired === 8, String(detail.progress.serialRequired));

  await expectError("dispatch blocked before packing (BR-02)", "DISPATCH_INCOMPLETE", () =>
    dispatchOrder({ orderId, vehicleNo: "TS09EA1234", driverName: "Raju", driverPhone: undefined }, warehouse),
  );
  await expectError("unknown serial refused", "NOT_FOUND", () => scanSerial(orderId, "NOPE-0000", warehouse));
  const wrong = await SerialUnit.findOne({ sku: "INV-SGR-5K", status: "in_stock" }).lean();
  await expectError("wrong product refused with what's needed", "VALIDATION", () => scanSerial(orderId, wrong!.serial, warehouse));

  const serialLines = detail.lines.filter((l) => l.isSerialized);
  const scanned: string[] = [];
  for (const line of serialLines) {
    const units = await SerialUnit.find({ productId: line.productId, status: "in_stock" }).sort({ serial: 1 }).limit(line.qty + 1).lean();
    for (const u of units.slice(0, line.qty)) {
      await scanSerial(orderId, u.serial.toLowerCase(), warehouse); // typed in lower case: normalised
      scanned.push(u.serial);
    }
    if (units[line.qty]) {
      await expectError(`extra ${line.sku} beyond the quantity refused`, "VALIDATION", () => scanSerial(orderId, units[line.qty]!.serial, warehouse));
    }
  }
  await expectError("same serial twice refused", "CONFLICT", () => scanSerial(orderId, scanned[0]!, warehouse));
  check("scanned units are allocated to the order", (await SerialUnit.countDocuments({ serial: { $in: scanned }, status: "allocated", orderId })) === 8);

  const other = await makeConfirmedOrder({ kw: 3, systemType: "on_grid", name: "Second Flow Customer" });
  await expectError("a unit packed for another order is refused", "CONFLICT", () => scanSerial(other.orderId, scanned[0]!, warehouse));

  /* ---- Crew booking (BR-07): nobody is double-booked on a day ---- */
  const jobs = await Job.find({ status: { $in: ["scheduled", "in_progress"] } }).select("scheduledFor technicianIds").lean();
  const perDay = new Map<string, string[]>();
  for (const j of jobs) {
    const day = startOfDayIST(j.scheduledFor).toISOString();
    perDay.set(day, [...(perDay.get(day) ?? []), ...j.technicianIds.map(String)]);
  }
  const clashes = [...perDay.values()].filter((ids) => new Set(ids).size !== ids.length).length;
  check("auto-booked crews never share a technician on the same day", clashes === 0, `${jobs.length} open jobs over ${perDay.size} days`);
  const [jobA, jobB] = await Promise.all([Job.findOne({ orderId }).lean(), Job.findOne({ orderId: other.orderId }).lean()]);
  check(
    "orders confirmed together get different crews or different days",
    startOfDayIST(jobA!.scheduledFor).getTime() !== startOfDayIST(jobB!.scheduledFor).getTime() ||
      !jobA!.technicianIds.some((t) => jobB!.technicianIds.some((u) => u.equals(t))),
  );

  await unscanSerial(orderId, scanned[0]!, warehouse);
  check("un-scan releases the unit to stock", (await SerialUnit.findOne({ serial: scanned[0] }).lean())?.status === "in_stock");
  await scanSerial(orderId, scanned[0]!, warehouse);

  const bulk = detail.lines.filter((l) => !l.isSerialized);
  for (const line of bulk) await setBulkPicked(orderId, line.productId, true, warehouse);
  detail = (await getDispatchDetail(orderId))!;
  check("all packed → order moves to Packed by itself", detail.order.status === "ready_to_dispatch" && detail.progress.complete);
  await setBulkPicked(orderId, bulk[0]!.productId, false, warehouse);
  check("unticking a line moves it back to Confirmed", (await Order.findById(orderId).lean())?.status === "confirmed");
  await setBulkPicked(orderId, bulk[0]!.productId, true, warehouse);

  /* ---- Dispatch ---- */
  const panelLine = serialLines.find((l) => l.sku.startsWith("PNL"))!;
  const stockBefore = (await Product.findById(panelLine.productId).lean())!.stockQty;
  const sent = await dispatchOrder({ orderId, vehicleNo: "TS09EA1234", driverName: "Raju", driverPhone: "9849012345" }, warehouse);
  const dispatched = (await Order.findById(orderId).lean())!;
  check("dispatched", dispatched.status === "dispatched" && dispatched.dispatch.vehicleNo === "TS09EA1234");
  check("panel stock left the ledger", (await Product.findById(panelLine.productId).lean())!.stockQty === stockBefore - panelLine.qty, `${stockBefore} → ${stockBefore - panelLine.qty}`);
  check("serials in transit", (await SerialUnit.countDocuments({ serial: { $in: scanned }, status: "dispatched" })) === 8);

  const invoice = await Invoice.findById(dispatched.invoiceId).lean();
  check("tax invoice issued at dispatch (BR-18)", Boolean(invoice) && invoice!.type === "sale", sent.invoiceNumber);
  check("invoice total matches the order", invoice?.totalPaise === dispatched.totalPaise, formatINR(invoice?.totalPaise));
  check("advance applied to the invoice", invoice?.paidPaise === made.advancePaise && invoice?.status === "partially_paid");
  check("invoice lines carry the serial numbers", Boolean(invoice?.lines.some((l) => l.description.includes(scanned[1]!))));
  await expectError("can't pack after dispatch", "INVALID_STATE", () => scanSerial(orderId, scanned[0]!, warehouse));

  await recordPayment({ orderId, amountPaise: dispatched.totalPaise - dispatched.paidPaise, mode: "bank_transfer", type: "balance", reference: "UTR-FLOW-2" }, sales);
  check("balance payment settles the invoice too", (await Invoice.findById(dispatched.invoiceId).lean())?.status === "paid");

  /* ---- Delivery ---- */
  await deliverOrder({ orderId, receivedBy: "Customer (self)", note: undefined }, warehouse);
  const delivered = (await Order.findById(orderId).lean())!;
  const at = delivered.dispatch.deliveredAt!;
  check("delivered", delivered.status === "delivered");
  const panelUnit = await SerialUnit.findOne({ serial: { $in: scanned }, category: "panel" }).lean();
  const inverterUnit = await SerialUnit.findOne({ serial: { $in: scanned }, category: "inverter" }).lean();
  const ccUnit = await SerialUnit.findOne({ serial: { $in: scanned }, category: "charge_controller" }).lean();
  check("panel warranty: 20 years from delivery", sameDay(panelUnit?.warrantyStartAt, at) && sameDay(panelUnit?.warrantyEndAt, addMonths(at, 240)));
  check("inverter warranty: 2 years from delivery", sameDay(inverterUnit?.warrantyEndAt, addMonths(at, 24)));
  check("charge controller warranty: 2 years from delivery", sameDay(ccUnit?.warrantyEndAt, addMonths(at, 24)));
  await expectError("can't deliver twice", "INVALID_STATE", () => deliverOrder({ orderId, receivedBy: "x", note: undefined }, warehouse));

  console.log(`\n${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
