/**
 * Orders: one per installation, from payment through commissioning.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDER_STATUSES, statusMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listOrders } from "@/server/services/orders";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["sales", "warehouse"]);
  const sp = await searchParams;
  const data = await listOrders({ status: first(sp.status), q: first(sp.q), page: Number(first(sp.page)) || 1 });

  return (
    <>
      <PageHeader title="Orders" description="Accepted quotes become orders. The first payment confirms them and books the crew." />
      <div className="mb-4 w-full sm:w-80">
        <SearchInput placeholder="Search customer, phone, city or SP-O-…" />
      </div>
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={ORDER_STATUSES.map((s) => ({ value: s, label: statusMeta("order", s).label, count: data.counts[s] ?? 0 }))}
        />
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No orders here" description="Orders appear when a customer accepts a quote." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden md:table-cell">System</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="font-medium text-foreground hover:text-primary">
                        {o.customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{o.number}</span> · {o.city}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{o.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(o.totalPaise)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge kind="payment" status={o.paymentStatus} />
                      {o.paymentStatus !== "paid" && o.paidPaise > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatINR(o.paidPaise)} received</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="order" status={o.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right lg:table-cell">{formatDate(o.createdAt)}</TableCell>
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
