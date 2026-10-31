/**
 * Domain vocabulary shared by the server and the browser.
 *
 * Every status, enum and label in SunPower OS lives here so that Mongoose
 * schemas, Zod validators, UI badges and the seed script all agree.
 * Keep this file free of server-only imports — client components use it.
 */

/* ------------------------------------------------------------------ */
/* Company                                                             */
/* ------------------------------------------------------------------ */

/** Seller details printed on quotes and tax invoices (placeholder GSTIN — see Human_Tasks.md). */
export const COMPANY = {
  name: "SunPower Solutions Pvt. Ltd.",
  shortName: "SunPower",
  gstin: "36AAKCS1234F1Z5",
  state: "Telangana",
  stateCode: "36",
  address: "Plot 42, HITEC City Road, Madhapur, Hyderabad, Telangana 500081",
  phone: "+91 40 4520 1200",
  /** Support WhatsApp (10 digits, for wa.me links). Placeholder until the real business number is set. */
  whatsapp: "9100045201",
  email: "hello@sunpower.example",
  website: "https://www.sunpowersolutions.me",
} as const;

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export const ROLES = ["admin", "sales", "technician", "warehouse", "support"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Director",
  sales: "Sales",
  technician: "Technician",
  warehouse: "Warehouse",
  support: "Support",
};

/* ------------------------------------------------------------------ */
/* CRM                                                                 */
/* ------------------------------------------------------------------ */

export const LEAD_SOURCES = ["website", "whatsapp", "phone", "walk_in", "referral", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website form",
  whatsapp: "WhatsApp",
  phone: "Phone call",
  walk_in: "Walk-in",
  referral: "Referral",
  other: "Other",
};

export const CUSTOMER_TYPES = ["residential", "commercial"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  residential: "Residential",
  commercial: "Commercial / factory",
};

export const DISCOMS = ["TSSPDCL", "TSNPDCL"] as const;
export type Discom = (typeof DISCOMS)[number];

export const SYSTEM_TYPES = ["on_grid", "off_grid"] as const;
export type SystemType = (typeof SYSTEM_TYPES)[number];
export const SYSTEM_TYPE_LABELS: Record<SystemType, string> = {
  on_grid: "On-Grid",
  off_grid: "Off-Grid",
};

/** What a homeowner can pick on the enquiry form (they may not know yet). */
export const REQUESTED_SYSTEM_TYPES = ["on_grid", "off_grid", "unsure"] as const;
export type RequestedSystemType = (typeof REQUESTED_SYSTEM_TYPES)[number];
export const REQUESTED_SYSTEM_TYPE_LABELS: Record<RequestedSystemType, string> = {
  on_grid: "On-Grid (with net metering)",
  off_grid: "Off-Grid (battery backup)",
  unsure: "Not sure — advise me",
};

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "survey_scheduled",
  "survey_completed",
  "survey_approved",
  "quoted",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** A lead must get its first call within this many hours (drives the SLA badge). */
export const LEAD_FIRST_RESPONSE_SLA_HOURS = 2;

export const SURVEY_STATUSES = ["scheduled", "completed", "approved", "rejected"] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

export const ROOF_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type RoofDirection = (typeof ROOF_DIRECTIONS)[number];
export const ROOF_DIRECTION_LABELS: Record<RoofDirection, string> = {
  N: "North",
  NE: "North-East",
  E: "East",
  SE: "South-East",
  S: "South (best)",
  SW: "South-West",
  W: "West",
  NW: "North-West",
};

export const ROOF_TYPES = ["rcc", "metal_sheet", "tile", "asbestos", "ground"] as const;
export type RoofType = (typeof ROOF_TYPES)[number];
export const ROOF_TYPE_LABELS: Record<RoofType, string> = {
  rcc: "RCC concrete",
  metal_sheet: "Metal sheet",
  tile: "Tiled",
  asbestos: "Asbestos",
  ground: "Ground mount",
};

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const PRODUCT_CATEGORIES = [
  "panel",
  "inverter",
  "battery",
  "charge_controller",
  "structure",
  "acdb",
  "dcdb",
  "cable",
  "connector",
  "earthing",
  "lightning_arrestor",
  "meter",
  "accessory",
  "service",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  panel: "Solar panel",
  inverter: "Inverter",
  battery: "Battery",
  charge_controller: "Charge controller",
  structure: "Mounting structure",
  acdb: "AC distribution box",
  dcdb: "DC distribution box",
  cable: "Cable",
  connector: "Connector",
  earthing: "Earthing kit",
  lightning_arrestor: "Lightning arrestor",
  meter: "Meter",
  accessory: "Accessory",
  service: "Service",
};

export const PRODUCT_UNITS = ["nos", "m", "set", "kit", "job", "kw"] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Days a quote stays valid after it is created. */
export const QUOTE_VALIDITY_DAYS = 15;

export const ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "ready_to_dispatch",
  "dispatched",
  "delivered",
  "installing",
  "commissioned",
  "closed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_MODES = ["upi", "bank_transfer", "cash", "cheque", "card"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer (NEFT/RTGS)",
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
};

