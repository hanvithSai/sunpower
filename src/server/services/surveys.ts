/**
 * Site surveys: a technician measures the roof (direction, tilt, shading, cable
 * distance, photos) and sales reviews it. Approval is the gate that unlocks
 * quoting; a weak survey can be redone, or the lead closed as not feasible.
 */
import { Types, type ClientSession } from "mongoose";
import { ROOF_DIRECTION_LABELS, SURVEY_STATUSES, SYSTEM_TYPE_LABELS, type Role, type SurveyStatus } from "@/lib/constants";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import type { ReviewSurveyInput, SubmitSurveyInput } from "@/lib/validation/surveys";
import { LEAD_FLOW, SURVEY_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import { toObjectId, type Actor } from "../lib/actor";
import { Customer, Lead, Survey, User } from "../models";
import { logActivity } from "./core/activity";
import { nextNumber } from "./core/counters";

type SurveyActor = Actor & { role: Role };

export type SurveyRow = {
  id: string;
  number: string;
  status: SurveyStatus;
  scheduledFor: Date;
  leadId: string;
  leadNumber: string;
  customerName: string;
  city: string;
  technicianId: string;
  technicianName: string;
  recommendedKw?: number;
};

export async function listSurveys(filter: { status?: string; technicianId?: string; page?: number; pageSize?: number }) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.status && (SURVEY_STATUSES as readonly string[]).includes(filter.status)) query.status = filter.status;
  if (filter.technicianId && Types.ObjectId.isValid(filter.technicianId)) query.technicianId = toObjectId(filter.technicianId);
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 20);

  const countQuery = { ...query };
  delete countQuery.status;
  const [surveys, total, grouped] = await Promise.all([
    // Upcoming first for scheduled work; most recent first otherwise.
    Survey.find(query).sort({ scheduledFor: query.status === "scheduled" ? 1 : -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Survey.countDocuments(query),
    Survey.aggregate<{ _id: SurveyStatus; n: number }>([{ $match: countQuery }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  const [leads, techs] = await Promise.all([
    Lead.find({ _id: { $in: surveys.map((s) => s.leadId) } }).select("number name city").lean(),
    User.find({ _id: { $in: surveys.map((s) => s.technicianId) } }).select("name").lean(),
  ]);
  const leadById = new Map(leads.map((l) => [String(l._id), l]));
  const techById = new Map(techs.map((t) => [String(t._id), t.name]));

  const items: SurveyRow[] = surveys.map((s) => {
    const lead = leadById.get(String(s.leadId));
    return {
      id: String(s._id),
      number: s.number,
      status: s.status,
      scheduledFor: s.scheduledFor,
      leadId: String(s.leadId),
      leadNumber: lead?.number ?? "—",
      customerName: lead?.name ?? "—",
      city: lead?.city ?? "—",
      technicianId: String(s.technicianId),
      technicianName: techById.get(String(s.technicianId)) ?? "Technician",
      recommendedKw: s.measurements?.recommendedKw,
    };
  });
  const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n])) as Partial<Record<SurveyStatus, number>>;
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)), counts };
}

export async function getSurveyDetail(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const survey = await Survey.findById(id).lean();
  if (!survey) return null;
  const [lead, customer, technician, reviewer] = await Promise.all([
    Lead.findById(survey.leadId).select("number name phone city status requirement qualification").lean(),
    Customer.findById(survey.customerId).select("name phone address discom").lean(),
    User.findById(survey.technicianId).select("name phone").lean(),
    survey.reviewedBy ? User.findById(survey.reviewedBy).select("name").lean() : Promise.resolve(null),
  ]);
  return {
    survey: {
      id: String(survey._id),
      number: survey.number,
      status: survey.status,
      scheduledFor: survey.scheduledFor,
      measurements: survey.measurements,
      photos: survey.photos,
      notes: survey.notes,
      completedAt: survey.completedAt,
      reviewedAt: survey.reviewedAt,
      reviewNote: survey.reviewNote,
      reviewedByName: reviewer?.name,
      technicianId: String(survey.technicianId),
    },
    lead: lead
      ? {
          id: String(lead._id),
          number: lead.number,
          name: lead.name,
          phone: lead.phone,
          city: lead.city,
          status: lead.status,
          requirement: lead.requirement,
          qualification: lead.qualification,
        }
      : null,
    customer: customer ? { id: String(customer._id), name: customer.name, phone: customer.phone, address: customer.address, discom: customer.discom } : null,
    technician: technician ? { id: String(technician._id), name: technician.name, phone: technician.phone } : null,
  };
}

async function loadSurvey(id: string, session: ClientSession) {
  const survey = Types.ObjectId.isValid(id) ? await Survey.findById(id).session(session) : null;
  if (!survey) throw notFoundError("Survey");
  return survey;
}

