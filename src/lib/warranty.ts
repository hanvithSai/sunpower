/**
 * Warranty clock helpers.
 *
 * A serial number's warranty starts automatically on delivery and runs for the
 * product's `warrantyMonths` (inverter/battery 24, panels 240). Support uses
 * `getWarrantyInfo` to answer "is this still covered?" in one glance.
 */

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 Jan + 1 month should be 28/29 Feb, not 3 Mar.
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

export type WarrantyInfo = {
  state: "in_warranty" | "out_of_warranty" | "not_started";
  daysLeft: number;
  endsAt: Date | null;
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getWarrantyInfo(
  startAt: Date | string | null | undefined,
  endAt: Date | string | null | undefined,
  now: Date = new Date(),
): WarrantyInfo {
  if (!startAt || !endAt) {
    return { state: "not_started", daysLeft: 0, endsAt: null, label: "Warranty not started" };
  }
  const end = new Date(endAt);
  const days = Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
  if (days >= 0) {
    return { state: "in_warranty", daysLeft: days, endsAt: end, label: `In warranty · ${formatSpan(days)} left` };
  }
  return { state: "out_of_warranty", daysLeft: days, endsAt: end, label: `Expired ${formatSpan(-days)} ago` };
}

/**
 * Workmanship warranty (BR-04): faults with no serial — wiring, earthing,
 * structure, leaks — are covered for the months sold with the installation
 * service line, counted from commissioning. Nothing before commissioning.
 */
export function workmanshipEnd(order: {
  lines: { category: string; warrantyMonths: number }[];
  commissionedAt?: Date | null;
}): Date | undefined {
  if (!order.commissionedAt) return undefined;
  const months = Math.max(0, ...order.lines.filter((l) => l.category === "service").map((l) => l.warrantyMonths));
  return months > 0 ? addMonths(order.commissionedAt, months) : undefined;
}

/** 500 -> "1 yr 4 mo", 20 -> "20 days". */
export function formatSpan(days: number): string {
  if (days < 45) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${months} mo`;
  return rest ? `${years} yr ${rest} mo` : `${years} yr`;
}
