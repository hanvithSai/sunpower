/**
 * Smoke test for the service desk against the configured database (needs
 * `npm run seed`). Builds commissioned installations, then ages them to match
 * the brief: one 18 months old (inverter still covered), one 28 months old
 * (inverter out of warranty, panels covered), and checks:
 *   search by serial / phone digits → warranty per serial and workmanship
 *   warranty for no-serial faults (BR-04) → visit on the technician's calendar →
 *   in-warranty replacement at ₹0 with inherited cover and cost charged to the
 *   installation (BR-05, BR-15) → out-of-warranty auto invoice with GST →
 *   billing override with reason → close only after customer confirmation,
 *   "Not fixed" reopens (BR-06).
 *
 *   npx tsx scripts/check-service-flow.ts
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { addDays } from "@/lib/dates";
import { toDateTimeInputValue } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { addMonths } from "@/lib/warranty";
import { connectDB } from "@/server/db";
import { AppError } from "@/server/errors";
import { Customer, Invoice, Job, Order, Product, SerialUnit, Ticket, User } from "@/server/models";
import { getMyWork } from "@/server/services/jobs";
import { searchRecords } from "@/server/services/search";
import { assignTicket, closeTicket, confirmTicket, createTicket, decideWarranty, overrideBilling, reopenTicket, resolveTicket, startTicket } from "@/server/services/tickets";
import { makeCommissionedOrder, makeConfirmedOrder, staff, topUpStock } from "./flows/order";

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

/** Pretend an installation happened `months` ago: commissioning and every serial's warranty move back. */
async function age(orderId: string, months: number) {
  const now = new Date();
  const at = addMonths(now, -months);
  await Order.updateOne({ _id: orderId }, { $set: { commissionedAt: at, "dispatch.deliveredAt": at } });
  const units = await SerialUnit.find({ orderId }).lean();
  for (const u of units) {
    await SerialUnit.updateOne({ _id: u._id }, { $set: { deliveredAt: at, warrantyStartAt: at, warrantyEndAt: addMonths(at, u.warrantyMonths) } });
  }
}

const visit = (days: number) => toDateTimeInputValue(addDays(new Date(), days));

