/**
 * The sales funnel around the finished installations:
 *
 *   lost      a year of enquiries that did not convert, lost at every stage —
 *             after a call, after qualification, survey rejected (site not
 *             feasible), quote declined, quote expired — from every source
 *   open      today's pipeline, seven or more in every stage and every source in
 *             every stage, with surveys booked over the next three weeks, one
 *             survey overdue, quotes awaiting the customer, drafts and v2
 *             revisions after a declined v1
 */
import { Types } from "mongoose";
import { LEAD_SOURCE_LABELS, QUOTE_VALIDITY_DAYS, type CustomerType, type LeadSource, type RequestedSystemType, type SystemType } from "@/lib/constants";
import { Customer, Lead, Quote, Survey, Activity } from "@/server/models";
import { reserve } from "../history";
import { seededPhone } from "../people";
import {
  BUSINESSES,
  PLACES,
  Timeline,
  addDays,
  addHours,
  customerDoc,
  gstinFor,
  insertOpts,
  ist,
  personName,
  pick,
  placeOf,
  prng,
  quoteFigures,
  surveyPhotos,
  weighted,
  who,
  type Ctx,
} from "./common";

const SOURCES: LeadSource[] = ["website", "whatsapp", "phone", "walk_in", "referral", "other"];
const OTHER_NOTES = ["Met us at the HITEX solar expo", "Saw the newspaper ad in Eenadu", "Came through the RWA notice board", "Facebook page message"];

const LOST_AT_CALL = [
  "Not reachable after three call attempts",
  "Only checking prices for now",
  "Rented house; the owner did not agree to rooftop work",
  "Monthly bill under ₹600, too low to justify solar",
  "Bought from a local electrician at a lower price",
  "Wants to wait until the next financial year",
];
const LOST_AFTER_QUALIFY = [
  "Roof too small for the load after the new floor was added",
  "Sanctioned load must be enhanced first; customer will come back",
  "Apartment society would not give an NOC for the terrace",
  "Chose a solar water heater instead",
  "Family is moving to another city",
];
const NOT_FEASIBLE = [
  "Heavy shading from the neighbouring five-floor building after 1 pm",
  "Asbestos sheet roof cannot carry the structure safely",
  "Roof slab has cracks and seepage; waterproofing needed first",
  "Usable shadow-free area is only 80 sq ft",
];
const QUOTE_DECLINED = [
  "Went with a competitor about 8% cheaper",
  "Family postponed the decision to after the wedding season",
  "Expected a higher subsidy than the PM Surya Ghar slab",
  "Needed EMI and the bank loan was not sanctioned",
  "Wanted a bigger-brand inverter than the one offered",
];

type Stage = "call" | "qualified" | "survey_rejected" | "quote_rejected" | "quote_expired";

type LeadPlan = {
  name: string;
  phone: string;
  type: CustomerType;
  gstin?: string;
  city: string;
  source: LeadSource;
  requested: RequestedSystemType;
  kw: number;
  createdAt: Date;
};

function requestedFor(rand: () => number, commercial: boolean): RequestedSystemType {
  if (commercial) return weighted(rand, [["on_grid", 6], ["panel_set", 2], ["unsure", 2]] as const);
  return weighted(rand, [["on_grid", 60], ["off_grid", 12], ["panel_set", 10], ["unsure", 18]] as const);
}

/** What we would actually quote for a request ("not sure" becomes On-Grid). */
const quotedType = (r: RequestedSystemType): SystemType => (r === "unsure" ? "on_grid" : r);

function planLead(rand: () => number, phone: string, createdAt: Date, source: LeadSource, forceType?: RequestedSystemType): LeadPlan {
  const commercial = rand() < 0.11;
  const biz = commercial ? pick(rand, BUSINESSES) : null;
  const city = biz ? biz.city : pick(rand, PLACES).city;
  return {
    name: biz ? biz.name : personName(rand),
    phone,
    type: commercial ? "commercial" : "residential",
    gstin: commercial ? gstinFor(rand) : undefined,
    city,
    source,
    requested: forceType ?? requestedFor(rand, commercial),
    kw: commercial ? pick(rand, [4, 5, 5]) : pick(rand, [1, 2, 2, 3, 3, 3, 4, 5]),
    createdAt,
  };
}

