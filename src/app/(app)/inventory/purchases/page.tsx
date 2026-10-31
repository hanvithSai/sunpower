/**
 * Goods receipts (GRNs): every supplier delivery, its value at cost and how
 * many serials it registered.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { PackagePlus, Truck } from "lucide-react";
import { InventoryNav } from "@/components/modules/inventory/inventory-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatINR, formatNumber } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listPurchases } from "@/server/services/inventory";

export const metadata: Metadata = { title: "Goods receipts" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["warehouse"]);
  const sp = await searchParams;
  const data = await listPurchases({ page: Number(first(sp.page)) || 1 });

  const receiveButton = (
    <Button asChild>
      <Link href="/inventory/purchases/new">
        <PackagePlus aria-hidden="true" />
        Receive goods
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader title="Inventory" description="Stock enters only through goods receipts. Serial numbers are registered here." actions={receiveButton} />
      <InventoryNav active="purchases" />

      {data.items.length === 0 ? (
        <EmptyState icon={Truck} title="No goods received yet" description="Receive a supplier delivery to put panels, inverters and batteries into stock." action={receiveButton} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="hidden md:table-cell">Supplier invoice</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Serials</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/inventory/purchases/${p.id}`} className="font-medium text-foreground hover:text-primary">
                        {p.supplier}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{p.number}</span> · {formatDate(p.receivedAt)} · {p.receivedBy}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="font-mono text-xs">{p.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.invoiceDate)}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.units)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{p.serialCount ? formatNumber(p.serialCount) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(p.totalPaise)}</TableCell>
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
