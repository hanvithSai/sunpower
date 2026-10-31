/**
 * GST tax invoices: sale invoices (issued automatically at dispatch) and
 * service invoices (issued automatically for out-of-warranty repairs), with
 * what is still due and what is overdue.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download, IndianRupee, ReceiptIndianRupee } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listInvoices } from "@/server/services/finance";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["sales", "support"]);
  const sp = await searchParams;
  const now = new Date();
  // The export follows the filters on screen.
  const csvQuery = new URLSearchParams(Object.entries({ status: first(sp.status), type: first(sp.type) }).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  const data = await listInvoices({ status: first(sp.status), type: first(sp.type), q: first(sp.q), page: Number(first(sp.page)) || 1 }, now);

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Issued automatically: sale invoices at dispatch, service invoices when an out-of-warranty repair is resolved."
        actions={
          <Button asChild variant="outline">
            <a href={`/api/v1/reports/invoices?${csvQuery}`} download>
              <Download aria-hidden="true" />
              CSV for the accountant
            </a>
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Due from customers" value={formatINRCompact(data.outstanding.duePaise)} hint={`${data.outstanding.count} unpaid invoice${data.outstanding.count === 1 ? "" : "s"}`} icon={IndianRupee} tone="warning" href="/invoices?status=open" />
        <StatCard label="Overdue" value={data.outstanding.overdue} hint="Past the due date" icon={AlertTriangle} tone={data.outstanding.overdue ? "danger" : "success"} href="/invoices?status=overdue" />
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          param="status"
          options={[
            { value: "open", label: "Unpaid" },
            { value: "overdue", label: "Overdue" },
            { value: "paid", label: "Paid" },
          ]}
        />
        <div className="w-full lg:w-80">
          <SearchInput placeholder="INV/26-27/…, customer or phone" />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={ReceiptIndianRupee} title="No invoices here" description="The first sale invoice is issued when an order is dispatched." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link href={`/invoices/${i.id}`} className="font-medium text-foreground hover:text-primary">
                        {i.customer}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{i.number}</span> · {formatDate(i.issuedAt)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={i.type === "sale" ? "info" : "brand"}>{i.type === "sale" ? "Sale" : "Service"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(i.totalPaise)}</TableCell>
                    <TableCell className={`hidden text-right tabular-nums md:table-cell ${i.overdue ? "font-medium text-danger-foreground" : ""}`}>
                      {i.totalPaise - i.paidPaise > 0 ? formatINR(i.totalPaise - i.paidPaise) : "—"}
                      {i.overdue ? <p className="text-xs">since {formatDate(i.dueAt)}</p> : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="invoice" status={i.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} />
        </div>
      )}
    </>
  );
}
