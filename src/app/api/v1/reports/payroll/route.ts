/**
 * GET /api/v1/reports/payroll?month=YYYY-MM — technician hours and payout for
 * the month as CSV (director only).
 */
import { toDateInputValue } from "@/lib/format";
import { MonthSchema } from "@/lib/validation/finance";
import { trackServer } from "@/server/analytics";
import { apiHandler, requireApiUser } from "@/server/lib/api";
import { csvResponse, toCsv } from "@/server/lib/csv";
import { getPayroll } from "@/server/services/finance";

export const GET = apiHandler(async (request) => {
  const user = await requireApiUser(["admin"]);
  const param = new URL(request.url).searchParams.get("month");
  const month = MonthSchema.safeParse(param).success ? param! : toDateInputValue(new Date()).slice(0, 7);
  const payroll = await getPayroll(month);
  const csv = toCsv(
    ["Technician", "Phone", "Rate (Rs/h)", "Installation hours", "Service hours", "Total hours", "Jobs", "Payout (Rs)"],
    payroll.people.map((p) => [p.name, p.phone, p.ratePaise / 100, p.installHours, p.serviceHours, p.hours, p.jobs, p.payPaise / 100]),
  );
  trackServer("report_exported", { report: "payroll", rows: payroll.people.length }, user.id);
  return csvResponse(`sunpower-payroll-${month}.csv`, csv);
});
