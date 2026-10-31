/**
 * GET /api/v1/reports/invoices?status=open|overdue|paid&type=sale|service —
 * the invoice register as CSV for the accountant (director, sales, support).
 * Same filters as /invoices; amounts in rupees with the GST split.
 */
import { toDateInputValue } from "@/lib/format";
import { trackServer } from "@/server/analytics";
import { apiHandler, requireApiUser } from "@/server/lib/api";
import { csvResponse, toCsv } from "@/server/lib/csv";
import { exportInvoices } from "@/server/services/finance";

const rs = (paise: number) => Math.round(paise) / 100;

export const GET = apiHandler(async (request) => {
  const user = await requireApiUser(["sales", "support"]);
  const url = new URL(request.url);
  const now = new Date();
  const rows = await exportInvoices({ status: url.searchParams.get("status") ?? undefined, type: url.searchParams.get("type") ?? undefined }, now);
  const csv = toCsv(
    ["Invoice", "Type", "Date", "Due", "Customer", "Customer GSTIN", "Taxable (Rs)", "CGST (Rs)", "SGST (Rs)", "Total (Rs)", "Paid (Rs)", "Due (Rs)", "Status", "Overdue"],
    rows.map((r) => [r.number, r.type, r.issuedAt, r.dueAt, r.customer, r.gstin, rs(r.taxablePaise), rs(r.cgstPaise), rs(r.sgstPaise), rs(r.totalPaise), rs(r.paidPaise), rs(r.totalPaise - r.paidPaise), r.status, r.overdue ? "yes" : "no"]),
  );
  trackServer("report_exported", { report: "invoices", rows: rows.length }, user.id);
  return csvResponse(`sunpower-invoices-${toDateInputValue(now)}.csv`, csv);
});
