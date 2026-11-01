/**
 * Warehouse edge cases, share links, and the photo/document backfill:
 *
 *   warehouse   dead-on-arrival units written off (two sent back to the
 *               supplier), cycle-count corrections, unused material returned
 *               from site
 *   sharing     dashboard links (active, expired, revoked) and certificate
 *               links sent to recent customers
 *   backfill    every completed survey, finished installation and subsidy
 *               file gets real-looking photos and papers (runs on every seed;
 *               only fills what is empty or still a placeholder)
 */
import { formatINR } from "@/lib/money";
import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import type { SubsidyDocKind, SubsidyStatus, SystemType } from "@/lib/constants";
import { Activity, Customer, Job, Order, Product, Purchase, SerialUnit, ShareLink, StockMove, Survey } from "@/server/models";
import { GRN_NOTE, reserve } from "../history";
import { signatureDataUrl } from "../photos";
import { Timeline, addDays, addHours, insertOpts, installPhotos, ist, photo, surveyPhotos, who, type Ctx } from "./common";

export async function seedWarehouseEdges(ctx: Ctx): Promise<string> {
  const now = ctx.now;
  const t = new Timeline();
  const keeper = who(ctx.keeper);
  const moves: object[] = [];
  const delta = new Map<string, number>();
  const inc = (id: Types.ObjectId, q: number) => delta.set(String(id), (delta.get(String(id)) ?? 0) + q);

  // 1. Dead on arrival: received, found faulty on the shelf, written off; two later sent back under RMA.
  const [grnNo] = await reserve("SP-GRN", 1);
  const receivedAt = ist(addDays(now, -96), 11);
  const purchaseId = new Types.ObjectId();
  const doa = [
    { sku: "PNL-WAA-545", reason: "Cracked cell found during the incoming check (EL test)" },
    { sku: "PNL-WAA-545", reason: "Junction box diode open — no output on the string test" },
    { sku: "INV-GRW-3K", reason: "Dead on arrival: no display, internal relay fault" },
  ];
  const units = doa.map((d, i) => {
    const p = ctx.bySku.get(d.sku)!;
    const serial = `${d.sku.replace(/^(PNL|INV)-/, "").replace(/-/g, "")}-DOA-${String(i + 1).padStart(3, "0")}`;
    const offAt = addDays(receivedAt, 2 + i);
    const history: object[] = [
      { status: "in_stock", at: receivedAt, note: "Received", by: keeper.name },
      { status: "faulty", at: offAt, note: `Written off: ${d.reason}`, by: keeper.name },
    ];
    const rmaAt = addDays(offAt, 12);
    const returned = i < 2;
    if (returned) history.push({ status: "returned", at: rmaAt, note: "Sent back to the supplier under RMA; credit note received", by: keeper.name });
    moves.push({ productId: p._id, sku: p.sku, qty: -1, type: "adjustment", serials: [serial], refType: "manual", note: `Write-off: ${d.reason}`, by: keeper, at: offAt, createdAt: offAt, updatedAt: offAt });
    const id = new Types.ObjectId();
    t.add("serial", id, undefined, "written_off", `${serial} (${p.name}) written off at ${formatINR(p.costPaise)} cost. Reason: ${d.reason}`, offAt, keeper);
    return { _id: id, serial, productId: p._id, sku: p.sku, productName: p.name, category: p.category, status: returned ? "returned" : "faulty", purchaseId, costPaise: p.costPaise, warrantyMonths: p.warrantyMonths, history, createdAt: receivedAt, updatedAt: returned ? rmaAt : offAt };
  });
  const grnLines = [...new Set(doa.map((d) => d.sku))].map((sku) => {
    const p = ctx.bySku.get(sku)!;
    const serials = units.filter((u) => u.sku === sku).map((u) => u.serial);
    return { productId: p._id, sku, name: p.name, qty: serials.length, unitCostPaise: p.costPaise, serials };
  });
  for (const l of grnLines) moves.push({ productId: l.productId, sku: l.sku, qty: l.qty, type: "purchase", serials: l.serials, refType: "purchase", refId: purchaseId, refNumber: grnNo, note: "Top-up", by: keeper, at: receivedAt, createdAt: receivedAt, updatedAt: receivedAt });

  // 2. Cycle counts and handling losses through the year (never below zero).
  const live = new Map((await Product.find().select("sku stockQty").lean()).map((p) => [p.sku, p.stockQty]));
  const counts = [
    { sku: "CBL-DC-4", qty: -35, days: 300, note: "Cycle count: cable offcuts below 2 m written off" },
    { sku: "MC4-PAIR", qty: 6, days: 240, note: "Cycle count: a sealed box found in the service van" },
    { sku: "EARTH-KIT", qty: -1, days: 180, note: "Damaged in handling: electrode bent" },
    { sku: "CBL-AC-6", qty: -12, days: 120, note: "Cycle count variance" },
    { sku: "SPR-FUSE", qty: 4, days: 45, note: "Cycle count: spares returned from the service van" },
    { sku: "STR-GI-1KW", qty: -1, days: 20, note: "Rusted set scrapped" },
  ];
  for (const c of counts) {
    const p = ctx.bySku.get(c.sku)!;
    if (c.qty < 0 && (live.get(c.sku) ?? 0) + c.qty < 0) continue;
    const at = ist(addDays(now, -c.days), 17);
    moves.push({ productId: p._id, sku: p.sku, qty: c.qty, type: "adjustment", serials: [], refType: "manual", note: c.note, by: keeper, at, createdAt: at, updatedAt: at });
    inc(p._id, c.qty);
    t.add("product", p._id, undefined, "adjusted", `Stock ${c.qty > 0 ? "+" : ""}${c.qty} ${p.unit}: ${c.note}`, at, keeper);
  }

  // 3. Unused material back from site after recent installations.
  const recent = await Order.find({ status: "commissioned", commissionedAt: { $gte: addDays(now, -60) } }).sort({ commissionedAt: -1 }).limit(4).select("number commissionedAt").lean();
  for (const [i, o] of recent.entries()) {
    const p = ctx.bySku.get(i % 2 ? "MC4-PAIR" : "CBL-DC-4")!;
    const qty = i % 2 ? 2 : 6 + i * 2;
    const at = addHours(o.commissionedAt!, 20);
    moves.push({ productId: p._id, sku: p.sku, qty, type: "return", serials: [], refType: "order", refId: o._id, refNumber: o.number, note: `Unused ${p.unit === "m" ? `${qty} m cable` : `${qty} connector pairs`} returned from site`, by: keeper, at, createdAt: at, updatedAt: at });
    inc(p._id, qty);
  }

  await Promise.all([
    Purchase.create({ _id: purchaseId, number: grnNo, supplier: { name: "Waaree Energies Ltd", gstin: "27AAACW4285R1ZD" }, invoiceNo: `WEL/TS/RMA-${grnNo}`, invoiceDate: addDays(receivedAt, -2), lines: grnLines, totalPaise: grnLines.reduce((s, l) => s + l.qty * l.unitCostPaise, 0), receivedAt, receivedBy: keeper, notes: "Top-up; three units failed the incoming check (see serial register)", createdAt: receivedAt, updatedAt: receivedAt }),
    SerialUnit.insertMany(units, insertOpts),
    StockMove.insertMany(moves, insertOpts),
    Activity.insertMany(t.docs, insertOpts),
  ]);
  if (delta.size) await Product.bulkWrite([...delta.entries()].map(([id, q]) => ({ updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $inc: { stockQty: q } } } })));
  return `Warehouse: ${units.length} dead-on-arrival units (2 returned under RMA), ${counts.length} cycle-count corrections, ${recent.length} site returns`;
}

