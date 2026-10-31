/**
 * Catalog reads: priced packages for the quote builder and landing page, and
 * the product list (with stock and margin) for the catalog screen.
 */
import { PRODUCT_CATEGORIES, type ProductCategory, type SystemType } from "@/lib/constants";
import { escapeRegex } from "@/lib/format";
import { expandPackage, quoteTotals, type CatalogProduct } from "@/lib/quote-calc";
import { connectDB } from "../db";
import { Package, Product, SerialUnit, type IProduct } from "../models";

export type PackageOption = {
  id: string;
  code: string;
  name: string;
  systemType: SystemType;
  capacityKw: number;
  description: string;
  lines: { productId: string; qty: number }[];
};

function toCatalogProduct(p: IProduct): CatalogProduct {
  return {
    id: String(p._id),
    sku: p.sku,
    name: p.name,
    category: p.category,
    unit: p.unit,
    pricePaise: p.pricePaise,
    costPaise: p.costPaise,
    gstRate: p.gstRate,
    hsn: p.hsn,
    isSerialized: p.isSerialized,
    warrantyMonths: p.warrantyMonths,
  };
}

/** Everything the quote builder needs, as plain serialisable data. */
export async function getActiveCatalog(): Promise<{ products: CatalogProduct[]; packages: PackageOption[] }> {
  await connectDB();
  const [products, packages] = await Promise.all([
    Product.find({ active: true }).sort({ category: 1, name: 1 }).lean(),
    Package.find({ active: true }).sort({ systemType: -1, capacityKw: 1 }).lean(),
  ]);
  return {
    products: products.map(toCatalogProduct),
    packages: packages.map((pkg) => ({
      id: String(pkg._id),
      code: pkg.code,
      name: pkg.name,
      systemType: pkg.systemType,
      capacityKw: pkg.capacityKw,
      description: pkg.description,
      lines: pkg.lines.map((l) => ({ productId: String(l.productId), qty: l.qty })),
    })),
  };
}

export type PricedPackage = PackageOption & {
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
  subsidyPaise: number;
  netCostPaise: number;
  lineCount: number;
};

/** Packages with list prices (residential, subsidy where eligible). */
export async function listPackagesWithPricing(): Promise<PricedPackage[]> {
  const { products, packages } = await getActiveCatalog();
  const byId = new Map(products.map((p) => [p.id, p]));
  return packages.map((pkg) => {
    const lines = expandPackage(pkg.lines, byId);
    const totals = quoteTotals(lines, {
      capacityKw: pkg.capacityKw,
      systemType: pkg.systemType,
      customerType: "residential",
      wantsSubsidy: true,
    });
    return { ...pkg, ...totals, lineCount: lines.length };
  });
}

export type ProductRow = CatalogProduct & {
  brand: string;
  specs: Record<string, string | number>;
  stockQty: number;
  allocated: number;
  reorderLevel: number;
  lowStock: boolean;
  marginPct: number;
};

export async function listProducts(filter: { category?: string; q?: string } = {}): Promise<ProductRow[]> {
  await connectDB();
  const query: Record<string, unknown> = { active: true };
  if (filter.category && (PRODUCT_CATEGORIES as readonly string[]).includes(filter.category)) {
    query.category = filter.category as ProductCategory;
  }
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ name: rx }, { sku: rx }, { brand: rx }];
  }
  const [products, allocated] = await Promise.all([
    Product.find(query).sort({ category: 1, name: 1 }).lean(),
    SerialUnit.aggregate<{ _id: unknown; n: number }>([{ $match: { status: "allocated" } }, { $group: { _id: "$productId", n: { $sum: 1 } } }]),
  ]);
  const allocatedBy = new Map(allocated.map((a) => [String(a._id), a.n]));
  return products.map((p) => ({
    ...toCatalogProduct(p),
    brand: p.brand,
    specs: p.specs ?? {},
    stockQty: p.stockQty,
    allocated: allocatedBy.get(String(p._id)) ?? 0,
    reorderLevel: p.reorderLevel,
    lowStock: p.category !== "service" && p.stockQty <= p.reorderLevel,
    marginPct: p.pricePaise > 0 ? Math.round(((p.pricePaise - p.costPaise) / p.pricePaise) * 1000) / 10 : 0,
  }));
}
