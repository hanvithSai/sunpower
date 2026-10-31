"use server";
/**
 * Lead Server Actions for the sales pipeline. Thin wrappers:
 * validate (Zod) → service (business rules) → revalidate → analytics.
 */
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import {
  AssignLeadSchema,
  LeadIdSchema,
  ManualLeadSchema,
  MarkLeadLostSchema,
  QualifyLeadSchema,
  ScheduleSurveySchema,
} from "@/lib/validation/leads";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm } from "../lib/validate";
import {
  assignLead,
  createLead,
  markLeadContacted,
  markLeadLost,
  qualifyLead,
  reopenLead,
  scheduleSurvey,
  type StatusChange,
} from "../services/leads";

/** Support also logs enquiries that come in on the service line. */
const LEAD_ROLES = ["sales", "support"] as const;

function refresh(leadId?: string) {
  revalidatePath("/leads");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

function trackStatus(change: StatusChange, userId: string) {
  trackServer("lead_status_changed", { from: change.from, to: change.to }, userId);
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(LEAD_ROLES, async (user) => {
    const input = parseForm(ManualLeadSchema, formData);
    const result = await createLead(input, user);
    refresh(result.leadId);
    if (!result.duplicate) trackServer("lead_created", { source: input.source }, user.id);
    return {
      ok: true,
      message: result.duplicate
        ? `This customer already has an open enquiry (${result.number}). We added a note to it.`
        : `Enquiry ${result.number} created`,
      data: { leadId: result.leadId },
    };
  });
}

export async function markContactedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(LEAD_ROLES, async (user) => {
    const { leadId } = parseForm(LeadIdSchema, formData);
    trackStatus(await markLeadContacted(leadId, user), user.id);
    refresh(leadId);
    return { ok: true, message: "Marked as contacted" };
  });
}

export async function qualifyLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const input = parseForm(QualifyLeadSchema, formData);
    trackStatus(await qualifyLead(input, user), user.id);
    refresh(input.leadId);
    return { ok: true, message: "Lead qualified — book the site survey next" };
  });
}

export async function markLeadLostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(LEAD_ROLES, async (user) => {
    const { leadId, reason } = parseForm(MarkLeadLostSchema, formData);
    trackStatus(await markLeadLost(leadId, reason, user), user.id);
    refresh(leadId);
    return { ok: true, message: "Lead marked as lost" };
  });
}

export async function reopenLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const { leadId } = parseForm(LeadIdSchema, formData);
    trackStatus(await reopenLead(leadId, user), user.id);
    refresh(leadId);
    return { ok: true, message: "Lead reopened" };
  });
}

export async function assignLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const { leadId, userId } = parseForm(AssignLeadSchema, formData);
    await assignLead(leadId, userId, user);
    refresh(leadId);
    return { ok: true, message: "Owner updated" };
  });
}

export async function scheduleSurveyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const input = parseForm(ScheduleSurveySchema, formData);
    const result = await scheduleSurvey(input, user);
    refresh(input.leadId);
    revalidatePath("/surveys");
    revalidatePath("/my-work");
    trackStatus({ from: result.from, to: "survey_scheduled" }, user.id);
    trackServer("survey_scheduled", {}, user.id);
    return { ok: true, message: `Survey ${result.number} booked`, data: { surveyId: result.surveyId } };
  });
}
