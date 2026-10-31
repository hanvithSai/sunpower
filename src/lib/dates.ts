/**
 * IST-aware date ranges for dashboards ("today / this week / this month").
 * Servers run in UTC, so we shift by +05:30 before truncating to a day.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RangeKey = "today" | "week" | "month";
export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
};

/** Start of the IST calendar day containing `date`, as a UTC Date. */
export function startOfDayIST(date: Date): Date {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** Inclusive start / exclusive end for a dashboard range. Weeks start on Monday. */
export function getRange(range: RangeKey, now: Date): { start: Date; end: Date } {
  const todayStart = startOfDayIST(now);
  if (range === "today") return { start: todayStart, end: new Date(todayStart.getTime() + DAY_MS) };
  if (range === "week") {
    const istDay = new Date(todayStart.getTime() + IST_OFFSET_MS).getUTCDay(); // 0 = Sunday
    const sinceMonday = (istDay + 6) % 7;
    const start = new Date(todayStart.getTime() - sinceMonday * DAY_MS);
    return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
  }
  const shifted = new Date(todayStart.getTime() + IST_OFFSET_MS);
  const monthStartShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  const nextMonthShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1);
  return {
    start: new Date(monthStartShifted - IST_OFFSET_MS),
    end: new Date(nextMonthShifted - IST_OFFSET_MS),
  };
}

/** The same-length window immediately before `range`, for "vs last period" deltas. */
export function getPreviousRange(range: RangeKey, now: Date): { start: Date; end: Date } {
  const current = getRange(range, now);
  if (range === "month") {
    const prevAnchor = new Date(current.start.getTime() - DAY_MS);
    return getRange("month", prevAnchor);
  }
  const span = current.end.getTime() - current.start.getTime();
  return { start: new Date(current.start.getTime() - span), end: current.start };
}

/** Indian financial year label for a date: 31 Oct 2026 -> "26-27". */
export function financialYear(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const startYear = shifted.getUTCMonth() >= 3 ? year : year - 1; // April = month 3
  return `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
