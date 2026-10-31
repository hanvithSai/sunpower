/**
 * Leads: every enquiry from the website, WhatsApp, phone calls and walk-ins.
 *
 * Owns the pre-sales state machine (LEAD_FLOW):
 *   new → contacted → qualified → survey_scheduled → survey_completed
 *       → survey_approved → quoted → won | lost
 * New website enquiries are assigned automatically to the salesperson with the
 * fewest open leads, so nothing waits in a shared inbox ("never vanishes").
 */
import { Types, type ClientSession } from "mongoose";
import {
  LEAD_FIRST_RESPONSE_SLA_HOURS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  REQUESTED_SYSTEM_TYPE_LABELS,
  type LeadSource,
  type LeadStatus,
  type RequestedSystemType,
} from "@/lib/constants";
import { escapeRegex, formatDateTime, fromISTInput } from "@/lib/format";
import { humanize } from "@/lib/format";
import type { EnquiryInput, QualifyLeadInput } from "@/lib/validation/leads";
import { LEAD_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import { toObjectId, type Actor } from "../lib/actor";
import { Customer, Lead, Order, Quote, Survey, User, type ILead } from "../models";
import { logActivity } from "./core/activity";
import { nextNumber } from "./core/counters";
import { upsertCustomerByPhone } from "./customers";

const DUPLICATE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const OPEN_STATUSES: LeadStatus[] = LEAD_STATUSES.filter((s) => s !== "won" && s !== "lost");

/* ------------------------------------------------------------------ */
/* Read models (plain, serialisable)                                   */
/* ------------------------------------------------------------------ */

export type LeadRow = {
  id: string;
  number: string;
  name: string;
  phone: string;
  city: string;
  source: LeadSource;
  status: LeadStatus;
  capacityKw: number;
  systemType: RequestedSystemType;
  wantsSubsidy: boolean;
  assignedToId?: string;
  assignedToName?: string;
  createdAt: Date;
  lastActivityAt: Date;
  /** Hours a "new" lead has waited for its first call; null once contacted. */
  waitingHours: number | null;
  slaBreached: boolean;
};

function toRow(lead: ILead, names: Map<string, string>, now: Date): LeadRow {
  const waitingHours =
    lead.status === "new" ? Math.max(0, (now.getTime() - new Date(lead.createdAt).getTime()) / HOUR_MS) : null;
  const assignedToId = lead.assignedTo ? String(lead.assignedTo) : undefined;
  return {
    id: String(lead._id),
    number: lead.number,
    name: lead.name,
    phone: lead.phone,
    city: lead.city,
    source: lead.source,
    status: lead.status,
    capacityKw: lead.requirement.capacityKw,
    systemType: lead.requirement.systemType,
    wantsSubsidy: lead.requirement.wantsSubsidy,
    assignedToId,
    assignedToName: assignedToId ? names.get(assignedToId) : undefined,
    createdAt: lead.createdAt,
    lastActivityAt: lead.lastActivityAt,
    waitingHours,
    slaBreached: waitingHours !== null && waitingHours >= LEAD_FIRST_RESPONSE_SLA_HOURS,
  };
}

async function userNames(ids: (Types.ObjectId | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export type LeadFilter = {
  status?: string;
  source?: string;
  q?: string;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

function buildQuery(filter: LeadFilter, includeStatus: boolean): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (includeStatus && filter.status && (LEAD_STATUSES as readonly string[]).includes(filter.status)) {
    query.status = filter.status;
  }
  if (filter.source && filter.source in LEAD_SOURCE_LABELS) query.source = filter.source;
  if (filter.assignedTo && Types.ObjectId.isValid(filter.assignedTo)) query.assignedTo = toObjectId(filter.assignedTo);
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");
    query.$or = [
      { name: rx },
      { city: rx },
      { number: rx },
      ...(digits.length >= 4 ? [{ phone: { $regex: escapeRegex(digits) } }] : []),
    ];
  }
  return query;
}

export async function listLeads(filter: LeadFilter, now: Date) {
  await connectDB();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 20);
  const query = buildQuery(filter, true);

  const [leads, total, grouped] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Lead.countDocuments(query),
    Lead.aggregate<{ _id: LeadStatus; n: number }>([
      { $match: buildQuery(filter, false) },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);
  const names = await userNames(leads.map((l) => l.assignedTo));
  const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n])) as Partial<Record<LeadStatus, number>>;
  return {
    items: leads.map((l) => toRow(l, names, now)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
  };
}

