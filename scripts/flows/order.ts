/**
 * Build orders from nothing for flow checks, through the same services the
 * screens call: a fresh enquiry (random mobile, so re-runs never dedupe),
 * qualification, an approved survey with a real photo in GridFS, a quote from
 * the package, acceptance and the advance (makeConfirmedOrder) — and on to
 * packed, dispatched, delivered and commissioned (makeCommissionedOrder),
 * topping up stock through a goods receipt first so checks can be re-run.
 */
import zlib from "node:zlib";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { toDateTimeInputValue } from "@/lib/format";
import { expandPackage } from "@/lib/quote-calc";
import type { SystemType } from "@/lib/constants";
import { Job, Order, Product, SerialUnit, User } from "@/server/models";
import { saveSmallFile } from "@/server/services/core/files";
import { deliverOrder, dispatchOrder, getDispatchDetail, scanSerial, setBulkPicked } from "@/server/services/dispatch";
import { receiveGoods } from "@/server/services/inventory";
import { completeJob, startJob } from "@/server/services/jobs";
import { createLead, markLeadContacted, qualifyLead, scheduleSurvey } from "@/server/services/leads";
import { recordPayment } from "@/server/services/payments";
import { acceptQuote, getQuoteBuilderContext, saveQuote } from "@/server/services/quotes";
import { reviewSurvey, submitSurvey } from "@/server/services/surveys";

export type Staff = { id: string; name: string; role: "admin" | "sales" | "technician" | "warehouse" | "support" };

export async function staff(email: string): Promise<Staff> {
  const user = await User.findOne({ email }).lean();
  if (!user) throw new Error(`${email} not found — run npm run seed first`);
  return { id: String(user._id), name: user.name, role: user.role };
}

