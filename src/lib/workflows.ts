/**
 * State machines for every record that moves through a lifecycle.
 *
 * The services call `assertTransition` (src/server/errors.ts) before changing a
 * status, so illegal jumps — e.g. quoting before the survey is approved — are
 * rejected in one place instead of being re-checked in every screen.
 * The UI uses `canTransition` to decide which action buttons to show.
 */
import type {
  JobStatus,
  LeadStatus,
  OrderStatus,
  QuoteStatus,
  SubsidyStatus,
  SurveyStatus,
  TicketStatus,
} from "./constants";

export type Flow<S extends string> = Readonly<Record<S, readonly S[]>>;

export const LEAD_FLOW: Flow<LeadStatus> = {
  new: ["contacted", "qualified", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["survey_scheduled", "lost"],
  survey_scheduled: ["survey_completed", "lost"],
  // A rejected survey sends the lead back for a re-survey.
  survey_completed: ["survey_approved", "survey_scheduled", "lost"],
  survey_approved: ["quoted", "lost"],
  quoted: ["quoted", "won", "lost"],
  won: [],
  lost: ["new"],
};

export const SURVEY_FLOW: Flow<SurveyStatus> = {
  scheduled: ["completed", "scheduled"],
  completed: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export const QUOTE_FLOW: Flow<QuoteStatus> = {
  draft: ["sent", "accepted", "rejected"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

export const ORDER_FLOW: Flow<OrderStatus> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["ready_to_dispatch", "cancelled"],
  ready_to_dispatch: ["dispatched", "confirmed"],
  dispatched: ["delivered"],
  delivered: ["installing", "commissioned"],
  installing: ["commissioned"],
  commissioned: ["closed"],
  closed: [],
  cancelled: [],
};

export const JOB_FLOW: Flow<JobStatus> = {
  scheduled: ["in_progress", "cancelled", "scheduled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export const TICKET_FLOW: Flow<TicketStatus> = {
  open: ["assigned", "in_progress", "resolved"],
  assigned: ["in_progress", "open", "resolved"],
  in_progress: ["resolved"],
  // Customer says it still does not work -> back to in_progress.
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
};

export const SUBSIDY_FLOW: Flow<SubsidyStatus> = {
  not_applicable: [],
  not_applied: ["applied"],
  applied: ["feasibility_approved", "rejected"],
  feasibility_approved: ["net_meter_installed", "rejected"],
  net_meter_installed: ["inspected", "rejected"],
  inspected: ["disbursed", "rejected"],
  disbursed: [],
  rejected: ["applied"],
};

/** The happy path, used for progress steppers in the UI. */
export const SUBSIDY_STEPS: SubsidyStatus[] = [
  "not_applied",
  "applied",
  "feasibility_approved",
  "net_meter_installed",
  "inspected",
  "disbursed",
];

export const ORDER_STEPS: OrderStatus[] = [
  "pending_payment",
  "confirmed",
  "ready_to_dispatch",
  "dispatched",
  "delivered",
  "installing",
  "commissioned",
  "closed",
];

export function canTransition<S extends string>(flow: Flow<S>, from: S, to: S): boolean {
  return flow[from]?.includes(to) ?? false;
}