/** Headline numbers for the pipeline page (what needs attention right now). */
export async function getLeadPipelineStats(now: Date, assignedTo?: string) {
  await connectDB();
  const mine = assignedTo && Types.ObjectId.isValid(assignedTo) ? { assignedTo: toObjectId(assignedTo) } : {};
  const weekAgo = new Date(now.getTime() - 7 * 24 * HOUR_MS);
  const [uncontacted, newThisWeek, awaitingReview, readyToQuote] = await Promise.all([
    Lead.countDocuments({ ...mine, status: "new", createdAt: { $lt: new Date(now.getTime() - LEAD_FIRST_RESPONSE_SLA_HOURS * HOUR_MS) } }),
    Lead.countDocuments({ ...mine, createdAt: { $gte: weekAgo } }),
    Lead.countDocuments({ ...mine, status: "survey_completed" }),
    Lead.countDocuments({ ...mine, status: "survey_approved" }),
  ]);
  return { uncontacted, newThisWeek, awaitingReview, readyToQuote };
}

export const BOARD_COLUMNS: { key: string; title: string; statuses: LeadStatus[] }[] = [
  { key: "new", title: "New", statuses: ["new"] },
  { key: "contacted", title: "Contacted", statuses: ["contacted"] },
  { key: "qualified", title: "Qualified", statuses: ["qualified"] },
  { key: "survey", title: "Site survey", statuses: ["survey_scheduled", "survey_completed", "survey_approved"] },
  { key: "quoted", title: "Quoted", statuses: ["quoted"] },
  { key: "won", title: "Won", statuses: ["won"] },
  { key: "lost", title: "Lost", statuses: ["lost"] },
];

/** Kanban data: open stages in full (newest first, capped), won/lost from the last 30 days. */
export async function listLeadBoard(filter: LeadFilter, now: Date) {
  await connectDB();
  const base = buildQuery(filter, false);
  const recent = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
  const columns = await Promise.all(
    BOARD_COLUMNS.map(async (col) => {
      const closed = col.key === "won" || col.key === "lost";
      const query = { ...base, status: { $in: col.statuses }, ...(closed ? { updatedAt: { $gte: recent } } : {}) };
      const [items, total] = await Promise.all([
        Lead.find(query).sort({ createdAt: -1 }).limit(40).lean(),
        Lead.countDocuments(query),
      ]);
      return { ...col, total, items };
    }),
  );
  const names = await userNames(columns.flatMap((c) => c.items.map((l) => l.assignedTo)));
  return columns.map((c) => ({ key: c.key, title: c.title, total: c.total, items: c.items.map((l) => toRow(l, names, now)) }));
}

export async function getLeadDetail(id: string, now: Date) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const lead = await Lead.findById(id).lean();
  if (!lead) return null;

  const [customer, surveys, quotes, order] = await Promise.all([
    Customer.findById(lead.customerId).lean(),
    Survey.find({ leadId: lead._id }).sort({ createdAt: -1 }).lean(),
    Quote.find({ leadId: lead._id }).sort({ createdAt: -1 }).select("number version status totalPaise netCostPaise capacityKw systemType createdAt").lean(),
    lead.orderId ? Order.findById(lead.orderId).select("number status").lean() : Promise.resolve(null),
  ]);
  const names = await userNames([lead.assignedTo, lead.qualification?.qualifiedBy, ...surveys.map((s) => s.technicianId)]);

  return {
    lead: {
      ...toRow(lead, names, now),
      email: lead.email,
      requirement: lead.requirement,
      qualification: lead.qualification
        ? { ...lead.qualification, qualifiedByName: names.get(String(lead.qualification.qualifiedBy)) }
        : undefined,
      lostReason: lead.lostReason,
      firstContactedAt: lead.firstContactedAt,
      customerId: String(lead.customerId),
    },
    customer: customer
      ? {
          id: String(customer._id),
          name: customer.name,
          type: customer.type,
          address: customer.address,
          discom: customer.discom,
          consumerNumber: customer.consumerNumber,
        }
      : null,
    surveys: surveys.map((s) => ({
      id: String(s._id),
      number: s.number,
      status: s.status,
      scheduledFor: s.scheduledFor,
      technicianId: String(s.technicianId),
      technicianName: names.get(String(s.technicianId)) ?? "Technician",
      measurements: s.measurements,
      photos: s.photos,
      notes: s.notes,
      reviewNote: s.reviewNote,
      completedAt: s.completedAt,
    })),
    quotes: quotes.map((q) => ({
      id: String(q._id),
      number: q.number,
      version: q.version,
      status: q.status,
      totalPaise: q.totalPaise,
      netCostPaise: q.netCostPaise,
      capacityKw: q.capacityKw,
      systemType: q.systemType,
      createdAt: q.createdAt,
    })),
    order: order ? { id: String(order._id), number: order.number, status: order.status } : null,
    /** The quote gate: only after an approved site survey. */
    canQuote: lead.status === "survey_approved" || lead.status === "quoted",
  };
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

