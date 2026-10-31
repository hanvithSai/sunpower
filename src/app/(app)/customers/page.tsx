/**
 * Every customer, found by name, city or any part of their mobile number,
 * with how much they've bought, what is still due and any open repair.
 * One click opens the customer's whole history (/customers/[id]).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Contact } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatPhone } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listCustomers } from "@/server/services/customers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["sales", "support"]);
  const sp = await searchParams;
  const data = await listCustomers({ q: first(sp.q), type: first(sp.type), page: Number(first(sp.page)) || 1 });

  return (
    <>
      <PageHeader title="Customers" description="One record per mobile number: every enquiry, order, serial, ticket and invoice in one place." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          param="type"
          options={[
            { value: "residential", label: "Homes" },
            { value: "commercial", label: "Businesses" },
          ]}
        />
        <div className="w-full lg:w-80">
          <SearchInput placeholder="Name, city or last 4 digits of mobile" />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={Contact} title="No customers found" description="Every enquiry creates a customer, keyed by mobile number." />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {data.total} customer{data.total === 1 ? "" : "s"}
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Systems</TableHead>
                  <TableHead className="hidden sm:table-cell">Latest order</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Open tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium text-foreground hover:text-primary">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(c.phone)} · {c.city}
                        {c.type === "commercial" ? " · Business" : ""}
                      </p>
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {c.orders ? `${c.orders} · ${c.kw} kW` : <span className="text-muted-foreground">Enquiry since {formatDate(c.since)}</span>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{c.lastOrderStatus ? <StatusBadge kind="order" status={c.lastOrderStatus} /> : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums ${c.duePaise > 0 ? "font-medium text-warning-foreground" : "text-muted-foreground"}`}>
                      {c.duePaise > 0 ? formatINR(c.duePaise) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">{c.openTickets ? <Badge variant="warning">{c.openTickets}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
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