export const PAYMENT_TYPES = ["advance", "balance", "full", "service"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  advance: "Advance",
  balance: "Balance",
  full: "Full payment",
  service: "Service charge",
};

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export const SERIAL_STATUSES = [
  "in_stock",
  "allocated",
  "dispatched",
  "installed",
  "faulty",
  "replaced",
  "returned",
] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];

export const STOCK_MOVE_TYPES = ["purchase", "dispatch", "return", "adjustment", "service_issue"] as const;
export type StockMoveType = (typeof STOCK_MOVE_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Field operations                                                    */
/* ------------------------------------------------------------------ */

export const JOB_TYPES = ["installation", "service"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Installation checklist items the crew ticks on the roof. */
export const INSTALL_CHECKLIST = [
  { key: "mounting", label: "Mounting structure fixed" },
  { key: "panels", label: "Panels laid and clamped" },
  { key: "wiring", label: "DC/AC wiring and boxes connected" },
  { key: "earthing", label: "Earthing and lightning arrestor done" },
  { key: "inverter", label: "Inverter mounted and configured" },
  { key: "testing", label: "Generation tested" },
] as const;
export type InstallChecklistKey = (typeof INSTALL_CHECKLIST)[number]["key"];

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

/** A ticket closes only after the customer confirms the fix (BR-06). */
export const TICKET_STATUSES = ["open", "assigned", "in_progress", "resolved", "customer_confirmed", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** How the customer confirmed the fix. */
export const CONFIRMATION_CHANNELS = ["call", "whatsapp", "on_site"] as const;
export type ConfirmationChannel = (typeof CONFIRMATION_CHANNELS)[number];
export const CONFIRMATION_CHANNEL_LABELS: Record<ConfirmationChannel, string> = {
  call: "Phone call",
  whatsapp: "WhatsApp",
  on_site: "On site",
};

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Resolution SLA per priority, in hours. */
export const TICKET_SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
};

export const TICKET_CATEGORIES = [
  "no_power",
  "fault_code",
  "low_generation",
  "physical_damage",
  "battery",
  "wiring_earthing",
  "structure",
  "billing",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  no_power: "No power / system down",
  fault_code: "Inverter fault code",
  low_generation: "Low generation",
  physical_damage: "Physical damage",
  battery: "Battery issue",
  wiring_earthing: "Wiring / earthing",
  structure: "Structure / roof leak",
  billing: "Billing / net meter",
  other: "Other",
};

export const TICKET_CHANNELS = ["phone", "whatsapp", "email", "walk_in", "portal"] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];
export const TICKET_CHANNEL_LABELS: Record<TicketChannel, string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  email: "Email",
  walk_in: "Walk-in",
  portal: "Warranty portal",
};

export const RESOLUTION_TYPES = ["repair", "replacement", "no_fault", "advice"] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];
export const RESOLUTION_TYPE_LABELS: Record<ResolutionType, string> = {
  repair: "Repaired on site",
  replacement: "Unit replaced",
  no_fault: "No fault found",
  advice: "Resolved over phone",
};

/** `no_serial` = no SunPower installation to cover it (nothing to claim against). */
export const WARRANTY_STATES = ["in_warranty", "out_of_warranty", "no_serial"] as const;
export type WarrantyState = (typeof WARRANTY_STATES)[number];

/**
 * What the warranty decision rests on (BR-04): the serial's own warranty, or —
 * for faults with no serial (wiring, earthing, structure) — our workmanship
 * warranty from commissioning.
 */
export const WARRANTY_BASES = ["serial", "workmanship", "none"] as const;
export type WarrantyBasis = (typeof WARRANTY_BASES)[number];

/** Labour rate billed on out-of-warranty service visits (₹ per hour). */
export const SERVICE_LABOUR_RATE_RS = 600;
/** SAC for maintenance and repair services, billed at 18% GST. */
export const SERVICE_SAC = "998719";
export const SERVICE_GST_RATE = 18;

/* ------------------------------------------------------------------ */
/* Finance                                                             */
/* ------------------------------------------------------------------ */

