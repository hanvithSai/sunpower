/**
 * All quotes with their status. New quotes start from a lead whose survey is
 * approved, so there's no "blank quote" button here.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QUOTE_STATUSES, statusMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listQuotes } from "@/server/services/quotes";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["sales"]);
  const sp = await searchParams;
  const now = new Date();
  const data = await listQuotes({ status: first(sp.status), q: first(sp.q), page: Number(first(sp.page)) || 1 });

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Every quote is built from a package template after an approved site survey."
        actions={
          <Button asChild variant="outline">
            <Link href="/leads?view=table&status=survey_approved">Leads ready to quote</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <SearchInput placeholder="Search customer, city or SP-Q-…" />
        </div>
      </div>
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={QUOTE_STATUSES.map((s) => ({ value: s, label: statusMeta("quote", s).label, count: data.counts[s] ?? 0 }))}
        />
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={FileText} title="No quotes here" description="Create a quote from a lead once its site survey is approved." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead className="hidden md:table-cell">System</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">After subsidy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Valid until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((q) => {
                  const expired = (q.status === "sent" || q.status === "draft") && new Date(q.validUntil) < now;
                  return (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link href={`/quotes/${q.id}`} className="font-medium text-foreground hover:text-primary">
                          {q.customerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{q.number}</span> v{q.version} · {q.city}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{q.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(q.totalPaise)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatINR(q.netCostPaise)}</TableCell>
                      <TableCell>
                        {expired ? <StatusBadge kind="quote" status="expired" /> : <StatusBadge kind="quote" status={q.status} />}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-right sm:table-cell">{formatDate(q.validUntil)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} />
        </div>
      )}
    </>
  );
}
