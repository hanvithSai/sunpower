/**
 * Quote maths, pure and shared: the quote builder runs it live in the browser
 * and the server runs it again when saving (client prices are never trusted
 * blindly). A package template expands into priced lines — panels, inverter,
 * stands, boxes, cables, connectors, earthing — so nobody has to remember the
 * small parts.
 */
import type { CustomerType, ProductCategory, ProductUnit, SystemType } from "./constants";
import { summarize } from "./gst";
import { estimateSubsidyPaise } from "./subsidy";

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  pricePaise: number;
  costPaise: number;
  gstRate: number;
  hsn: string;
  isSerialized: boolean;
  warrantyMonths: number;
};

export type QuoteLine = {
  productId: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  qty: number;
  unitPricePaise: number;
  unitCostPaise: number;
  gstRate: number;
  hsn: string;
  isSerialized: boolean;
  warrantyMonths: number;
};

export function lineFromProduct(product: CatalogProduct, qty: number, unitPricePaise = product.pricePaise): QuoteLine {
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    unit: product.unit,
    qty,
    unitPricePaise,
    unitCostPaise: product.costPaise,
    gstRate: product.gstRate,
    hsn: product.hsn,
    isSerialized: product.isSerialized,
    warrantyMonths: product.warrantyMonths,
  };
}

/** Package BOM → priced lines (unknown or inactive products are skipped). */
export function expandPackage(lines: { productId: string; qty: number }[], productsById: Map<string, CatalogProduct>): QuoteLine[] {
  return lines.flatMap((line) => {
    const product = productsById.get(line.productId);
    return product && line.qty > 0 ? [lineFromProduct(product, line.qty)] : [];
  });
}

export type QuoteTotals = {
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
  /** Estimated PM Surya Ghar subsidy, paid to the customer by the government. */
  subsidyPaise: number;
  /** What the customer effectively pays after the subsidy. */
  netCostPaise: number;
  /** Internal only: material cost and gross margin before labour. */
  costPaise: number;
  marginPaise: number;
};

export function quoteTotals(
  lines: QuoteLine[],
  opts: { capacityKw: number; systemType: SystemType; customerType: CustomerType; wantsSubsidy: boolean },
): QuoteTotals {
  const tax = summarize(lines.map((l) => ({ qty: l.qty, unitPricePaise: l.unitPricePaise, gstRate: l.gstRate })));
  const subsidyPaise = opts.wantsSubsidy ? estimateSubsidyPaise(opts.capacityKw, opts.systemType, opts.customerType) : 0;
  const costPaise = lines.reduce((sum, l) => sum + Math.round(l.qty * l.unitCostPaise), 0);
  return {
    taxablePaise: tax.taxablePaise,
    gstPaise: tax.gstPaise,
    totalPaise: tax.totalPaise,
    subsidyPaise,
    netCostPaise: tax.totalPaise - subsidyPaise,
    costPaise,
    marginPaise: tax.taxablePaise - costPaise,
  };
}

/**
 * The parts every package must carry, from the brief: a Panel Set is panels,
 * connectors and wires; On-Grid adds the inverter, wiring boxes, charge
 * controller, earthing, stands, lightning protection, the net meter and the
 * installation line; Off-Grid swaps the net meter for a battery bank.
 */
export const REQUIRED_COMPONENTS: Record<SystemType, ProductCategory[]> = {
  on_grid: ["panel", "inverter", "charge_controller", "structure", "acdb", "dcdb", "cable", "connector", "earthing", "lightning_arrestor", "meter", "service"],
  off_grid: ["panel", "inverter", "charge_controller", "battery", "structure", "acdb", "dcdb", "cable", "connector", "earthing", "lightning_arrestor", "service"],
  panel_set: ["panel", "connector", "cable"],
};

/** Categories a quote of this type should have but doesn't (warn before sending, R-24). */
export function missingComponents(systemType: SystemType, lines: Pick<QuoteLine, "category" | "qty">[]): ProductCategory[] {
  const present = new Set(lines.filter((l) => l.qty > 0).map((l) => l.category));
  return REQUIRED_COMPONENTS[systemType].filter((c) => !present.has(c));
}
