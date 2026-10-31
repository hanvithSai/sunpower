/**
 * GET /api/v1/reports/tickets?status=open_all|<status>&tech=<id> — service
 * tickets as CSV (director, support). Defaults to everything not yet closed,
 * with age in days, SLA breach, warranty basis and who is on it.
 */
import { toDateInputValue } from "@/lib/format";
import { trackServer } from "@/server/analytics";
import { apiHandler, requireApiUser } from "@/server/lib/api";
import { csvResponse, toCsv } from "@/server/lib/csv";
import { exportTickets } from "@/server/services/tickets";

export const GET = apiHandler(async (request) => {
  const user = await requireApiUser(["support"]);
  const url = new URL(request.url);
  const now = new Date();
  const rows = await exportTickets({ status: url.searchParams.get("status") ?? undefined, assignedTo: url.searchParams.get("tech") ?? undefined }, now);
  const csv = toCsv(
    ["Ticket", "Raised", "Age (days)", "Status", "Priority", "Category", "Customer", "City", "Serial", "Product", "Warranty", "Basis", "Billable", "Technician", "Past SLA"],
    rows.map((r) => [r.number, r.createdAt, r.ageDays, r.status, r.priority, r.category, r.customer, r.city, r.serial, r.product, r.warranty, r.basis, r.billable ? "yes" : "no", r.technician, r.overdue ? "yes" : "no"]),
  );
  trackServer("report_exported", { report: "tickets", rows: rows.length }, user.id);
  return csvResponse(`sunpower-tickets-${toDateInputValue(now)}.csv`, csv);
});
