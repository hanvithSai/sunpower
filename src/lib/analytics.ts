/**
 * The analytics contract (product/Analytics.md §6), shared by the browser and
 * the server: every event name mapped to its exact properties, so a typo or a
 * stray property fails the TypeScript check. Properties never carry customer
 * names, phones, emails, serials, notes or search text.
 *
 * `scrubUrl` keeps personal data out of every URL PostHog sees: share tokens
 * become `:token` and only known, harmless query parameters (filters, tabs,
 * page numbers, record ids) survive — `?q=` search text, `?serial=` and the
 * like are dropped.
 */
import type {
  AnalyticsEvent,
  InvoiceType,
  LeadSource,
  LeadStatus,
  PaymentMode,
  PaymentType,
  RequestedSystemType,
  ResolutionType,
  TicketCategory,
  WarrantyState,
} from "./constants";
import type { SearchResultType } from "./search";
import type { SurveyDecision } from "./validation/surveys";

type None = Record<string, never>;

export const SCAN_METHODS = ["camera", "manual"] as const;
export type ScanMethod = (typeof SCAN_METHODS)[number];

export type AnalyticsProps = {
  enquiry_submitted: { source: LeadSource; capacityKw: number; systemType: RequestedSystemType };
  lead_created: { source: LeadSource };
  lead_status_changed: { from: LeadStatus; to: LeadStatus };
  survey_scheduled: None;
  survey_completed: None;
  survey_reviewed: { decision: SurveyDecision };
  quote_created: { packageCode: string | null; capacityKw: number; totalRs: number };
  quote_sent: None;
  quote_accepted: None;
  payment_recorded: { type: PaymentType; mode: PaymentMode; amountRs: number };
  order_confirmed: None;
  grn_received: { lines: number; units: number; serials: number };
  serial_scanned: { method: ScanMethod };
  order_dispatched: { serials: number };
  order_delivered: { warrantiesStarted: number };
  job_started: None;
  job_completed: { durationHours: number; crew: number; serials: number; hasExtras: boolean };
  ticket_created: { warrantyState: WarrantyState; billable: boolean; category: TicketCategory };
  ticket_resolved: { resolutionType: ResolutionType; billable: boolean };
  ticket_closed: None;
  invoice_issued: { type: InvoiceType };
  share_link_created: { days: number };
  report_exported: { report: "profit" | "payroll" | "invoices" | "tickets"; rows: number };
  search_performed: { resultCount: number };
  search_result_opened: { type: SearchResultType };
  warranty_lookup: { by: "serial" | "phone"; found: boolean };
  certificate_shared: None;
};

/** Fired in the browser; everything else fires on the server after the change commits. */
export type ClientEvent = "search_performed" | "search_result_opened";
export type ServerEvent = Exclude<AnalyticsEvent, ClientEvent>;

/** Query parameters that only ever hold filters, tabs, page numbers or record ids. */
const SAFE_PARAMS = new Set([
  "status",
  "page",
  "type",
  "view",
  "tab",
  "range",
  "tech",
  "source",
  "month",
  "week",
  "category",
  "kw",
  "from",
  "new",
  "mine",
  "leadId",
  "customerId",
]);

/** Absolute or relative URL in, the same shape out with tokens masked and unknown parameters removed. */
export function scrubUrl(url: string): string {
  if (!url || !(url.startsWith("/") || /^https?:\/\//i.test(url))) return url;
  const absolute = /^https?:\/\//i.test(url);
  let parsed: URL;
  try {
    parsed = new URL(url, "http://scrub.local");
  } catch {
    return url;
  }
  parsed.pathname = parsed.pathname.replace(/^\/share\/[^/]+/, "/share/:token");
  for (const key of [...parsed.searchParams.keys()]) if (!SAFE_PARAMS.has(key)) parsed.searchParams.delete(key);
  parsed.hash = "";
  const path = `${parsed.pathname}${parsed.search}`;
  return absolute ? `${parsed.origin}${path}` : path;
}

/** Scrub every URL-looking string in an event's properties (current URL, pathname, referrer …). */
export function scrubProperties<T extends Record<string, unknown> | undefined>(props: T): T {
  if (!props) return props;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) out[key] = typeof value === "string" ? scrubUrl(value) : value;
  return out as T;
}
