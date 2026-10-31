/**
 * Today's live pipeline, created through the same services the screens use,
 * so every open item behaves exactly like one made in the app:
 *
 *   leads    new (two past the 2-hour call-back SLA), contacted, qualified,
 *            survey booked for Ravi today, survey awaiting review, ready to
 *            quote, quotes awaiting the customer, one lost (shaded roof)
 *   orders   awaiting payment, confirmed (pick lists), packed, in transit,
 *            delivered (crew can start), installing
 *   tickets  workmanship fault with no serial, a visit booked for Ravi, one
 *            waiting for the customer's OK, one confirmed waiting to close,
 *            physical damage made billable, and a past out-of-warranty repair
 *            billed on the 28-month-old installation
 *
 * The brief's own scene is left for the live demo: Venkata Ramana Rao's
 * 18-month-old inverter has no ticket yet. Runs once (`seed:pipeline` marker).
 */
import type { Types } from "mongoose";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { toDateTimeInputValue } from "@/lib/format";
import { expandPackage } from "@/lib/quote-calc";
import type { ProductCategory, SystemType } from "@/lib/constants";
import { Counter, Customer, Job, Lead, Order, Product, SerialUnit, User } from "@/server/models";
import { deliverOrder, dispatchOrder, getDispatchDetail, scanSerial, setBulkPicked } from "@/server/services/dispatch";
import { startJob } from "@/server/services/jobs";
import { createLead, markLeadContacted, markLeadLost, qualifyLead, scheduleSurvey } from "@/server/services/leads";
import { recordPayment } from "@/server/services/payments";
import { acceptQuote, getQuoteBuilderContext, saveQuote } from "@/server/services/quotes";
import { reviewSurvey, submitSurvey } from "@/server/services/surveys";
import { assignTicket, closeTicket, confirmTicket, createTicket, overrideBilling, resolveTicket, startTicket } from "@/server/services/tickets";
import { uploadPhoto } from "../flows/order";
import { PLACES, seededPhone } from "./people";

const MARKER = "seed:pipeline";

type Stage = "new" | "contacted" | "qualified" | "survey_scheduled" | "survey_completed" | "survey_approved" | "quoted" | "lost" | "accepted" | "confirmed" | "packed" | "dispatched" | "delivered" | "installing";
type Spec = { name: string; city: string; kw: number; systemType: SystemType; stage: Stage; source: "website" | "whatsapp" | "phone" | "walk_in" | "referral"; ageHours?: number };

const SPECS: Spec[] = [
  { name: "Mahender Goud", city: "Miyapur", kw: 3, systemType: "on_grid", stage: "new", source: "website", ageHours: 5 },
  { name: "Swathi Reddy", city: "Gachibowli", kw: 2, systemType: "on_grid", stage: "new", source: "whatsapp", ageHours: 3 },
  { name: "Imran Khan", city: "Secunderabad", kw: 5, systemType: "on_grid", stage: "new", source: "phone" },
  { name: "Harish Naidu", city: "Manikonda", kw: 3, systemType: "on_grid", stage: "contacted", source: "website" },
  { name: "Anitha Chary", city: "Uppal", kw: 4, systemType: "on_grid", stage: "qualified", source: "referral" },
  { name: "Prasad Varma", city: "Kukatpally", kw: 3, systemType: "on_grid", stage: "survey_scheduled", source: "whatsapp" },
  { name: "Kavitha Sharma", city: "Madhapur", kw: 3, systemType: "on_grid", stage: "survey_completed", source: "website" },
  { name: "Naresh Yadav", city: "LB Nagar", kw: 2, systemType: "on_grid", stage: "survey_approved", source: "phone" },
  { name: "Sujatha Rao", city: "Kompally", kw: 3, systemType: "on_grid", stage: "quoted", source: "website" },
  { name: "Gopal Murthy", city: "Karimnagar", kw: 2, systemType: "off_grid", stage: "quoted", source: "walk_in" },
  { name: "Rekha Babu", city: "Dilsukhnagar", kw: 3, systemType: "on_grid", stage: "lost", source: "website" },
  { name: "Sai Teja Reddy", city: "Gachibowli", kw: 4, systemType: "on_grid", stage: "accepted", source: "referral" },
  { name: "Divya Prasad", city: "Miyapur", kw: 3, systemType: "on_grid", stage: "confirmed", source: "website" },
  { name: "Krishna Rao", city: "Warangal", kw: 2, systemType: "on_grid", stage: "confirmed", source: "whatsapp" },
  { name: "Manjula Devi", city: "Nizamabad", kw: 3, systemType: "off_grid", stage: "confirmed", source: "phone" },
  { name: "Ravinder Kumar", city: "Uppal", kw: 3, systemType: "on_grid", stage: "packed", source: "website" },
  { name: "Haritha Chowdary", city: "Kukatpally", kw: 2, systemType: "on_grid", stage: "dispatched", source: "referral" },
  { name: "Jagadeesh Goud", city: "Khammam", kw: 3, systemType: "on_grid", stage: "delivered", source: "website" },
  { name: "Usha Rani", city: "Manikonda", kw: 3, systemType: "on_grid", stage: "installing", source: "whatsapp" },
];