/** Salesperson with the fewest open leads (round-robin by workload). */
async function pickSalesOwner(session: ClientSession): Promise<Types.ObjectId | undefined> {
  const sales = await User.find({ role: "sales", active: true }).select("_id").session(session).lean();
  if (sales.length === 0) return undefined;
  const loads = await Lead.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { status: { $in: OPEN_STATUSES }, assignedTo: { $in: sales.map((s) => s._id) } } },
    { $group: { _id: "$assignedTo", n: { $sum: 1 } } },
  ]).session(session);
  const load = new Map(loads.map((l) => [String(l._id), l.n]));
  return [...sales].sort((a, b) => (load.get(String(a._id)) ?? 0) - (load.get(String(b._id)) ?? 0))[0]!._id;
}

export type CreateLeadResult = { leadId: string; number: string; duplicate: boolean };

/**
 * Record an enquiry. A repeat enquiry from the same phone within 30 days is
 * attached to the open lead instead of creating a duplicate.
 */
export async function createLead(
  input: EnquiryInput & { source: LeadSource },
  actor: (Actor & { role?: string }) | null,
): Promise<CreateLeadResult> {
  return withTransaction(async (session) => {
    const now = new Date();
    const { customer } = await upsertCustomerByPhone(
      {
        name: input.name,
        phone: input.phone,
        email: input.email,
        city: input.city,
        pincode: input.pincode,
        addressLine: input.addressLine,
        customerType: input.customerType,
      },
      session,
    );

    const open = await Lead.findOne({
      phone: input.phone,
      status: { $in: OPEN_STATUSES },
      createdAt: { $gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
    }).session(session);
    if (open) {
      open.lastActivityAt = now;
      await open.save({ session });
      await logActivity(
        {
          entityType: "lead",
          entityId: open._id,
          customerId: open.customerId,
          action: "enquired_again",
          message: `Customer enquired again via ${LEAD_SOURCE_LABELS[input.source]} (${input.capacityKw} kW)`,
          actor,
        },
        session,
      );
      return { leadId: String(open._id), number: open.number, duplicate: true };
    }

    const assignedTo =
      actor && actor.role === "sales" ? toObjectId(actor.id) : await pickSalesOwner(session);
    const number = await nextNumber("lead", session);
    const [lead] = await Lead.create(
      [
        {
          number,
          customerId: customer._id,
          name: input.name,
          phone: input.phone,
          email: input.email,
          city: input.city,
          source: input.source,
          requirement: {
            capacityKw: input.capacityKw,
            systemType: input.systemType,
            wantsSubsidy: input.wantsSubsidy,
            monthlyBillRs: input.monthlyBillRs,
            message: input.message,
          },
          status: "new",
          assignedTo,
          lastActivityAt: now,
        },
      ],
      { session },
    );
    await logActivity(
      {
        entityType: "lead",
        entityId: lead._id,
        customerId: customer._id,
        action: "lead_created",
        message: `Enquiry received via ${LEAD_SOURCE_LABELS[input.source]}: ${input.capacityKw} kW, ${REQUESTED_SYSTEM_TYPE_LABELS[input.systemType]}`,
        actor,
      },
      session,
    );
    return { leadId: String(lead._id), number, duplicate: false };
  });
}

type LeadDoc = InstanceType<typeof Lead>;

/** Load a lead inside a transaction or fail with a friendly 404. */
async function loadLead(id: string, session: ClientSession): Promise<LeadDoc> {
  const lead = Types.ObjectId.isValid(id) ? await Lead.findById(id).session(session) : null;
  if (!lead) throw notFoundError("Lead");
  return lead;
}

/** Move a lead along LEAD_FLOW and stamp first-response / activity times. */
function transition(lead: LeadDoc, to: LeadStatus, now: Date): LeadStatus {
  const from = lead.status;
  assertTransition("lead", LEAD_FLOW, from, to);
  lead.status = to;
  lead.lastActivityAt = now;
  if (!lead.firstContactedAt && to !== "new" && to !== "lost") lead.firstContactedAt = now;
  return from;
}

export type StatusChange = { from: LeadStatus; to: LeadStatus };

export async function markLeadContacted(leadId: string, actor: Actor): Promise<StatusChange> {
  return withTransaction(async (session) => {
    const now = new Date();
    const lead = await loadLead(leadId, session);
    const from = transition(lead, "contacted", now);
    await lead.save({ session });
    await logActivity(
      { entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "status_changed", message: "Customer contacted", actor },
      session,
    );
    return { from, to: "contacted" };
  });
}

export async function qualifyLead(input: QualifyLeadInput, actor: Actor): Promise<StatusChange> {
  return withTransaction(async (session) => {
    const now = new Date();
    const lead = await loadLead(input.leadId, session);
    const from = transition(lead, "qualified", now);
    lead.qualification = {
      roofAreaSqft: input.roofAreaSqft,
      shadowFreeAreaSqft: input.shadowFreeAreaSqft,
      monthlyBillRs: input.monthlyBillRs,
      sanctionedLoadKw: input.sanctionedLoadKw,
      gridSuitable: input.gridSuitable,
      roofType: input.roofType,
      notes: input.notes,
      qualifiedAt: now,
      qualifiedBy: toObjectId(actor.id),
    };
    await lead.save({ session });
    await logActivity(
      {
        entityType: "lead",
        entityId: lead._id,
        customerId: lead.customerId,
        action: "qualified",
        message: `Qualified: ${input.shadowFreeAreaSqft} sq ft shadow-free roof, ₹${input.monthlyBillRs.toLocaleString("en-IN")} monthly bill, grid ${input.gridSuitable ? "suitable" : "not suitable"}`,
        actor,
      },
      session,
    );
    return { from, to: "qualified" };
  });
}

export async function markLeadLost(leadId: string, reason: string, actor: Actor): Promise<StatusChange> {
  return withTransaction(async (session) => {
    const lead = await loadLead(leadId, session);
    const from = transition(lead, "lost", new Date());
    lead.lostReason = reason;
    await lead.save({ session });
    await logActivity(
      { entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "lost", message: `Marked lost: ${reason}`, actor },
      session,
    );
    return { from, to: "lost" };
  });
}

export async function reopenLead(leadId: string, actor: Actor): Promise<StatusChange> {
  return withTransaction(async (session) => {
    const lead = await loadLead(leadId, session);
    const from = transition(lead, "new", new Date());
    lead.lostReason = undefined;
    await lead.save({ session });
    await logActivity(
      { entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "reopened", message: "Lead reopened", actor },
      session,
    );
    return { from, to: "new" };
  });
}

export async function assignLead(leadId: string, userId: string, actor: Actor): Promise<void> {
  await withTransaction(async (session) => {
    const lead = await loadLead(leadId, session);
    const owner = Types.ObjectId.isValid(userId)
      ? await User.findOne({ _id: userId, active: true, role: { $in: ["sales", "admin"] } }).session(session).lean()
      : null;
    if (!owner) throw new AppError("VALIDATION", "Choose an active salesperson.", { userId: "Choose a salesperson" });
    lead.assignedTo = owner._id;
    lead.lastActivityAt = new Date();
    await lead.save({ session });
    await logActivity(
      { entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "assigned", message: `Assigned to ${owner.name}`, actor },
      session,
    );
  });
}

/** Book a site survey with a technician. Moves the lead to survey_scheduled. */
export async function scheduleSurvey(
  input: { leadId: string; technicianId: string; scheduledFor: string },
  actor: Actor,
): Promise<{ surveyId: string; number: string; from: LeadStatus }> {
  const when = fromISTInput(input.scheduledFor);
  if (Number.isNaN(when.getTime())) {
    throw new AppError("VALIDATION", "Pick a valid date and time.", { scheduledFor: "Pick a valid date and time" });
  }
  if (when.getTime() < Date.now() - HOUR_MS) {
    throw new AppError("VALIDATION", "The survey can't be scheduled in the past.", { scheduledFor: "Choose a future time" });
  }

  return withTransaction(async (session) => {
    const lead = await loadLead(input.leadId, session);
    const technician = Types.ObjectId.isValid(input.technicianId)
      ? await User.findOne({ _id: input.technicianId, role: "technician", active: true }).session(session).lean()
      : null;
    if (!technician) {
      throw new AppError("VALIDATION", "Choose an active technician.", { technicianId: "Choose a technician" });
    }

    const from = transition(lead, "survey_scheduled", new Date());
    const number = await nextNumber("survey", session);
    const [survey] = await Survey.create(
      [
        {
          number,
          leadId: lead._id,
          customerId: lead.customerId,
          technicianId: technician._id,
          scheduledFor: when,
          status: "scheduled",
        },
      ],
      { session },
    );
    lead.surveyId = survey._id;
    await lead.save({ session });

    const message = `Site survey ${number} booked with ${technician.name} for ${formatDateTime(when)}`;
    await logActivity({ entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "survey_scheduled", message, actor }, session);
    await logActivity({ entityType: "survey", entityId: survey._id, customerId: lead.customerId, action: "scheduled", message, actor }, session);
    return { surveyId: String(survey._id), number, from };
  });
}

/** For analytics/audit messages. */
export function describeStatus(status: LeadStatus): string {
  return humanize(status);
}
