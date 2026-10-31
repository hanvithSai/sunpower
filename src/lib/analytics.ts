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

const PHONE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;

/**
 * Session replay runs every recorded text and attribute through this, so a
 * phone number, email or GSTIN never reaches PostHog wherever it appears on a
 * page (tables, cards, `tel:` and `wa.me` links).
 */
export function maskContactText(text: string): string {
  return text.replace(PHONE, "•••••").replace(EMAIL, "•••@•••").replace(GSTIN, "•••");
}

/**
 * Calls to action we measure (clicks ÷ views of the page = CTR). Autocapture
 * runs fully masked — no element text, no attributes, so no `tel:` or `wa.me`
 * link with a phone number — and the only label that survives is the
 * `data-ph-capture-attribute-cta` this adds. Works on server components.
 */
export const CTAS = [
  "hero_get_quote",
  "hero_check_warranty",
  "estimator_get_quote",
  "systems_on_grid",
  "systems_off_grid",
  "systems_panel_set",
  "band_check_warranty",
  "platform_staff_sign_in",
  "closing_get_quote",
  "nav_get_quote",
  "nav_warranty",
  "nav_staff_login",
  "footer_call",
  "footer_get_quote",
  "footer_warranty",
  "footer_staff_login",
  "enquiry_submit",
  "warranty_submit",
  "warranty_call",
  "warranty_whatsapp",
  "certificate_whatsapp",
] as const;
export type Cta = (typeof CTAS)[number];

export function cta(name: Cta): { "data-ph-capture-attribute-cta": Cta } {
  return { "data-ph-capture-attribute-cta": name };
}

/** Heatmap batches are keyed by the raw page URL; scrub the keys like every other URL. */
export function scrubHeatmapData(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const out: Record<string, unknown[]> = {};
  for (const [url, points] of Object.entries(data as Record<string, unknown>)) {
    const key = scrubUrl(url);
    out[key] = [...(out[key] ?? []), ...(Array.isArray(points) ? points : [])];
  }
  return out;
}

/** Payloads scrubbed separately (replay frames, heatmap pages) or too large to walk. */
const SCRUB_SEPARATELY = new Set(["$snapshot_data", "$heatmap_data"]);

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubUrl(value);
  if (depth >= 4 || !value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) out[key] = scrubValue(v, depth + 1);
  return out;
}

/**
 * Scrub every URL-looking string in an event's properties (current URL,
 * pathname, referrer …), including nested ones such as the page URL inside
 * each web-vitals metric (`$web_vitals_LCP_event.$current_url`).
 */
export function scrubProperties<T extends Record<string, unknown> | undefined>(props: T): T {
  if (!props) return props;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) out[key] = SCRUB_SEPARATELY.has(key) ? value : scrubValue(value, 0);
  return out as T;
}