/** Lead + customer documents shared by both halves. */
function leadDocs(ctx: Ctx, rand: () => number, p: LeadPlan, number: string, assigned: Types.ObjectId | undefined) {
  const customer = customerDoc(rand, { name: p.name, phone: p.phone, place: placeOf(p.city), type: p.type, gstin: p.gstin, at: p.createdAt });
  const bill = 450 * p.kw + Math.floor(rand() * 900) + (p.type === "commercial" ? 6000 : 0);
  const lead = {
    _id: new Types.ObjectId(),
    number,
    customerId: customer._id,
    name: p.name,
    phone: p.phone,
    city: p.city,
    source: p.source,
    requirement: {
      capacityKw: p.kw,
      systemType: p.requested,
      wantsSubsidy: p.type === "residential" && (p.requested === "on_grid" || p.requested === "unsure"),
      monthlyBillRs: bill,
      message: p.source === "other" ? pick(rand, OTHER_NOTES) : p.source === "website" && rand() < 0.4 ? pick(rand, ["Please call after 6 pm", "Want to know the subsidy amount", "Is the roof strong enough?", "Need EMI options"]) : undefined,
    },
    status: "new" as string,
    assignedTo: assigned,
    lastActivityAt: p.createdAt,
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
  } as Record<string, unknown> & { _id: Types.ObjectId; customerId: Types.ObjectId };
  return { customer, lead, bill };
}

function qualification(rand: () => number, p: LeadPlan, bill: number, at: Date, by: Types.ObjectId) {
  return {
    roofAreaSqft: 180 * p.kw + 200 + Math.floor(rand() * 200),
    shadowFreeAreaSqft: 110 * p.kw + 60 + Math.floor(rand() * 80),
    monthlyBillRs: bill,
    sanctionedLoadKw: p.kw + 1 + Math.floor(rand() * 3),
    gridSuitable: true,
    roofType: p.type === "commercial" ? "metal_sheet" : weighted(rand, [["rcc", 85], ["tile", 8], ["metal_sheet", 7]] as const),
    qualifiedAt: at,
    qualifiedBy: by,
  };
}

function measurements(rand: () => number, p: LeadPlan, opts: { infeasible?: string } = {}) {
  const infeasible = opts.infeasible ?? "";
  return {
    roofDirection: pick(rand, ["S", "S", "S", "SE", "SW", "E", "W"] as const),
    tiltDeg: 10 + Math.floor(rand() * 12),
    roofType: infeasible.startsWith("Asbestos") ? "asbestos" : p.type === "commercial" ? "metal_sheet" : weighted(rand, [["rcc", 85], ["tile", 8], ["ground", 4], ["metal_sheet", 3]] as const),
    usableAreaSqft: infeasible.includes("80 sq ft") ? 80 : 105 * p.kw + 60 + Math.floor(rand() * 80),
    shadingPct: infeasible.startsWith("Heavy shading") ? 45 + Math.floor(rand() * 20) : Math.floor(rand() * 12),
    cableDistanceM: 8 + Math.floor(rand() * 30),
    floors: 1 + Math.floor(rand() * 4),
    earthingPossible: !infeasible.startsWith("Roof slab"),
    recommendedKw: p.kw,
    recommendedSystemType: quotedType(p.requested),
  };
}