async function loadLeadFor(leadId: Types.ObjectId, session: ClientSession) {
  const lead = await Lead.findById(leadId).session(session);
  if (!lead) throw notFoundError("Lead");
  return lead;
}

/** The technician's on-roof submission. Only the assigned technician (or an admin) may submit. */
export async function submitSurvey(input: SubmitSurveyInput, actor: SurveyActor): Promise<{ leadId: string }> {
  return withTransaction(async (session) => {
    const now = new Date();
    const survey = await loadSurvey(input.surveyId, session);
    if (actor.role !== "admin" && String(survey.technicianId) !== actor.id) {
      throw new AppError("FORBIDDEN", "Only the technician assigned to this survey can submit it.");
    }
    assertTransition("survey", SURVEY_FLOW, survey.status, "completed");

    survey.status = "completed";
    survey.measurements = {
      roofDirection: input.roofDirection,
      tiltDeg: input.tiltDeg,
      roofType: input.roofType,
      usableAreaSqft: input.usableAreaSqft,
      shadingPct: input.shadingPct,
      cableDistanceM: input.cableDistanceM,
      floors: input.floors,
      earthingPossible: input.earthingPossible,
      recommendedKw: input.recommendedKw,
      recommendedSystemType: input.recommendedSystemType,
    };
    survey.photos = input.photos;
    survey.notes = input.notes;
    survey.completedAt = now;
    await survey.save({ session });

    const lead = await loadLeadFor(survey.leadId, session);
    assertTransition("lead", LEAD_FLOW, lead.status, "survey_completed");
    lead.status = "survey_completed";
    lead.lastActivityAt = now;
    await lead.save({ session });

    const message = `Survey completed: ${ROOF_DIRECTION_LABELS[input.roofDirection].replace(" (best)", "")}-facing, ${input.tiltDeg}° tilt, ${input.shadingPct}% shading, ${input.cableDistanceM} m cable. Recommends ${input.recommendedKw} kW ${SYSTEM_TYPE_LABELS[input.recommendedSystemType]}`;
    await logActivity({ entityType: "survey", entityId: survey._id, customerId: survey.customerId, action: "completed", message, actor }, session);
    await logActivity({ entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "survey_completed", message, actor }, session);
    return { leadId: String(lead._id) };
  });
}

/** Sales review: approve (unlocks quoting), request a re-survey, or close as not feasible. */
export async function reviewSurvey(
  input: ReviewSurveyInput,
  actor: Actor,
): Promise<{ leadId: string; newSurveyId?: string }> {
  return withTransaction(async (session) => {
    const now = new Date();
    const survey = await loadSurvey(input.surveyId, session);
    const lead = await loadLeadFor(survey.leadId, session);
    const target = input.decision === "approve" ? "approved" : "rejected";
    assertTransition("survey", SURVEY_FLOW, survey.status, target);

    survey.status = target;
    survey.reviewedBy = toObjectId(actor.id);
    survey.reviewedAt = now;
    survey.reviewNote = input.note;
    await survey.save({ session });

    let newSurveyId: string | undefined;
    let message: string;

    if (input.decision === "approve") {
      assertTransition("lead", LEAD_FLOW, lead.status, "survey_approved");
      lead.status = "survey_approved";
      message = `Survey ${survey.number} approved — quote unlocked`;
    } else if (input.decision === "resurvey") {
      assertTransition("lead", LEAD_FLOW, lead.status, "survey_scheduled");
      const when = addHours(addDays(startOfDayIST(now), 1), 10); // tomorrow 10:00 IST
      const number = await nextNumber("survey", session);
      const [next] = await Survey.create(
        [{ number, leadId: lead._id, customerId: lead.customerId, technicianId: survey.technicianId, scheduledFor: when, status: "scheduled" }],
        { session },
      );
      newSurveyId = String(next._id);
      lead.status = "survey_scheduled";
      lead.surveyId = next._id;
      message = `Re-survey requested (${input.note}). ${number} booked for ${formatDateTime(when)}`;
      await logActivity({ entityType: "survey", entityId: next._id, customerId: lead.customerId, action: "scheduled", message, actor }, session);
    } else {
      assertTransition("lead", LEAD_FLOW, lead.status, "lost");
      lead.status = "lost";
      lead.lostReason = `Site not feasible: ${input.note}`;
      message = `Survey ${survey.number}: site not feasible — ${input.note}`;
    }
    lead.lastActivityAt = now;
    await lead.save({ session });

    await logActivity({ entityType: "survey", entityId: survey._id, customerId: survey.customerId, action: `review_${input.decision}`, message, actor }, session);
    await logActivity({ entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: `survey_${input.decision}`, message, actor }, session);
    return { leadId: String(lead._id), newSurveyId };
  });
}