/** A tiny real PNG, so photos go through GridFS like a phone upload would. */
export function samplePng(): Buffer {
  const w = 16;
  const h = 12;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([30, 80 + y * 8, 190], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function uploadPhoto(uploadedBy: string, filename = "site.png"): Promise<string> {
  return saveSmallFile({ data: samplePng(), filename, contentType: "image/png", kind: "image", uploadedBy });
}

export async function makeConfirmedOrder(opts: { kw?: number; systemType?: SystemType; name?: string } = {}) {
  const kw = opts.kw ?? 3;
  const systemType = opts.systemType ?? "on_grid";
  const sales = await staff("sales@sunpower.demo");
  const tech = await staff("tech@sunpower.demo");
  const phone = `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;

  const lead = await createLead(
    {
      name: opts.name ?? "Flow Check Customer",
      phone,
      email: undefined,
      city: "Kukatpally",
      pincode: "500072",
      addressLine: "Plot 7, KPHB Phase 3",
      customerType: "residential",
      capacityKw: kw,
      systemType,
      wantsSubsidy: systemType === "on_grid",
      monthlyBillRs: 3200,
      message: undefined,
      source: "website",
    },
    null,
  );
  await markLeadContacted(lead.leadId, sales);
  await qualifyLead({ leadId: lead.leadId, roofAreaSqft: 900, shadowFreeAreaSqft: 700, monthlyBillRs: 3200, gridSuitable: true, roofType: "rcc" }, sales);
  const when = toDateTimeInputValue(addHours(addDays(startOfDayIST(new Date()), 1), 10));
  const { surveyId } = await scheduleSurvey({ leadId: lead.leadId, technicianId: tech.id, scheduledFor: when }, sales);
  const photo = await uploadPhoto(tech.id, "roof.png");
  await submitSurvey(
    {
      surveyId,
      roofDirection: "S",
      tiltDeg: 15,
      roofType: "rcc",
      usableAreaSqft: 650,
      shadingPct: 0,
      cableDistanceM: 20,
      floors: 2,
      earthingPossible: true,
      recommendedKw: kw,
      recommendedSystemType: systemType,
      photos: [photo],
    },
    tech,
  );
  await reviewSurvey({ surveyId, decision: "approve" }, sales);

  const ctx = await getQuoteBuilderContext(lead.leadId);
  const pkg = ctx!.catalog.packages.find((p) => p.capacityKw === kw && p.systemType === systemType)!;
  const lines = expandPackage(pkg.lines, new Map(ctx!.catalog.products.map((p) => [p.id, p])));
  const quote = await saveQuote(
    {
      leadId: lead.leadId,
      packageId: pkg.id,
      capacityKw: kw,
      systemType,
      lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPriceRs: l.unitPricePaise / 100 })),
      notes: undefined,
      send: true,
    },
    sales,
  );
  const { orderId } = await acceptQuote(quote.quoteId, sales);
  const order = await Order.findById(orderId).lean();
  const advance = Math.round(order!.totalPaise / 2);
  const payment = await recordPayment({ orderId, amountPaise: advance, mode: "upi", type: "advance", reference: "UPI-FLOW-0001" }, sales);
  return { orderId, orderNumber: order!.number, leadNumber: lead.number, jobNumber: payment.jobNumber, totalPaise: order!.totalPaise, advancePaise: advance };
}

/** Receive whatever this order's pick list is short of, so packing never fails on an empty shelf. */
export async function topUpStock(orderId: string) {
  const warehouse = await staff("warehouse@sunpower.demo");
  const order = await Order.findById(orderId).lean();
  const tag = Date.now().toString(36).toUpperCase();
  const lines: { productId: string; qty: number; unitCostRs: number; serials: string[] }[] = [];
  for (const line of order!.pickList) {
    const product = await Product.findById(line.productId).lean();
    if (line.isSerialized) {
      const free = await SerialUnit.countDocuments({ productId: line.productId, status: "in_stock" });
      const short = line.qty + 1 - free; // one spare for replacement checks
      if (short > 0) lines.push({ productId: String(line.productId), qty: short, unitCostRs: product!.costPaise / 100, serials: Array.from({ length: short }, (_, i) => `${line.sku}-CHK${tag}-${i + 1}`) });
    } else if (product!.stockQty < line.qty) {
      lines.push({ productId: String(line.productId), qty: line.qty * 3, unitCostRs: product!.costPaise / 100, serials: [] });
    }
  }
  if (lines.length) {
    await receiveGoods({ supplierName: "Sri Venkateswara Solar Distributors", supplierGstin: "36ABCFS7214K1Z8", invoiceNo: `SVSD/TOP/${tag}`, invoiceDate: toDateTimeInputValue(new Date()).slice(0, 10), notes: undefined, lines }, warehouse);
  }
}

/** Confirmed → packed → dispatched → delivered → installed and commissioned, by the booked crew. */
export async function makeCommissionedOrder(opts: { kw?: number; systemType?: SystemType; name?: string } = {}) {
  const made = await makeConfirmedOrder(opts);
  const warehouse = await staff("warehouse@sunpower.demo");
  await topUpStock(made.orderId);
  const detail = (await getDispatchDetail(made.orderId))!;
  for (const line of detail.lines) {
    if (line.isSerialized) {
      const units = await SerialUnit.find({ productId: line.productId, status: "in_stock" }).sort({ serial: 1 }).limit(line.qty).lean();
      for (const u of units) await scanSerial(made.orderId, u.serial, warehouse);
    } else {
      await setBulkPicked(made.orderId, line.productId, true, warehouse);
    }
  }
  await dispatchOrder({ orderId: made.orderId, vehicleNo: "TS09EA1234", driverName: "Raju", driverPhone: undefined }, warehouse);
  await deliverOrder({ orderId: made.orderId, receivedBy: opts.name ?? "Flow Check Customer", note: undefined }, warehouse);

  const job = (await Job.findOne({ orderId: made.orderId }).lean())!;
  const leadUser = (await User.findById(job.technicianIds[0]).lean())!;
  const crew: Staff = { id: String(leadUser._id), name: leadUser.name, role: "technician" };
  await startJob(String(job._id), crew);
  const now = new Date();
  await completeJob(
    {
      jobId: String(job._id),
      startedAt: toDateTimeInputValue(new Date(now.getTime() - 5 * 3_600_000)),
      finishedAt: toDateTimeInputValue(now),
      confirmedKw: opts.kw ?? 3,
      kwChangeReason: undefined,
      generationReadingKw: 2.2,
      generationTested: true,
      kitComplete: true,
      missingItems: undefined,
      mounting: true,
      panels: true,
      wiring: true,
      earthing: true,
      inverter: true,
      photos: [await uploadPhoto(crew.id, "roof-done.png")],
      photos__uploading: undefined,
      signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      signedBy: opts.name ?? "Flow Check Customer",
      customerRemarks: undefined,
      notes: undefined,
      extras: [],
      extraCostRs: undefined,
      extraCostNote: undefined,
    },
    crew,
  );
  return { ...made, jobId: String(job._id) };
}