function quoteDoc(ctx: Ctx, p: LeadPlan, ids: { lead: Types.ObjectId; customer: Types.ObjectId }, number: string, version: number, status: string, createdAt: Date, by: ReturnType<typeof who>, extra: Record<string, unknown> = {}, kw = p.kw) {
  const f = quoteFigures(ctx, kw, quotedType(p.requested), p.type);
  return {
    _id: new Types.ObjectId(),
    number,
    version,
    leadId: ids.lead,
    customerId: ids.customer,
    packageId: f.pkg._id,
    packageCode: f.pkg.code,
    title: f.title,
    systemType: quotedType(p.requested),
    capacityKw: kw,
    lines: f.lines,
    taxablePaise: f.totals.taxablePaise,
    gstPaise: f.totals.gstPaise,
    totalPaise: f.totals.totalPaise,
    subsidyPaise: f.subsidyPaise,
    netCostPaise: f.totals.totalPaise - f.subsidyPaise,
    status,
    validUntil: addDays(createdAt, QUOTE_VALIDITY_DAYS),
    sentAt: status === "draft" ? undefined : createdAt,
    createdBy: by,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Lost enquiries over the last twelve months                          */
/* ------------------------------------------------------------------ */

export async function seedLostLeads(ctx: Ctx): Promise<string> {
  const rand = prng(51001);
  const N = 180;
  const now = ctx.now;
  const plans: (LeadPlan & { stage: Stage })[] = [];
  for (let i = 0; i < N; i++) {
    // Older enquiries spread evenly; one in eight inside the last 45 days so the board's Lost column is full.
    const recent = i % 8 === 0;
    const ageDays = recent ? 4 + rand() * 40 : 8 + ((365 - 8) * (i + rand())) / N;
    const createdAt = ist(addDays(now, -ageDays), 9 + rand() * 10);
    const source = weighted(rand, [["website", 30], ["whatsapp", 26], ["phone", 16], ["walk_in", 9], ["referral", 11], ["other", 8]] as const);
    const p = planLead(rand, seededPhone(6000 + i), createdAt, source);
    let stage = weighted(rand, [["call", 30], ["qualified", 18], ["survey_rejected", 14], ["quote_rejected", 22], ["quote_expired", 16]] as const);
    if (ageDays < 22 && (stage === "quote_expired" || stage === "quote_rejected")) stage = "call";
    if (ageDays < 12) stage = rand() < 0.6 ? "call" : "qualified";
    plans.push({ ...p, stage });
  }
  plans.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const surveyCount = plans.filter((p) => p.stage === "survey_rejected" || p.stage.startsWith("quote")).length;
  const quoteCount = plans.filter((p) => p.stage.startsWith("quote")).length;
  const [leadNos, surveyNos, quoteNos] = await Promise.all([reserve("SP-L", N), reserve("SP-SV", surveyCount), reserve("SP-Q", quoteCount)]);

  const customers: object[] = [];
  const leads: object[] = [];
  const surveys: object[] = [];
  const quotes: object[] = [];
  const t = new Timeline();
  let sv = 0;
  let q = 0;
  for (const [i, p] of plans.entries()) {
    const salesUser = ctx.sales[i % ctx.sales.length]!;
    const surveyor = ctx.surveyors[i % ctx.surveyors.length]!;
    const { customer, lead, bill } = leadDocs(ctx, rand, p, leadNos[i]!, salesUser._id);
    t.add("lead", lead._id, customer._id, "created", `Enquiry received via ${LEAD_SOURCE_LABELS[p.source].toLowerCase()}: ${p.kw} kW`, p.createdAt);

    const contactedAt = addHours(p.createdAt, rand() < 0.15 ? 3 + rand() * 20 : 0.3 + rand() * 1.6);
    lead.firstContactedAt = contactedAt;
    t.add("lead", lead._id, customer._id, "contacted", "First call made; requirement noted", contactedAt, who(salesUser));
    let lostAt = addDays(contactedAt, 1 + rand() * 8);
    let reason = pick(rand, LOST_AT_CALL);

    if (p.stage !== "call") {
      const qualifiedAt = addDays(contactedAt, 1 + rand() * 2);
      lead.qualification = qualification(rand, p, bill, qualifiedAt, salesUser._id);
      t.add("lead", lead._id, customer._id, "qualified", "Qualified: roof and bill details recorded", qualifiedAt, who(salesUser));
      lostAt = addDays(qualifiedAt, 3 + rand() * 10);
      reason = pick(rand, LOST_AFTER_QUALIFY);

      if (p.stage !== "qualified") {
        const surveyAt = ist(addDays(qualifiedAt, 2 + Math.floor(rand() * 4)), pick(rand, [10, 11.5, 15]));
        const reviewedAt = addHours(surveyAt, 20 + rand() * 10);
        const rejected = p.stage === "survey_rejected";
        const note = rejected ? pick(rand, NOT_FEASIBLE) : undefined;
        const survey = {
          _id: new Types.ObjectId(),
          number: surveyNos[sv++],
          leadId: lead._id,
          customerId: customer._id,
          technicianId: surveyor._id,
          scheduledFor: surveyAt,
          status: rejected ? "rejected" : "approved",
          measurements: measurements(rand, p, { infeasible: note }),
          photos: surveyPhotos(ctx, i, { commercial: p.type === "commercial", shaded: note?.startsWith("Heavy shading") }),
          notes: rejected ? note : undefined,
          completedAt: addHours(surveyAt, 1.2),
          reviewedBy: salesUser._id,
          reviewedAt,
          reviewNote: note,
          createdAt: addHours(qualifiedAt, 1),
          updatedAt: reviewedAt,
        };
        surveys.push(survey);
        lead.surveyId = survey._id;
        t.add("survey", survey._id, customer._id, "scheduled", `Site survey booked with ${surveyor.name}`, addHours(qualifiedAt, 1), who(salesUser));
        t.add("survey", survey._id, customer._id, "completed", "Survey submitted with roof photos and measurements", addHours(surveyAt, 1.2), who(surveyor));
        if (rejected) {
          reason = `Site not feasible: ${note}`;
          lostAt = reviewedAt;
          t.add("survey", survey._id, customer._id, "review_reject", `Survey ${survey.number}: site not feasible — ${note}`, reviewedAt, who(salesUser));
        } else {
          t.add("survey", survey._id, customer._id, "review_approve", `Survey ${survey.number} approved — quote unlocked`, reviewedAt, who(salesUser));
          const sentAt = addHours(reviewedAt, 2 + rand() * 20);
          const expired = p.stage === "quote_expired";
          const declinedAt = addDays(sentAt, 2 + rand() * 10);
          reason = expired ? "Quote expired; customer stopped responding after two follow-ups" : pick(rand, QUOTE_DECLINED);
          const quote = quoteDoc(ctx, p, { lead: lead._id, customer: customer._id }, quoteNos[q++]!, 1, expired ? "expired" : "rejected", sentAt, who(salesUser), expired ? {} : { rejectedReason: reason, updatedAt: declinedAt });
          quotes.push(quote);
          lead.quoteId = quote._id;
          t.add("quote", quote._id, customer._id, "created", `Quote ${quote.number} (v1) sent: ${quote.title}`, sentAt, who(salesUser));
          lostAt = expired ? addDays(quote.validUntil, 1 + rand() * 4) : declinedAt;
          if (!expired) t.add("quote", quote._id, customer._id, "rejected", `Quote ${quote.number} declined: ${reason}`, declinedAt, who(salesUser));
        }
      }
    }
    if (lostAt.getTime() > now.getTime() - 3_600_000) lostAt = new Date(now.getTime() - (2 + rand() * 20) * 3_600_000);
    lead.status = "lost";
    lead.lostReason = reason;
    lead.lastActivityAt = lostAt;
    lead.updatedAt = lostAt;
    customers.push(customer);
    leads.push(lead);
    t.add("lead", lead._id, customer._id, "lost", `Marked lost: ${reason}`, lostAt, who(salesUser));
  }

  await Customer.insertMany(customers, insertOpts);
  await Promise.all([Lead.insertMany(leads, insertOpts), Survey.insertMany(surveys, insertOpts), Quote.insertMany(quotes, insertOpts), Activity.insertMany(t.docs, insertOpts)]);
  const by = (s: Stage) => plans.filter((p) => p.stage === s).length;
  return `Lost enquiries: ${N} over 12 months (call ${by("call")}, after qualifying ${by("qualified")}, survey rejected ${by("survey_rejected")}, quote declined ${by("quote_rejected")}, quote expired ${by("quote_expired")})`;
}

/* ------------------------------------------------------------------ */
/* Today's open pipeline                                               */
/* ------------------------------------------------------------------ */

type OpenStage = "new" | "contacted" | "qualified" | "survey_scheduled" | "survey_completed" | "survey_approved" | "quoted";
const OPEN: { stage: OpenStage; n: number }[] = [
  { stage: "new", n: 7 },
  { stage: "contacted", n: 7 },
  { stage: "qualified", n: 7 },
  { stage: "survey_scheduled", n: 9 },
  { stage: "survey_completed", n: 6 },
  { stage: "survey_approved", n: 6 },
  { stage: "quoted", n: 10 },
];

export async function seedOpenPipeline(ctx: Ctx): Promise<string> {
  const rand = prng(52002);
  const now = ctx.now;
  const plans: (LeadPlan & { stage: OpenStage; j: number })[] = [];
  let k = 0;
  for (const [si, { stage, n }] of OPEN.entries()) {
    for (let j = 0; j < n; j++) {
      const source = SOURCES[(j + si) % SOURCES.length]!;
      const ageH =
        stage === "new"
          ? [0.4, 1.1, 1.7, 2.6, 5.5, 9, 27][j]!
          : 24 * ({ contacted: 1, qualified: 2.5, survey_scheduled: 4, survey_completed: 6, survey_approved: 8, quoted: 11 }[stage] + rand() * 5 + j * 0.4);
      // Panel Sets and "not sure" appear in the open pipeline too.
      const force: RequestedSystemType | undefined = j === 3 ? "panel_set" : j === 5 ? "unsure" : j === 6 && stage !== "quoted" ? "off_grid" : undefined;
      const p = planLead(rand, seededPhone(6700 + k++), addHours(now, -ageH), source, force);
      plans.push({ ...p, stage, j });
    }
  }
  plans.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const needsSurvey = (s: OpenStage) => ["survey_scheduled", "survey_completed", "survey_approved", "quoted"].includes(s);
  const quotesNeeded = plans.filter((p) => p.stage === "quoted").reduce((s, p) => s + (p.j === 2 || p.j === 7 || p.j === 8 ? 2 : 1), 0);
  const [leadNos, surveyNos, quoteNos] = await Promise.all([reserve("SP-L", plans.length), reserve("SP-SV", plans.filter((p) => needsSurvey(p.stage)).length), reserve("SP-Q", quotesNeeded)]);

  const customers: object[] = [];
  const leads: object[] = [];
  const surveys: object[] = [];
  const quotes: object[] = [];
  const t = new Timeline();
  let sv = 0;
  let q = 0;
  // Bookings per surveyor and day, so nobody gets two surveys at the same time.
  const booked = new Set<string>();
  for (const [i, p] of plans.entries()) {
    const salesUser = ctx.sales[i % ctx.sales.length]!;
    // Website and WhatsApp enquiries arrive unassigned until someone picks them up.
    const unassigned = p.stage === "new" && (p.source === "website" || p.source === "whatsapp");
    const { customer, lead, bill } = leadDocs(ctx, rand, p, leadNos[i]!, unassigned ? undefined : salesUser._id);
    customers.push(customer);
    leads.push(lead);
    lead.status = p.stage;
    t.add("lead", lead._id, customer._id, "created", `Enquiry received via ${LEAD_SOURCE_LABELS[p.source].toLowerCase()}: ${p.kw} kW`, p.createdAt, unassigned ? undefined : who(salesUser));
    if (p.stage === "new") continue;

    const contactedAt = addHours(p.createdAt, 0.3 + rand() * 1.5);
    lead.firstContactedAt = contactedAt;
    lead.lastActivityAt = contactedAt;
    lead.updatedAt = contactedAt;
    t.add("lead", lead._id, customer._id, "contacted", "First call made; requirement noted", contactedAt, who(salesUser));
    if (p.stage === "contacted") continue;

    const qualifiedAt = addHours(contactedAt, 18 + rand() * 20);
    lead.qualification = qualification(rand, p, bill, qualifiedAt, salesUser._id);
    lead.lastActivityAt = qualifiedAt;
    lead.updatedAt = qualifiedAt;
    t.add("lead", lead._id, customer._id, "qualified", "Qualified: roof and bill details recorded", qualifiedAt, who(salesUser));
    if (p.stage === "qualified") continue;

    // Survey: booked ahead (scheduled), done yesterday/today (awaiting review) or reviewed.
    let surveyAt: Date;
    const surveyor = ctx.surveyors[p.j % ctx.surveyors.length]!;
    if (p.stage === "survey_scheduled") {
      // One left overdue (yesterday, not done); the rest from today to three weeks out.
      const offsets = [-1, 0, 0, 1, 2, 4, 7, 12, 19];
      let day = offsets[p.j % offsets.length]!;
      let hour = pick(rand, [10, 11.5, 14, 16]);
      if (day === 0 && ist(now, hour).getTime() < now.getTime() + 3_600_000) day = 1;
      while (booked.has(`${surveyor._id}|${day}|${hour}`)) hour += 1.5;
      booked.add(`${surveyor._id}|${day}|${hour}`);
      surveyAt = ist(addDays(now, day), hour);
    } else if (p.stage === "survey_completed") {
      surveyAt = ist(addDays(now, -(p.j % 3)), 10 + (p.j % 2) * 1.5);
      if (surveyAt.getTime() > now.getTime() - 2 * 3_600_000) surveyAt = ist(addDays(now, -1), 15);
    } else {
      surveyAt = ist(addDays(qualifiedAt, 2), 11);
    }
    const scheduledOn = addHours(qualifiedAt, 1);
    const survey: Record<string, unknown> & { _id: Types.ObjectId; number: string } = {
      _id: new Types.ObjectId(),
      number: surveyNos[sv++]!,
      leadId: lead._id,
      customerId: customer._id,
      technicianId: surveyor._id,
      scheduledFor: surveyAt,
      status: "scheduled",
      photos: [],
      createdAt: scheduledOn,
      updatedAt: scheduledOn,
    };
    surveys.push(survey);
    lead.surveyId = survey._id;
    lead.lastActivityAt = scheduledOn;
    t.add("survey", survey._id, customer._id, "scheduled", `Site survey booked with ${surveyor.name}`, scheduledOn, who(salesUser));
    if (p.stage === "survey_scheduled") continue;

    const doneAt = addHours(surveyAt, 1.25);
    Object.assign(survey, { status: "completed", measurements: measurements(rand, p), photos: surveyPhotos(ctx, i, { commercial: p.type === "commercial", shaded: p.j === 4 }), completedAt: doneAt, notes: p.j === 4 ? "Partial shade from a coconut tree on the west side after 4 pm; layout keeps the panels clear" : undefined, updatedAt: doneAt });
    lead.lastActivityAt = doneAt;
    lead.updatedAt = doneAt;
    t.add("survey", survey._id, customer._id, "completed", "Survey submitted with roof photos and measurements", doneAt, who(surveyor));
    if (p.stage === "survey_completed") continue;

    const reviewedAt = addHours(doneAt, 18 + rand() * 10);
    Object.assign(survey, { status: "approved", reviewedBy: salesUser._id, reviewedAt, updatedAt: reviewedAt });
    lead.lastActivityAt = reviewedAt;
    lead.updatedAt = reviewedAt;
    t.add("survey", survey._id, customer._id, "review_approve", `Survey ${survey.number} approved — quote unlocked`, reviewedAt, who(salesUser));
    if (p.stage === "survey_approved") continue;

    // Quoted: sent and valid; two drafts; two v2 revisions after a declined v1; one re-quote after expiry.
    const ids = { lead: lead._id, customer: customer._id };
    let sentAt = addHours(reviewedAt, 3 + rand() * 30);
    if (sentAt.getTime() > now.getTime() - 3_600_000) sentAt = addHours(now, -3);
    if (p.j === 2 || p.j === 7) {
      const v1 = quoteDoc(ctx, p, ids, quoteNos[q++]!, 1, "rejected", sentAt, who(salesUser), { rejectedReason: "Asked for a smaller system to fit the budget" }, Math.min(5, p.kw + 1));
      quotes.push(v1);
      t.add("quote", v1._id, customer._id, "created", `Quote ${v1.number} (v1) sent: ${v1.title}`, sentAt, who(salesUser));
      t.add("quote", v1._id, customer._id, "rejected", `Quote ${v1.number} declined: Asked for a smaller system to fit the budget`, addDays(sentAt, 1), who(salesUser));
      sentAt = addDays(sentAt, 1.2);
    } else if (p.j === 8) {
      const old = addDays(now, -QUOTE_VALIDITY_DAYS - 4);
      const v1 = quoteDoc(ctx, p, ids, quoteNos[q++]!, 1, "expired", old, who(salesUser));
      quotes.push(v1);
      t.add("quote", v1._id, customer._id, "created", `Quote ${v1.number} (v1) sent: ${v1.title}`, old, who(salesUser));
      sentAt = addDays(now, -2);
    }
    const draft = p.j === 1 || p.j === 6;
    const version = p.j === 2 || p.j === 7 || p.j === 8 ? 2 : 1;
    const quote = quoteDoc(ctx, p, ids, quoteNos[q++]!, version, draft ? "draft" : "sent", sentAt, who(salesUser));
    quotes.push(quote);
    lead.quoteId = quote._id;
    lead.lastActivityAt = sentAt;
    lead.updatedAt = sentAt;
    t.add("quote", quote._id, customer._id, "created", `Quote ${quote.number} (v${version}) ${draft ? "drafted" : "sent"}: ${quote.title}`, sentAt, who(salesUser));
  }

  await Customer.insertMany(customers, insertOpts);
  await Promise.all([Lead.insertMany(leads, insertOpts), Survey.insertMany(surveys, insertOpts), Quote.insertMany(quotes, insertOpts), Activity.insertMany(t.docs, insertOpts)]);
  return `Open pipeline: ${plans.length} leads (${OPEN.map((o) => `${o.stage} ${o.n}`).join(", ")}), ${surveys.length} surveys, ${quotes.length} quotes`;
}

