/**
 * Catalog: the ten ready-made packages (with list price, subsidy and full
 * bill of materials) and every product with cost, price, margin, GST, HSN,
 * warranty and stock.
 */
import type { Metadata } from "next";
import { Package as PackageIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Section } from "@/components/shared/section";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, SYSTEM_TYPE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { getActiveCatalog, listPackagesWithPricing, listProducts } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Catalog" };

function warranty(months: number): string {
  if (!months) return "—";
  return months % 12 === 0 ? `${months / 12} yr` : `${months} mo`;
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["sales", "warehouse"]);
  const sp = await searchParams;
  const [packages, products, catalog] = await Promise.all([
    listPackagesWithPricing(),
    listProducts({ category: first(sp.category), q: first(sp.q) }),
    getActiveCatalog(),
  ]);
  const nameById = new Map(catalog.products.map((p) => [p.id, p.name]));
  const usedCategories = PRODUCT_CATEGORIES.filter((c) => catalog.products.some((p) => p.category === c));

  return (
    <>
      <PageHeader title="Catalog" description="Ready-made packages and every part, priced with GST and HSN codes." />

      <Section title="Packages" description="Picking one in the quote builder fills the complete bill of materials." className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {packages.map((pkg) => (
            <details key={pkg.id} className="group rounded-xl border border-border p-4 open:bg-secondary/40">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-foreground">{pkg.capacityKw} kW</span>
                  <Badge variant={pkg.systemType === "on_grid" ? "info" : "brand"}>{SYSTEM_TYPE_LABELS[pkg.systemType]}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{pkg.code}</p>
                <p className="mt-3 text-sm tabular-nums text-foreground">{formatINR(pkg.totalPaise)}</p>
                {pkg.subsidyPaise ? (
                  <p className="text-xs text-success-foreground">{formatINR(pkg.netCostPaise)} after subsidy</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No subsidy (off-grid)</p>
                )}
                <p className="mt-2 text-xs text-primary group-open:hidden">Show {pkg.lineCount} items</p>
              </summary>
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                {pkg.lines.map((l) => (
                  <li key={l.productId} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{nameById.get(l.productId) ?? "Item"}</span>
                    <span className="shrink-0 tabular-nums">×{l.qty}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Products" contentClassName="p-0">
        <div className="space-y-3 p-5 pb-0">
          <div className="w-full sm:w-80">
            <SearchInput placeholder="Search name, SKU or brand" />
          </div>
          <FilterTabs
            param="category"
            allLabel="All categories"
            options={usedCategories.map((c) => ({ value: c, label: PRODUCT_CATEGORY_LABELS[c] }))}
          />
        </div>
        {products.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={PackageIcon} title="No products match" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden text-right md:table-cell">Cost</TableHead>
                <TableHead className="hidden text-right md:table-cell">Margin</TableHead>
                <TableHead className="hidden text-right lg:table-cell">GST · HSN</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Warranty</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sku} · {p.brand} · {PRODUCT_CATEGORY_LABELS[p.category]}
                      {p.isSerialized ? " · serial tracked" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(p.pricePaise)}
                    <span className="text-xs text-muted-foreground"> /{p.unit === "kw" ? "kW" : p.unit}</span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{formatINR(p.costPaise)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{p.category === "service" ? "—" : `${p.marginPct}%`}</TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    {p.gstRate}% · <span className="font-mono text-xs">{p.hsn}</span>
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">{warranty(p.warrantyMonths)}</TableCell>
                  <TableCell className="text-right">
                    {p.category === "service" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span className="tabular-nums">{p.stockQty.toLocaleString("en-IN")}</span>
                        {p.lowStock ? <Badge variant="danger">Low</Badge> : null}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