const ORDER_STAGES: Stage[] = ["accepted", "confirmed", "packed", "dispatched", "delivered", "installing"];
const reached = (stage: Stage, step: Stage, order: Stage[]) => order.indexOf(stage) >= order.indexOf(step);
const FLOW: Stage[] = ["new", "contacted", "qualified", "survey_scheduled", "survey_completed", "survey_approved", "quoted", "accepted", "confirmed", "packed", "dispatched", "delivered", "installing"];

async function staff(email: string) {
  const u = (await User.findOne({ email }).lean())!;
  return { id: String(u._id), name: u.name, role: u.role };
}

async function buildLead(s: Spec, k: number, actors: { sales: Awaited<ReturnType<typeof staff>>; tech: Awaited<ReturnType<typeof staff>>; warehouse: Awaited<ReturnType<typeof staff>> }) {
  const place = PLACES.find((p) => p.city === s.city)!;
  const { sales, tech, warehouse } = actors;
  const lead = await createLead(
    {
      name: s.name,
      phone: seededPhone(5000 + k),
      email: undefined,
      city: place.city,
      pincode: place.pincode,
      addressLine: `${12 + k * 7}-${3 + k}, ${place.areas[k % place.areas.length]}`,
      customerType: "residential",
      capacityKw: s.kw,
      systemType: s.systemType,
      wantsSubsidy: s.systemType === "on_grid",
      monthlyBillRs: 700 * s.kw + 300,
      message: s.stage === "new" ? "Please call after 6 pm" : undefined,
      source: s.source,
    },
    s.source === "website" ? null : sales,
  );
  if (s.ageHours) await Lead.collection.updateOne({ _id: (await Lead.findById(lead.leadId).lean())!._id }, { $set: { createdAt: addHours(new Date(), -s.ageHours) } });
  if (s.stage === "new") return;
  await markLeadContacted(lead.leadId, sales);
  if (s.stage === "contacted") return;
  if (s.stage === "lost") {
    await markLeadLost(lead.leadId, "Shaded roof — neighbour's water tank and tree cover most of the day", sales);
    return;
  }
  await qualifyLead({ leadId: lead.leadId, roofAreaSqft: 200 * s.kw + 250, shadowFreeAreaSqft: 120 * s.kw + 80, monthlyBillRs: 700 * s.kw + 300, sanctionedLoadKw: s.kw + 2, gridSuitable: true, roofType: "rcc" }, sales);
  if (s.stage === "qualified") return;

  // Ravi's survey today (late afternoon) shows in his My work; the rest are tomorrow morning.
  const today = startOfDayIST(new Date());
  const when = s.stage === "survey_scheduled" ? (Date.now() < addHours(today, 16).getTime() ? addHours(today, 16) : addHours(addDays(today, 1), 11)) : addHours(addDays(today, 1), 10);
  const { surveyId } = await scheduleSurvey({ leadId: lead.leadId, technicianId: tech.id, scheduledFor: toDateTimeInputValue(when) }, sales);
  if (s.stage === "survey_scheduled") return;
  await submitSurvey(
    { surveyId, roofDirection: "S", tiltDeg: 15, roofType: "rcc", usableAreaSqft: 110 * s.kw + 60, shadingPct: 5, cableDistanceM: 18, floors: 2, earthingPossible: true, recommendedKw: s.kw, recommendedSystemType: s.systemType, photos: [await uploadPhoto(tech.id, "roof-south.png")] },
    { ...tech, role: "technician" },
  );
  if (s.stage === "survey_completed") return;
  await reviewSurvey({ surveyId, decision: "approve" }, sales);
  if (s.stage === "survey_approved") return;

  const ctx = (await getQuoteBuilderContext(lead.leadId))!;
  const pkg = ctx.catalog.packages.find((p) => p.capacityKw === s.kw && p.systemType === s.systemType)!;
  const lines = expandPackage(pkg.lines, new Map(ctx.catalog.products.map((p) => [p.id, p])));
  const quote = await saveQuote(
    { leadId: lead.leadId, packageId: pkg.id, capacityKw: s.kw, systemType: s.systemType, lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPriceRs: l.unitPricePaise / 100 })), notes: undefined, send: true },
    sales,
  );
  if (s.stage === "quoted") return;
  const { orderId } = await acceptQuote(quote.quoteId, sales);
  if (s.stage === "accepted") return;
  const order = (await Order.findById(orderId).lean())!;
  await recordPayment({ orderId, amountPaise: Math.round(order.totalPaise / 2 / 100_000) * 100_000, mode: "upi", type: "advance", reference: `UPI${400000 + k * 131}` }, sales);
  if (s.stage === "confirmed") return;

  const detail = (await getDispatchDetail(orderId))!;
  for (const line of detail.lines) {
    if (line.isSerialized) {
      const units = await SerialUnit.find({ productId: line.productId, status: "in_stock" }).sort({ serial: 1 }).limit(line.qty).lean();
      for (const u of units) await scanSerial(orderId, u.serial, warehouse);
    } else await setBulkPicked(orderId, line.productId, true, warehouse);
  }
  if (s.stage === "packed") return;
  await dispatchOrder({ orderId, vehicleNo: `TS 09 EB ${4100 + k}`, driverName: "Yadagiri", driverPhone: "9848123456" }, warehouse);
  if (s.stage === "dispatched") return;
  await deliverOrder({ orderId, receivedBy: s.name, note: undefined }, warehouse);
  if (s.stage === "delivered") return;
  const job = (await Job.findOne({ orderId }).lean())!;
  const lead0 = (await User.findById(job.technicianIds[0]).lean())!;
  await startJob(String(job._id), { id: String(lead0._id), name: lead0.name, role: "technician" });
}

