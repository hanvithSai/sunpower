/**
 * Stock: on hand, reserved for packed-but-not-dispatched orders, available,
 * and value at cost (serialized units at their own GRN cost). Low-stock rows
 * are flagged against each product's reorder level.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, IndianRupee, PackageCheck, PackagePlus, ScanBarcode } from "lucide-react";
import { InventoryNav } from "@/components/modules/inventory/inventory-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/constants";
import { formatINR, formatINRCompact, formatNumber } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listStock, type StockView } from "@/server/services/inventory";

export const metadata: Metadata = { title: "Inventory" };

const VIEWS: StockView[] = ["all", "low", "serialized"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser(["warehouse"]);
  const sp = await searchParams;
  const view = (VIEWS as string[]).includes(first(sp.view) ?? "") ? (first(sp.view) as StockView) : "all";
  const data = await listStock({ q: first(sp.q), view });
  const canReceive = user.role === "warehouse" || user.role === "admin";

  return (
    <>
      <PageHeader
        title="Inventory"
        description="What is on the shelf, what is promised to orders, and what it is worth."
        actions={
          canReceive ? (
            <Button asChild>
              <Link href="/inventory/purchases/new">
                <PackagePlus aria-hidden="true" />
                Receive goods
              </Link>
            </Button>
          ) : null
        }
      />
      <InventoryNav active="stock" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stock value at cost" value={formatINRCompact(data.totals.valuePaise)} hint={formatINR(data.totals.valuePaise)} icon={IndianRupee} tone="brand" />
        <StatCard
          label="Low stock"
          value={data.totals.lowCount}
          hint="At or below the reorder level"
          icon={AlertTriangle}
          tone={data.totals.lowCount > 0 ? "warning" : "success"}
          href="/inventory?view=low"
        />
        <StatCard label="Serial-tracked units" value={formatNumber(data.totals.serialUnits)} hint="Panels, inverters, batteries, controllers" icon={ScanBarcode} tone="info" href="/inventory/serials" />
        <StatCard label="Reserved for orders" value={formatNumber(data.totals.reservedUnits)} hint="Confirmed, not yet dispatched" icon={PackageCheck} tone="neutral" href="/dispatch" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          param="view"
          allLabel="All items"
          options={[
            { value: "low", label: "Low stock", count: data.totals.lowCount },
            { value: "serialized", label: "Serial-tracked" },
          ]}
        />
        <div className="w-full sm:w-72">
          <SearchInput placeholder="Search name, SKU or brand" />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={Boxes} title={view === "low" ? "Nothing is running low" : "No products match"} description="Stock arrives through goods receipts." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Reserved</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="hidden text-right md:table-cell">Reorder at</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono">{p.sku}</span>
                      <span>{PRODUCT_CATEGORY_LABELS[p.category]}</span>
                      {p.isSerialized ? <Badge variant="info">Serial</Badge> : null}
                    </p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(p.onHand)} <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{p.reserved ? formatNumber(p.reserved) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={p.low ? "font-semibold text-warning-foreground" : ""}>{formatNumber(p.available)}</span>
                    {p.low ? (
                      <p className="text-xs text-warning-foreground">{p.available < 0 ? "Short for orders" : "Reorder"}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{formatNumber(p.reorderLevel)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatINR(p.valuePaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