async function main() {
  await connectDB();
  const support = await staff("support@sunpower.demo");
  const now = new Date();

  /* ---- An 18-month-old installation: the rainy-season scene ---- */
  const a = await makeCommissionedOrder({ kw: 3, systemType: "on_grid", name: "Srinivas Rao" });
  await age(a.orderId, 18);
  const inverterA = (await SerialUnit.findOne({ orderId: a.orderId, category: "inverter" }).lean())!;
  const customerA = (await Order.findById(a.orderId).lean())!.customerId;
  const phoneA = (await Customer.findById(customerA).lean())!.phone;
  console.log(`\n18 months old: ${a.orderNumber}, inverter ${inverterA.serial}\n`);

  const bySerial = await searchRecords(inverterA.serial.slice(-9), "support", now);
  const hit = bySerial.find((r) => r.type === "serial" && r.title === inverterA.serial);
  check("search by the end of the serial finds it, with warranty left", Boolean(hit?.badge?.startsWith("In warranty")), hit?.badge);
  check("support lands on raising a ticket for it", hit?.href === `/service/new?serial=${inverterA.serial}`);
  const byPhone = await searchRecords(`+91 ${phoneA.slice(0, 5)} ${phoneA.slice(5)}`, "support", now);
  check("search by phone (with +91 and spaces) finds the customer", byPhone.some((r) => r.type === "customer" && r.id === String(customerA)));

  const decision = await decideWarranty({ serial: inverterA.serial }, now);
  check("inverter at 18 months: in warranty (2-year cover)", decision.state === "in_warranty" && decision.basis === "serial");

  const t1 = await createTicket(
    { serial: inverterA.serial.toLowerCase(), customerId: undefined, category: "fault_code", faultCode: "E-30", description: "Fault code E-30, zero power since morning rain", priority: "high", channel: "phone" },
    support,
  );
  check("ticket raised at ₹0 (in warranty)", t1.warranty === "in_warranty" && !t1.billable, t1.number);

  const techUser = (await User.findOne({ role: "technician", skills: "service" }).lean())!;
  const tech = { id: String(techUser._id), name: techUser.name, role: "technician" as const };
  const otherTechUser = (await User.findOne({ role: "technician", _id: { $ne: techUser._id } }).lean())!;
  const otherTech = { id: String(otherTechUser._id), name: otherTechUser.name, role: "technician" as const };
  await assignTicket({ ticketId: t1.ticketId, technicianId: tech.id, visitAt: visit(1) }, support);
  const ticket1 = (await Ticket.findById(t1.ticketId).lean())!;
  const serviceJob = await Job.findById(ticket1.jobId).lean();
  check("visit booked as a service job for the technician", ticket1.status === "assigned" && serviceJob?.type === "service" && serviceJob.technicianIds[0]!.equals(techUser._id));
  const work = await getMyWork(tech.id, now);
  check("the visit shows in the technician's My work", [...work.today, ...work.upcoming].some((i) => i.number === serviceJob?.number));

  await expectError("another technician can't start it", "FORBIDDEN", () => startTicket(t1.ticketId, otherTech));
  await startTicket(t1.ticketId, tech);

  await topUpStock(a.orderId); // a spare inverter of the same model for the swap
  const wrongModel = (await SerialUnit.findOne({ status: "in_stock", category: "inverter", productId: { $ne: inverterA.productId } }).lean())!;
  await expectError("replacement must be the same product (BR-15)", "VALIDATION", () =>
    resolveTicket({ ticketId: t1.ticketId, type: "replacement", notes: "Swapped inverter", labourHours: 2, parts: [], replacementSerial: wrongModel.serial }, tech),
  );
  const spare = (await SerialUnit.findOne({ status: "in_stock", productId: inverterA.productId }).lean())!;
  const extraBefore = (await Order.findById(a.orderId).lean())!.extraCosts.reduce((s, e) => s + e.amountPaise, 0);
  await expectError("can't close before it is resolved and confirmed", "INVALID_STATE", () => closeTicket(t1.ticketId, support));
  const r1 = await resolveTicket({ ticketId: t1.ticketId, type: "replacement", notes: "Inverter IGBT failure, unit swapped", labourHours: 2, parts: [], replacementSerial: spare.serial }, tech);
  const oldUnit = (await SerialUnit.findById(inverterA._id).lean())!;
  const newUnit = (await SerialUnit.findOne({ serial: spare.serial }).lean())!;
  check("no invoice for in-warranty work", !r1.invoiceNumber);
  check("faulty unit marked Replaced", oldUnit.status === "replaced" && oldUnit.replacedBySerial === spare.serial);
  check("replacement installed for the same customer", newUnit.status === "installed" && newUnit.customerId?.equals(customerA) === true && newUnit.replacesSerial === inverterA.serial);
  check("replacement inherits the remaining warranty (BR-15)", newUnit.warrantyEndAt?.getTime() === inverterA.warrantyEndAt?.getTime());
  const extraAfter = (await Order.findById(a.orderId).lean())!.extraCosts.reduce((s, e) => s + e.amountPaise, 0);
  const expectedCost = newUnit.costPaise + 2 * techUser.hourlyRatePaise;
  check("repair cost charged to the installation's profit", extraAfter - extraBefore === expectedCost && r1.costPaise === expectedCost, formatINR(expectedCost));
  const doneJob = await Job.findById(ticket1.jobId).lean();
  check("service visit completed with a time log", doneJob?.status === "completed" && doneJob.timeLogs[0]?.hours === 2);

  await expectError("resolved isn't closed: confirmation comes first (BR-06)", "INVALID_STATE", () => closeTicket(t1.ticketId, support));
  await confirmTicket({ ticketId: t1.ticketId, confirmedBy: "Srinivas Rao", channel: "call", note: "Generating 2.1 kW" }, support);
  check("customer confirmation recorded", (await Ticket.findById(t1.ticketId).lean())?.confirmation?.confirmedBy === "Srinivas Rao");
  await closeTicket(t1.ticketId, support);
  check("closed after confirmation", (await Ticket.findById(t1.ticketId).lean())?.status === "closed");
  await reopenTicket(t1.ticketId, "Fault came back in the evening", support);
  const reopened = (await Ticket.findById(t1.ticketId).lean())!;
  check('"Not fixed" reopens a closed ticket', reopened.status === "in_progress" && reopened.reopenCount === 1 && !reopened.confirmation);

  /* ---- Workmanship warranty: a fault with no serial ---- */
  const w1 = await createTicket({ serial: undefined, customerId: String(customerA), category: "wiring_earthing", faultCode: undefined, description: "Earthing pit cover broken, ACDB tripping", priority: "medium", channel: "whatsapp" }, support);
  const w1t = (await Ticket.findById(w1.ticketId).lean())!;
  check("no-serial fault covered by workmanship warranty (5 years)", w1t.warranty.basis === "workmanship" && w1t.warranty.state === "in_warranty" && !w1t.billable);

  /* ---- A 28-month-old installation: inverter out of warranty ---- */
  const b = await makeCommissionedOrder({ kw: 2, systemType: "on_grid", name: "Padmavathi Devi" });
  await age(b.orderId, 28);
  const inverterB = (await SerialUnit.findOne({ orderId: b.orderId, category: "inverter" }).lean())!;
  const panelB = (await SerialUnit.findOne({ orderId: b.orderId, category: "panel" }).lean())!;
  check("at 28 months the panels are still covered", (await decideWarranty({ serial: panelB.serial }, now)).state === "in_warranty");
  const t2 = await createTicket({ serial: inverterB.serial, customerId: undefined, category: "no_power", faultCode: undefined, description: "No power after storm", priority: "urgent", channel: "phone" }, support);
  check("inverter at 28 months: out of warranty, billable", t2.warranty === "out_of_warranty" && t2.billable, t2.number);
  await assignTicket({ ticketId: t2.ticketId, technicianId: tech.id, visitAt: visit(0) }, support);
  const fuse = (await Product.findOne({ sku: "SPR-FUSE" }).lean())!;
  const r2 = await resolveTicket({ ticketId: t2.ticketId, type: "repair", notes: "Blown DC fuses replaced", labourHours: 2, parts: [{ productId: String(fuse._id), qty: 2 }] }, tech);
  const inv = await Invoice.findOne({ number: r2.invoiceNumber }).lean();
  const expected = Math.round((2 * fuse.pricePaise + 2 * 60_000) * 1.18);
  check("out-of-warranty parts + labour invoiced automatically (BR-05)", inv?.type === "service" && inv.totalPaise === expected, `${r2.invoiceNumber} ${formatINR(inv?.totalPaise)}`);
  check("service invoice is CGST + SGST", inv?.cgstPaise === inv?.sgstPaise || Math.abs((inv?.cgstPaise ?? 0) - (inv?.sgstPaise ?? 0)) <= 1);

  // Workmanship has run out too once it's older than 5 years.
  await Order.updateOne({ _id: b.orderId }, { $set: { commissionedAt: addMonths(now, -62) } });
  const w2 = await createTicket({ serial: undefined, customerId: String((await Order.findById(b.orderId).lean())!.customerId), category: "structure", faultCode: undefined, description: "Water seepage near the stand bolts", priority: "low", channel: "phone" }, support);
  check("workmanship ends after 5 years → billable", (await Ticket.findById(w2.ticketId).lean())?.warranty.state === "out_of_warranty" && w2.billable);

  /* ---- Billing override with a reason ---- */
  const panelA = (await SerialUnit.findOne({ orderId: a.orderId, category: "panel" }).lean())!;
  const t3 = await createTicket({ serial: panelA.serial, customerId: undefined, category: "physical_damage", faultCode: undefined, description: "Panel glass cracked — cricket ball", priority: "low", channel: "walk_in" }, support);
  await expectError("override needs a real change", "INVALID_STATE", () => overrideBilling({ ticketId: t3.ticketId, billable: false, reason: "x" }, support));
  await overrideBilling({ ticketId: t3.ticketId, billable: true, reason: "Physical damage is not covered" }, support);
  const t3t = (await Ticket.findById(t3.ticketId).lean())!;
  check("override makes it billable and records why", t3t.billable && t3t.billingOverride?.reason === "Physical damage is not covered");

  /* ---- A customer with no installation yet ---- */
  const pending = await makeConfirmedOrder({ kw: 2, systemType: "on_grid", name: "Pending Customer" });
  const t4 = await createTicket(
    { serial: undefined, customerId: String((await Order.findById(pending.orderId).lean())!.customerId), category: "other", faultCode: undefined, description: "Asking about installation date", priority: "low", channel: "phone" },
    support,
  );
  check("no installation yet → nothing to cover", t4.warranty === "no_serial" && t4.billable);

  console.log(`\n${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
