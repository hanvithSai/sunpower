/**
 * Smoke test for the sale flow against the configured database:
 * quote from the default package → accept → order → advance payment confirms
 * the order (pick list + installation job) → balance payment, plus the guards.
 *
 *   npx tsx scripts/check-sale-flow.ts SP-L-0001
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { AppError } from "@/server/errors";
import { Job, Lead, Order, User } from "@/server/models";
import { recordPayment } from "@/server/services/payments";
import { acceptQuote, getQuoteBuilderContext, markQuoteSent, saveQuote } from "@/server/services/quotes";
import { expandPackage } from "@/lib/quote-calc";
import { formatINR } from "@/lib/money";

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
  const number = process.argv[2] ?? "SP-L-0001";
  await connectDB();
  const lead = await Lead.findOne({ number }).lean();
  if (!lead) throw new Error(`Lead ${number} not found`);
  const leadId = String(lead._id);
  const salesUser = await User.findOne({ email: "sales@sunpower.demo" }).lean();
  if (!salesUser) throw new Error("Seed staff first");
  const sales = { id: String(salesUser._id), name: salesUser.name };

  const ctx = await getQuoteBuilderContext(leadId);
  check("builder context loads, gate open", Boolean(ctx) && ctx!.blockedReason === null, `lead is "${lead.status}"`);
  const pkg = ctx!.catalog.packages.find((p) => p.id === ctx!.defaultPackageId)!;
  check("default package follows the survey", pkg.capacityKw === 3 && pkg.systemType === "on_grid", pkg.code);

  const byId = new Map(ctx!.catalog.products.map((p) => [p.id, p]));
  const lines = expandPackage(pkg.lines, byId);
  check("package expands into the full BOM", lines.length === 13, `${lines.length} lines`);

  // R-24: dropping the earthing line blocks sending until the salesperson confirms the gap.
  const noEarthing = lines.filter((l) => l.category !== "earthing").map((l) => ({ productId: l.productId, qty: l.qty, unitPriceRs: l.unitPricePaise / 100 }));
  const base = { leadId, packageId: pkg.id, capacityKw: pkg.capacityKw, systemType: pkg.systemType, notes: undefined };
  await expectError("sending without earthing needs a confirmation", "VALIDATION", () => saveQuote({ ...base, lines: noEarthing, send: true }, sales));
  const draft = await saveQuote({ ...base, lines: noEarthing, send: false }, sales);
  check("…but it can be saved as a draft", Boolean(draft.quoteId), draft.number);
  await expectError("…and marking that draft sent asks again", "VALIDATION", () => markQuoteSent(draft.quoteId, sales));

  const saved = await saveQuote(
    {
      leadId,
      packageId: pkg.id,
      capacityKw: pkg.capacityKw,
      systemType: pkg.systemType,
      lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPriceRs: l.unitPricePaise / 100 })),
      notes: "Includes net meter and three chemical earthing pits.",
      send: true,
    },
    sales,
  );
  check("quote saved and sent", Boolean(saved.quoteId), `${saved.number} · ${formatINR(saved.totalPaise)}`);
  check("lead moved to quoted", (await Lead.findById(leadId).lean())?.status === "quoted");

  const { orderId, number: orderNumber } = await acceptQuote(saved.quoteId, sales);
  const order = await Order.findById(orderId).lean();
  check("accept → order awaiting payment", order?.status === "pending_payment", orderNumber);
  check("lead won", (await Lead.findById(leadId).lean())?.status === "won");
  check("subsidy tracker created", order?.subsidy.applicable === true && order.subsidy.status === "not_applied", formatINR(order?.subsidy.expectedPaise));

  await expectError("can't accept twice", "INVALID_STATE", () => acceptQuote(saved.quoteId, sales));
  await expectError("overpayment rejected", "VALIDATION", () =>
    recordPayment({ orderId, amountPaise: order!.totalPaise + 100, mode: "upi", type: "advance" }, sales),
  );

  const advance = Math.round(order!.totalPaise / 2);
  const first = await recordPayment({ orderId, amountPaise: advance, mode: "upi", type: "advance", reference: "UPI-4523981776" }, sales);
  const confirmed = await Order.findById(orderId).lean();
  check("advance confirms the order", first.confirmedOrder && confirmed?.status === "confirmed" && confirmed.paymentStatus === "partial");
  check("pick list built (all goods, no service line)", confirmed?.pickList.length === 12, `${confirmed?.pickList.length} lines`);
  const job = confirmed?.installationJobId ? await Job.findById(confirmed.installationJobId).lean() : null;
  check("installation job booked with a crew", job?.status === "scheduled" && job.technicianIds.length === 3, `${first.jobNumber}`);

  const second = await recordPayment({ orderId, amountPaise: confirmed!.totalPaise - confirmed!.paidPaise, mode: "bank_transfer", type: "balance", reference: "UTR HDFC0001234" }, sales);
  const paid = await Order.findById(orderId).lean();
  check("balance payment doesn't re-confirm", !second.confirmedOrder && paid?.paymentStatus === "paid");
  await expectError("nothing left to pay", "INVALID_STATE", () => recordPayment({ orderId, amountPaise: 100, mode: "cash", type: "balance" }, sales));

  console.log(`\n${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
