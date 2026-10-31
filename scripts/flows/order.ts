/**
 * Build a confirmed order from nothing for flow checks: a fresh enquiry (random
 * mobile, so re-runs never dedupe), qualification, an approved survey with a
 * real photo in GridFS, a quote from the package, acceptance and the advance.
 * Uses the same services the screens call.
 */
import zlib from "node:zlib";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { toDateTimeInputValue } from "@/lib/format";
import { expandPackage } from "@/lib/quote-calc";
import type { SystemType } from "@/lib/constants";
import { Order, User } from "@/server/models";
import { saveSmallFile } from "@/server/services/core/files";
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