export const INVOICE_TYPES = ["sale", "service"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = ["issued", "partially_paid", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** PM Surya Ghar subsidy application stages (residential on-grid only). */
export const SUBSIDY_STATUSES = [
  "not_applicable",
  "not_applied",
  "applied",
  "feasibility_approved",
  "net_meter_installed",
  "inspected",
  "disbursed",
  "rejected",
] as const;
export type SubsidyStatus = (typeof SUBSIDY_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Status badges                                                       */
/* ------------------------------------------------------------------ */

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "brand";
type Meta = { label: string; tone: Tone };

/** Human label + colour tone for every status, used by <StatusBadge kind status />. */
export const STATUS_META = {
  lead: {
    new: { label: "New", tone: "info" },
    contacted: { label: "Contacted", tone: "neutral" },
    qualified: { label: "Qualified", tone: "brand" },
    survey_scheduled: { label: "Survey scheduled", tone: "info" },
    survey_completed: { label: "Survey done", tone: "warning" },
    survey_approved: { label: "Survey approved", tone: "success" },
    quoted: { label: "Quoted", tone: "brand" },
    won: { label: "Won", tone: "success" },
    lost: { label: "Lost", tone: "danger" },
  },
  survey: {
    scheduled: { label: "Scheduled", tone: "info" },
    completed: { label: "Awaiting review", tone: "warning" },
    approved: { label: "Approved", tone: "success" },
    rejected: { label: "Rejected", tone: "danger" },
  },
  quote: {
    draft: { label: "Draft", tone: "neutral" },
    sent: { label: "Sent", tone: "info" },
    accepted: { label: "Accepted", tone: "success" },
    rejected: { label: "Rejected", tone: "danger" },
    expired: { label: "Expired", tone: "neutral" },
  },
  order: {
    pending_payment: { label: "Awaiting payment", tone: "warning" },
    confirmed: { label: "Confirmed", tone: "info" },
    ready_to_dispatch: { label: "Packed", tone: "brand" },
    dispatched: { label: "In transit", tone: "info" },
    delivered: { label: "Delivered", tone: "success" },
    installing: { label: "Installing", tone: "warning" },
    commissioned: { label: "Commissioned", tone: "success" },
    closed: { label: "Closed", tone: "neutral" },
    cancelled: { label: "Cancelled", tone: "danger" },
  },
  payment: {
    unpaid: { label: "Unpaid", tone: "danger" },
    partial: { label: "Advance paid", tone: "warning" },
    paid: { label: "Paid", tone: "success" },
  },
  serial: {
    in_stock: { label: "In stock", tone: "success" },
    allocated: { label: "Allocated", tone: "brand" },
    dispatched: { label: "In transit", tone: "info" },
    installed: { label: "Installed", tone: "neutral" },
    faulty: { label: "Faulty", tone: "danger" },
    replaced: { label: "Replaced", tone: "warning" },
    returned: { label: "Returned", tone: "neutral" },
  },
  job: {
    scheduled: { label: "Scheduled", tone: "info" },
    in_progress: { label: "In progress", tone: "warning" },
    completed: { label: "Completed", tone: "success" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
  ticket: {
    open: { label: "Open", tone: "danger" },
    assigned: { label: "Assigned", tone: "info" },
    in_progress: { label: "In progress", tone: "warning" },
    resolved: { label: "Awaiting confirmation", tone: "brand" },
    customer_confirmed: { label: "Customer confirmed", tone: "success" },
    closed: { label: "Closed", tone: "success" },
  },
  invoice: {
    issued: { label: "Unpaid", tone: "info" },
    partially_paid: { label: "Part paid", tone: "warning" },
    paid: { label: "Paid", tone: "success" },
    void: { label: "Void", tone: "neutral" },
  },
  subsidy: {
    not_applicable: { label: "Not eligible", tone: "neutral" },
    not_applied: { label: "Not applied", tone: "neutral" },
    applied: { label: "Applied", tone: "info" },
    feasibility_approved: { label: "Feasibility OK", tone: "info" },
    net_meter_installed: { label: "Net meter installed", tone: "brand" },
    inspected: { label: "Inspected", tone: "warning" },
    disbursed: { label: "Disbursed", tone: "success" },
    rejected: { label: "Rejected", tone: "danger" },
  },
  warranty: {
    in_warranty: { label: "In warranty", tone: "success" },
    out_of_warranty: { label: "Out of warranty", tone: "danger" },
    no_serial: { label: "Not covered", tone: "neutral" },
    not_started: { label: "Not started", tone: "neutral" },
  },
  priority: {
    low: { label: "Low", tone: "neutral" },
    medium: { label: "Medium", tone: "info" },
    high: { label: "High", tone: "warning" },
    urgent: { label: "Urgent", tone: "danger" },
  },
} as const satisfies Record<string, Record<string, Meta>>;

export type StatusKind = keyof typeof STATUS_META;

/** Label + tone for a status; unknown values degrade gracefully to a neutral badge. */
export function statusMeta(kind: StatusKind, status: string): Meta {
  const table = STATUS_META[kind] as Record<string, Meta>;
  return table[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" };
}

/** Turn a label map into `<option>` data: options(PAYMENT_MODE_LABELS). */
export function options<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

/** PostHog event names (documented in product/Analytics.md). */
export const ANALYTICS_EVENTS = [
  "enquiry_submitted",
  "lead_created",
  "lead_status_changed",
  "survey_scheduled",
  "survey_completed",
  "survey_reviewed",
  "quote_created",
  "quote_sent",
  "quote_accepted",
  "payment_recorded",
  "order_confirmed",
  "grn_received",
  "serial_scanned",
  "order_dispatched",
  "order_delivered",
  "job_started",
  "job_completed",
  "ticket_created",
  "ticket_resolved",
  "ticket_closed",
  "invoice_issued",
  "share_link_created",
  "report_exported",
  "search_performed",
  "search_result_opened",
  "warranty_lookup",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
