/**
 * Display formatting for dates, phones and text — always in Indian conventions.
 * Dates render in Asia/Kolkata even though Vercel servers run in UTC.
 */

export const TIME_ZONE = "Asia/Kolkata";

type DateLike = Date | string | number | null | undefined;

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});

const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});

const RELATIVE_FMT = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "31 Oct 2026" */
export function formatDate(value: DateLike): string {
  const d = toDate(value);
  return d ? DATE_FMT.format(d) : "—";
}

/** "31 Oct 2026, 2:30 pm" */
export function formatDateTime(value: DateLike): string {
  const d = toDate(value);
  return d ? DATE_TIME_FMT.format(d) : "—";
}

/** "2:30 pm" */
export function formatTime(value: DateLike): string {
  const d = toDate(value);
  return d ? TIME_FMT.format(d) : "—";
}

/** "5 minutes ago", "in 2 days" */
export function formatRelative(value: DateLike, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return "—";
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return RELATIVE_FMT.format(diffSec, "second");
  if (abs < 3600) return RELATIVE_FMT.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RELATIVE_FMT.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return RELATIVE_FMT.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return RELATIVE_FMT.format(Math.round(diffSec / (86400 * 30)), "month");
  return RELATIVE_FMT.format(Math.round(diffSec / (86400 * 365)), "year");
}

/** `YYYY-MM-DD` in IST, for <input type="date"> default values. */
export function toDateInputValue(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/** `YYYY-MM-DDTHH:mm` in IST, for <input type="datetime-local"> default values. */
export function toDateTimeInputValue(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

/** Parse a `datetime-local` / `date` value typed in IST into a real Date. */
export function fromISTInput(value: string): Date {
  const hasTime = value.includes("T");
  return new Date(`${hasTime ? value : `${value}T00:00`}:00+05:30`);
}

/** Strip +91, leading 0, spaces and dashes -> 10-digit mobile number. */
export function normalizePhone(input: string): string {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** "9848012345" -> "+91 98480 12345" */
export function formatPhone(phone: string | null | undefined): string {
  const p = normalizePhone(phone ?? "");
  if (p.length !== 10) return phone ?? "—";
  return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
}

/** WhatsApp click-to-chat deep link (free, no Business API needed). */
export function waLink(phone: string, text?: string): string {
  const p = normalizePhone(phone);
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/91${p}${query}`;
}

export function telLink(phone: string): string {
  return `tel:+91${normalizePhone(phone)}`;
}

export function formatKw(kw: number | null | undefined): string {
  if (kw === null || kw === undefined) return "—";
  return `${Number.isInteger(kw) ? kw : kw.toFixed(1)} kW`;
}

/** "survey_scheduled" -> "Survey scheduled" */
export function humanize(value: string): string {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** "Lakshmi Narayana" -> "L. N****": shared views and the public warranty page never show full names. */
export function maskName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  if (!first) return "—";
  return rest.length ? `${first[0]}. ${rest.at(-1)![0]}****` : `${first[0]}****`;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
