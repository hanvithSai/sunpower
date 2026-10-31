/**
 * Catalog: the ready-made packages (each opens a dialog with its price
 * breakdown and full bill of materials) and every product with cost, price, margin, GST, HSN,
 * warranty and stock.
 */
import type { Metadata } from "next";
import { Package as PackageIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Section } from "@/components/shared/section";
import { PackageDialog } from "@/components/modules/quotes/package-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from "@/lib/constants";
import { expandPackage } from "@/lib/quote-calc";
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
  const user = await requireUser(["sales", "warehouse"]);
  const sp = await searchParams;
  const [packages, products, catalog] = await Promise.all([
    listPackagesWithPricing(),
    listProducts({ category: first(sp.category), q: first(sp.q) }),
    getActiveCatalog(),
  ]);
  const productById = new Map(catalog.products.map((p) => [p.id, p]));
  const usedCategories = PRODUCT_CATEGORIES.filter((c) => catalog.products.some((p) => p.category === c));

  return (
    <>
      <PageHeader title="Catalog" description="Ready-made packages and every part, priced with GST and HSN codes." />

      <Section
        title="Packages"
        description="Open a package to see its price breakdown and full bill of materials. Picking one in the quote builder fills the same list. Installation is the service line on every system and can be added to a Panel Set."
        className="mb-6"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {packages.map((pkg) => (
            <PackageDialog
              key={pkg.id}
              canQuote={user.role === "sales" || user.role === "admin"}
              pkg={{
                id: pkg.id,
                code: pkg.code,
                name: pkg.name,
                description: pkg.description,
                systemType: pkg.systemType,
                capacityKw: pkg.capacityKw,
                taxablePaise: pkg.taxablePaise,
                gstPaise: pkg.gstPaise,
                totalPaise: pkg.totalPaise,
                subsidyPaise: pkg.subsidyPaise,
                netCostPaise: pkg.netCostPaise,
                lines: expandPackage(pkg.lines, productById).map((l) => ({
                  productId: l.productId,
                  name: l.name,
                  qty: l.qty,
                  unit: l.unit,
                  unitPricePaise: l.unitPricePaise,
                  gstRate: l.gstRate,
                  isSerialized: l.isSerialized,
                })),
              }}
            />
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