export async function seedShareLinks(ctx: Ctx): Promise<string> {
  const now = ctx.now;
  const director = who(ctx.director);
  const token = () => randomBytes(24).toString("base64url");
  const dashboard = [
    { label: "SBI loan officer (working-capital review)", created: -2, days: 7, views: 4 },
    { label: "Investor update, Q2", created: -40, days: 14, views: 9 },
    { label: "Chartered accountant preview", created: -12, days: 30, views: 2, revoked: -3 },
  ];
  const t = new Timeline();
  const links: object[] = dashboard.map((d) => {
    const createdAt = addDays(now, d.created);
    const id = new Types.ObjectId();
    t.add("share", id, undefined, "created", `Read-only dashboard link created for ${d.label}, valid ${d.days} days`, createdAt, director);
    if (d.revoked) t.add("share", id, undefined, "revoked", "Share link revoked", addDays(now, d.revoked), director);
    return { _id: id, token: token(), scope: "dashboard", label: d.label, createdBy: director, expiresAt: addDays(createdAt, d.days), revokedAt: d.revoked ? addDays(now, d.revoked) : undefined, viewCount: d.views, lastViewedAt: addDays(createdAt, 1), createdAt, updatedAt: createdAt };
  });
  const jobs = await Job.find({ type: "installation", status: "completed" }).sort({ finishedAt: -1 }).limit(8).select("number finishedAt customerId").lean();
  for (const [i, j] of jobs.entries()) {
    const createdAt = addHours(j.finishedAt!, 1);
    const id = new Types.ObjectId();
    links.push({ _id: id, token: token(), scope: "certificate", jobId: j._id, label: `Certificate ${j.number}`, createdBy: who(ctx.sales[i % ctx.sales.length]!), expiresAt: addDays(createdAt, 90), viewCount: 1 + (i % 3), lastViewedAt: addHours(createdAt, 5), createdAt, updatedAt: createdAt });
    t.add("job", j._id, j.customerId, "certificate_link", "Certificate link for the customer created, valid 90 days", createdAt, who(ctx.sales[i % ctx.sales.length]!));
  }
  await Promise.all([ShareLink.insertMany(links, insertOpts), Activity.insertMany(t.docs, insertOpts)]);
  return `Share links: ${dashboard.length} dashboard (active, expired, revoked), ${jobs.length} installation certificates`;
}