async function seedTickets(actors: { support: Awaited<ReturnType<typeof staff>>; tech: Awaited<ReturnType<typeof staff>> }) {
  const { support, tech } = actors;
  const ravi = { ...tech, role: "technician" as const };
  const now = new Date();
  const recent = await Order.find({ notes: "seed:history", status: "commissioned" }).sort({ commissionedAt: -1 }).limit(12).lean();
  const unitOf = async (orderId: Types.ObjectId, category: ProductCategory) => (await SerialUnit.findOne({ orderId, category, status: "installed" }).lean())!;
  const visit = (hoursFromNow: number) => toDateTimeInputValue(addHours(now, hoursFromNow));

  // 1. Workmanship: a wiring fault with no serial on the ~2-year-old installation.
  const prasanna = (await Customer.findOne({ name: "Lakshmi Prasanna" }).lean())!;
  await createTicket({ serial: undefined, customerId: String(prasanna._id), category: "wiring_earthing", faultCode: undefined, description: "ACDB tripping in the afternoon; earthing pit cover broken", priority: "medium", channel: "whatsapp" }, support);

  // 2. Low generation, visit booked for Ravi.
  const p1 = await unitOf(recent[0]!._id, "panel");
  const t2 = await createTicket({ serial: p1.serial, customerId: undefined, category: "low_generation", faultCode: undefined, description: "Generation dropped from 12 to 8 units a day", priority: "medium", channel: "phone" }, support);
  await assignTicket({ ticketId: t2.ticketId, technicianId: tech.id, visitAt: visit(3) }, support);

  // 3. Fixed, waiting for the customer's OK.
  const inv3 = await unitOf(recent[1]!._id, "inverter");
  const t3 = await createTicket({ serial: inv3.serial, customerId: undefined, category: "fault_code", faultCode: "E-22", description: "Inverter shows E-22 after rain", priority: "high", channel: "phone" }, support);
  await assignTicket({ ticketId: t3.ticketId, technicianId: tech.id, visitAt: visit(-4) }, support);
  await startTicket(t3.ticketId, ravi);
  const fuse = (await Product.findOne({ sku: "SPR-FUSE" }).lean())!;
  await resolveTicket({ ticketId: t3.ticketId, type: "repair", notes: "Moisture in DC isolator; dried, sealed and two fuses replaced", labourHours: 1.5, parts: [{ productId: String(fuse._id), qty: 2 }] }, ravi);

  // 4. Confirmed by the customer, ready to close.
  const p4 = await unitOf(recent[2]!._id, "panel");
  const t4 = await createTicket({ serial: p4.serial, customerId: undefined, category: "low_generation", faultCode: undefined, description: "Bird droppings and dust on the array", priority: "low", channel: "walk_in" }, support);
  await resolveTicket({ ticketId: t4.ticketId, type: "advice", notes: "Explained monthly cleaning; generation back to normal after wash", labourHours: 0, parts: [] }, { ...support, role: "support" });
  await confirmTicket({ ticketId: t4.ticketId, confirmedBy: "Customer", channel: "whatsapp", note: "Sent a photo of 13 units today" }, support);

  // 5. Physical damage: not covered, made billable with a reason.
  const p5 = await unitOf(recent[3]!._id, "panel");
  const t5 = await createTicket({ serial: p5.serial, customerId: undefined, category: "physical_damage", faultCode: undefined, description: "Panel glass cracked — cricket ball from the next terrace", priority: "low", channel: "phone" }, support);
  await overrideBilling({ ticketId: t5.ticketId, billable: true, reason: "Physical damage by a third party is not covered by warranty" }, support);

  // 6. Two months ago on the 28-month-old installation: out of warranty, billed automatically, closed.
  const padma = (await Customer.findOne({ name: "Padmavathi Devi" }).lean())!;
  const invP = (await SerialUnit.findOne({ customerId: padma._id, category: "inverter" }).lean())!;
  const then = addDays(now, -60);
  const spd = (await Product.findOne({ sku: "SPR-SPD" }).lean())!;
  const t6 = await createTicket({ serial: invP.serial, customerId: undefined, category: "no_power", faultCode: undefined, description: "No power after a lightning storm", priority: "urgent", channel: "phone" }, support, { at: then });
  await resolveTicket({ ticketId: t6.ticketId, type: "repair", notes: "Surge protection device blown by lightning; replaced and tested", labourHours: 2, parts: [{ productId: String(spd._id), qty: 1 }] }, { ...support, role: "support" }, { at: addHours(then, 6) });
  await confirmTicket({ ticketId: t6.ticketId, confirmedBy: "Padmavathi Devi", channel: "call", note: undefined }, support, { at: addHours(then, 24) });
  await closeTicket(t6.ticketId, support, { at: addHours(then, 25) });
}

export async function seedPipeline(): Promise<string> {
  if (await Counter.exists({ _id: MARKER })) return "Pipeline: already seeded";
  const actors = {
    sales: await staff("sales@sunpower.demo"),
    tech: await staff("tech@sunpower.demo"),
    warehouse: await staff("warehouse@sunpower.demo"),
    support: await staff("support@sunpower.demo"),
  };
  for (const [k, s] of SPECS.entries()) await buildLead(s, k, actors);
  await seedTickets(actors);
  await Counter.create({ _id: MARKER, seq: SPECS.length });
  const orders = SPECS.filter((s) => reached(s.stage, "accepted", FLOW) && ORDER_STAGES.includes(s.stage)).length;
  return `Pipeline: ${SPECS.length - orders} open leads, ${orders} live orders, 6 service tickets`;
}
