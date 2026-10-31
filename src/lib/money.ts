/**
 * Money helpers.
 *
 * All amounts are stored as INTEGER PAISE (₹1 = 100 paise) so totals never
 * suffer floating-point drift. Convert at the edges only: forms accept rupees,
 * the database stores paise, the UI formats paise in Indian (lakh) grouping.
 */

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}

const INR_WHOLE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_EXACT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_IN = new Intl.NumberFormat("en-IN");

/** formatINR(15000000) -> "₹1,50,000". Pass { exact: true } for paise precision (invoices). */
export function formatINR(paise: number | null | undefined, opts: { exact?: boolean } = {}): string {
  const value = (paise ?? 0) / 100;
  return (opts.exact ? INR_EXACT : INR_WHOLE).format(value);
}

/** Compact Indian notation for KPI tiles: ₹4.25 L, ₹1.2 Cr. */
export function formatINRCompact(paise: number | null | undefined): string {
  const rupees = (paise ?? 0) / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)} L`;
  return INR_WHOLE.format(rupees);
}

export function formatNumber(n: number | null | undefined): string {
  return NUMBER_IN.format(n ?? 0);
}

/** Percentage with one decimal, safe for divide-by-zero. */
export function formatPercent(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${((part / whole) * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "");
}