/* ------------------------------------------------------------------ */
/* Backfill: photos and subsidy papers                                 */
/* ------------------------------------------------------------------ */

const STAGE_DOCS: [SubsidyStatus, SubsidyDocKind, "doc_application" | "doc_feasibility" | "net_meter" | "doc_inspection" | "doc_disbursement"][] = [
  ["applied", "application", "doc_application"],
  ["feasibility_approved", "feasibility_letter", "doc_feasibility"],
  ["net_meter_installed", "net_meter_photo", "net_meter"],
  ["inspected", "inspection_report", "doc_inspection"],
  ["disbursed", "disbursement_proof", "doc_disbursement"],
];

export async function backfillMedia(ctx: Ctx): Promise<string> {
  const files = mongoose.connection.db!.collection<{ _id: Types.ObjectId; length: number; filename: string }>("media.files");
  // The first seeds stored 1-pixel placeholders; anything under 4 KB that isn't ours is one of those.
  const tiny = new Set((await files.find({ length: { $lt: 4096 } }).project<{ _id: Types.ObjectId }>({ _id: 1 }).toArray()).map((f) => String(f._id)));
  const needs = (photos: string[] | undefined) => !photos?.length || photos.every((p) => tiny.has(p));

  const surveys = await Survey.find({ status: { $in: ["completed", "approved", "rejected"] } }).select("photos customerId measurements").lean();
  const commercial = new Set((await Customer.find({ type: "commercial" }).select("_id").lean()).map((c) => String(c._id)));
  const surveyOps = surveys
    .filter((s) => needs(s.photos))
    .map((s, i) => ({ updateOne: { filter: { _id: s._id }, update: { $set: { photos: surveyPhotos(ctx, i, { commercial: commercial.has(String(s.customerId)) || s.measurements?.roofType === "metal_sheet", shaded: (s.measurements?.shadingPct ?? 0) > 20 }) } } } }));
  if (surveyOps.length) await Survey.bulkWrite(surveyOps);

  const jobs = await Job.find({ type: "installation", status: "completed" }).select("photos orderId").lean();
  const orderIds = jobs.flatMap((j) => (j.orderId ? [j.orderId] : []));
  const types = new Map((await Order.find({ _id: { $in: orderIds } }).select("systemType").lean()).map((o) => [String(o._id), o.systemType as SystemType]));
  const jobOps = jobs
    .filter((j) => needs(j.photos))
    .map((j, i) => ({ updateOne: { filter: { _id: j._id }, update: { $set: { photos: installPhotos(ctx, i, types.get(String(j.orderId)) ?? "on_grid") } } } }));
  if (jobOps.length) await Job.bulkWrite(jobOps);

  const orders = await Order.find({ "subsidy.applicable": true, "subsidy.history.0": { $exists: true } }).select("subsidy").lean();
  const docOps = orders
    .filter((o) => !o.subsidy.documents?.length)
    .map((o, i) => {
      const reached = new Map(o.subsidy.history.map((h) => [h.status, h]));
      const documents = STAGE_DOCS.filter(([st]) => reached.has(st)).map(([st, kind, key]) => ({ kind, fileId: photo(ctx, key, i), at: reached.get(st)!.at, by: reached.get(st)!.by ?? "Sales" }));
      return { updateOne: { filter: { _id: o._id }, update: { $set: { "subsidy.documents": documents } } } };
    })
    .filter((op) => op.updateOne.update.$set["subsidy.documents"].length);
  if (docOps.length) await Order.bulkWrite(docOps);

  // The first seeds signed every job with a 1-pixel placeholder; sign them with the customer's name.
  const unsigned = await Job.find({ "signature.signedBy": { $exists: true } }).select("signature").lean();
  const sigOps = [];
  for (const j of unsigned.filter((x) => (x.signature?.dataUrl.length ?? 0) < 400)) sigOps.push({ updateOne: { filter: { _id: j._id }, update: { $set: { "signature.dataUrl": await signatureDataUrl(j.signature!.signedBy) } } } });
  if (sigOps.length) await Job.bulkWrite(sigOps);

  // Pipeline surveys were booked for tomorrow and then submitted today; the visit was really just before submission.
  const early = await Survey.find({ completedAt: { $exists: true }, $expr: { $gt: ["$scheduledFor", "$completedAt"] } }).select("completedAt").lean();
  if (early.length) await Survey.bulkWrite(early.map((s) => ({ updateOne: { filter: { _id: s._id }, update: { $set: { scheduledFor: addHours(s.completedAt!, -1.25) } } } })));

  const grn = await Purchase.updateMany({ notes: "seed:history" }, { $set: { notes: GRN_NOTE } });
  return `Media: photos on ${surveyOps.length} surveys and ${jobOps.length} installations, papers on ${docOps.length} subsidy files, signatures on ${sigOps.length} jobs; ${early.length} survey times and ${grn.modifiedCount} GRN notes tidied`;
}

