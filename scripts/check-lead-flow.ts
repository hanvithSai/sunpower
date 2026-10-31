/**
 * Smoke test for the pre-sales flow against the configured database:
 * contacted → qualified → survey booked → survey submitted (with a real photo
 * in GridFS) → approved → quote unlocked, plus the gates in between.
 *
 *   npx tsx scripts/check-lead-flow.ts SP-L-0001
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import zlib from "node:zlib";
import { connectDB } from "@/server/db";
import { AppError } from "@/server/errors";
import { Lead, User } from "@/server/models";
import { saveSmallFile } from "@/server/services/core/files";
import { getLeadDetail, markLeadContacted, qualifyLead, scheduleSurvey } from "@/server/services/leads";
import { reviewSurvey, submitSurvey } from "@/server/services/surveys";
import { toDateTimeInputValue } from "@/lib/format";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";

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

/** A real (tiny) PNG so the photo goes through GridFS like a phone upload would. */
function roofPng(): Buffer {
  const w = 32;
  const h = 24;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([40, 90 + y * 4, 200], y * (w * 3 + 1) + 1 + x * 3);
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

async function main() {
  const number = process.argv[2] ?? "SP-L-0001";
  await connectDB();
  const lead = await Lead.findOne({ number }).lean();
  if (!lead) throw new Error(`Lead ${number} not found`);
  const leadId = String(lead._id);
  const salesUser = await User.findOne({ email: "sales@sunpower.demo" }).lean();
  const techUser = await User.findOne({ email: "tech@sunpower.demo" }).lean();
  const otherTech = await User.findOne({ role: "technician", email: { $ne: "tech@sunpower.demo" } }).lean();
  if (!salesUser || !techUser || !otherTech) throw new Error("Seed staff accounts first (npm run seed)");
  const sales = { id: String(salesUser._id), name: salesUser.name, role: "sales" as const };
  const tech = { id: String(techUser._id), name: techUser.name, role: "technician" as const };
  const intruder = { id: String(otherTech._id), name: otherTech.name, role: "technician" as const };
  const now = new Date();

  console.log(`Lead ${number} starts as "${lead.status}"\n`);

  if (lead.status === "new") await markLeadContacted(leadId, sales);
  check("quote locked before survey", (await getLeadDetail(leadId, now))?.canQuote === false);

  await qualifyLead(
    { leadId, roofAreaSqft: 900, shadowFreeAreaSqft: 620, monthlyBillRs: 2800, sanctionedLoadKw: 5, gridSuitable: true, roofType: "rcc", notes: "RCC roof, water tank on north side" },
    sales,
  );
  check("qualified", (await Lead.findById(leadId).lean())?.status === "qualified");

  await expectError("can't qualify twice (state machine)", "INVALID_STATE", () =>
    qualifyLead({ leadId, roofAreaSqft: 900, shadowFreeAreaSqft: 620, monthlyBillRs: 2800, gridSuitable: true, roofType: "rcc" }, sales),
  );

  const when = toDateTimeInputValue(addHours(addDays(startOfDayIST(now), 1), 10));
  const { surveyId } = await scheduleSurvey({ leadId, technicianId: tech.id, scheduledFor: when }, sales);
  check("survey booked", (await Lead.findById(leadId).lean())?.status === "survey_scheduled", `survey ${surveyId}`);

  const photoId = await saveSmallFile({ data: roofPng(), filename: "roof-south.png", contentType: "image/png", kind: "image", uploadedBy: tech.id });
  const measurements = {
    surveyId,
    roofDirection: "S" as const,
    tiltDeg: 17,
    roofType: "rcc" as const,
    usableAreaSqft: 600,
    shadingPct: 5,
    cableDistanceM: 18,
    floors: 2,
    earthingPossible: true,
    recommendedKw: 3,
    recommendedSystemType: "on_grid" as const,
    notes: "South-facing slab, minimal shading after 9 am",
  };

  await expectError("another technician can't submit", "FORBIDDEN", () => submitSurvey({ ...measurements, photos: [photoId] }, intruder));
  await expectError("photo must exist in GridFS", "VALIDATION", () =>
    submitSurvey({ ...measurements, photos: ["0123456789abcdef01234567"] }, tech),
  );

  await submitSurvey({ ...measurements, photos: [photoId] }, tech);
  check("survey submitted", (await Lead.findById(leadId).lean())?.status === "survey_completed");
  check("quote still locked until approval", (await getLeadDetail(leadId, now))?.canQuote === false);

  await reviewSurvey({ surveyId, decision: "approve" }, sales);
  const detail = await getLeadDetail(leadId, now);
  check("survey approved → quote unlocked", detail?.lead.status === "survey_approved" && detail.canQuote === true);

  await expectError("can't review twice", "INVALID_STATE", () => reviewSurvey({ surveyId, decision: "approve" }, sales));

  console.log(`\n${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
