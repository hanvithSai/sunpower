/**
 * GET /api/v1/reports/profit?range=today|week|month|all — profit per
 * installation as CSV (revenue, material, labour, site extras, warranty
 * repairs, profit, margin). The director downloads it signed in; a valid
 * share link (?token=…) downloads the same numbers with customer names masked.
 */
import { getRange, type RangeKey } from "@/lib/dates";
import { apiHandler, requireApiUser } from "@/server/lib/api";
import { csvResponse, toCsv } from "@/server/lib/csv";
import { AppError } from "@/server/errors";
import { getProfitTable } from "@/server/services/dashboard";
import { openShareLink } from "@/server/services/finance";

const RANGES = ["today", "week", "month", "all"] as const;
const rs = (paise: number) => Math.round(paise) / 100;

export const GET = apiHandler(async (request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const now = new Date();
  let masked = false;
  if (token) {
    const link = await openShareLink(token, now);
    if (!link.ok) throw new AppError("FORBIDDEN", "This share link is no longer valid.");
    masked = true;
  } else {
    await requireApiUser(["admin"]);
  }
  const param = url.searchParams.get("range") ?? "month";
  const range = (RANGES as readonly string[]).includes(param) ? (param as (typeof RANGES)[number]) : "month";
  const period = range === "all" ? {} : getRange(range as RangeKey, now);
  const rows = await getProfitTable({ ...period, masked, limit: 1000 });

  const csv = toCsv(
    ["Order", "Customer", "City", "kW", "System", "Commissioned", "Revenue (Rs, excl GST)", "Material (Rs)", "Labour (Rs)", "Labour hours", "Site extras (Rs)", "Warranty repairs (Rs)", "Profit (Rs)", "Margin %", "Material estimated"],
    rows.map((r) => [r.number, r.customer, r.city, r.capacityKw, r.systemType, r.commissionedAt, rs(r.revenuePaise), rs(r.materialPaise), rs(r.labourPaise), r.labourHours, rs(r.sitePaise), rs(r.warrantyPaise), rs(r.profitPaise), r.marginPct, r.estimated ? "yes" : "no"]),
  );
  return csvResponse(`sunpower-profit-${range}-${now.toISOString().slice(0, 10)}.csv`, csv);
});
