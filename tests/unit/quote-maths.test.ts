/**
 * The money rules behind every quote and invoice: GST per line with an exact
 * CGST/SGST split, the PM Surya Ghar subsidy slabs, quote totals from a
 * package BOM, and Indian (lakh) formatting. All amounts are integer paise.
 */
import { describe, expect, it } from "vitest";
import { formatINR, formatINRCompact, formatPercent, toPaise } from "@/lib/money";
import { computeLine, gstBreakup, summarize } from "@/lib/gst";
import { expandPackage, lineFromProduct, quoteTotals, type CatalogProduct } from "@/lib/quote-calc";
import { estimateSubsidyRs, isSubsidyEligible } from "@/lib/subsidy";

describe("GST", () => {
  it("taxes a line at its own rate and rounds to the paisa", () => {
    expect(computeLine({ qty: 6, unitPricePaise: 1_450_000, gstRate: 5 })).toEqual({
      taxablePaise: 8_700_000,
      gstPaise: 435_000,
      totalPaise: 9_135_000,
    });
    // 333 × 18% = 59.94 → 60 paise
    expect(computeLine({ qty: 1, unitPricePaise: 333, gstRate: 18 }).gstPaise).toBe(60);
  });

  it("splits intra-state tax into CGST + SGST that add back to the exact GST", () => {
    const tax = summarize([
      { qty: 1, unitPricePaise: 101, gstRate: 5 }, // 5.05 → 5 paise
      { qty: 1, unitPricePaise: 1_000, gstRate: 18 }, // 180 paise
    ]);
    expect(tax.gstPaise).toBe(185);
    expect(tax.cgstPaise + tax.sgstPaise).toBe(185);
    expect(Math.abs(tax.cgstPaise - tax.sgstPaise)).toBeLessThanOrEqual(1);
    expect(tax.igstPaise).toBe(0);
    expect(tax.totalPaise).toBe(1_101 + 185);
  });

  it("charges IGST alone to an out-of-state buyer", () => {
    const tax = summarize([{ qty: 2, unitPricePaise: 50_000, gstRate: 18 }], { interState: true });
    expect(tax).toMatchObject({ cgstPaise: 0, sgstPaise: 0, igstPaise: 18_000, gstPaise: 18_000 });
  });

  it("groups the invoice footer by rate, lowest first", () => {
    const breakup = gstBreakup([
      { qty: 1, unitPricePaise: 10_000, gstRate: 18 },
      { qty: 2, unitPricePaise: 10_000, gstRate: 5 },
      { qty: 1, unitPricePaise: 5_000, gstRate: 18 },
    ]);
    expect(breakup).toEqual([
      { rate: 5, taxablePaise: 20_000, gstPaise: 1_000 },
      { rate: 18, taxablePaise: 15_000, gstPaise: 2_700 },
    ]);
  });
});

describe("PM Surya Ghar subsidy", () => {
  it("pays ₹30,000/kW for the first 2 kW and ₹18,000 for the third, capped at ₹78,000", () => {
    expect(estimateSubsidyRs(1, "on_grid")).toBe(30_000);
    expect(estimateSubsidyRs(2, "on_grid")).toBe(60_000);
    expect(estimateSubsidyRs(2.5, "on_grid")).toBe(69_000);
    expect(estimateSubsidyRs(3, "on_grid")).toBe(78_000);
    expect(estimateSubsidyRs(5, "on_grid")).toBe(78_000);
  });

  it("is only for residential on-grid systems", () => {
    expect(isSubsidyEligible("on_grid", "residential")).toBe(true);
    expect(estimateSubsidyRs(3, "off_grid")).toBe(0);
    expect(estimateSubsidyRs(3, "panel_set")).toBe(0);
    expect(estimateSubsidyRs(3, "on_grid", "commercial")).toBe(0);
    expect(estimateSubsidyRs(0, "on_grid")).toBe(0);
  });
});

const product = (p: Partial<CatalogProduct> & Pick<CatalogProduct, "id" | "category" | "pricePaise" | "costPaise" | "gstRate">): CatalogProduct => ({
  sku: p.id.toUpperCase(),
  name: p.id,
  unit: "nos",
  hsn: "8541",
  isSerialized: false,
  warrantyMonths: 0,
  ...p,
});

const PANEL = product({ id: "panel", category: "panel", pricePaise: 1_450_000, costPaise: 1_150_000, gstRate: 5, isSerialized: true, warrantyMonths: 240 });
const INVERTER = product({ id: "inverter", category: "inverter", pricePaise: 4_200_000, costPaise: 3_300_000, gstRate: 5, isSerialized: true, warrantyMonths: 24 });
const INSTALL = product({ id: "install", category: "service", pricePaise: 1_500_000, costPaise: 0, gstRate: 18, warrantyMonths: 60 });
const CATALOG = new Map([PANEL, INVERTER, INSTALL].map((p) => [p.id, p]));

describe("quote totals from a package", () => {
  it("expands the BOM, skipping unknown products and zero quantities", () => {
    const lines = expandPackage(
      [
        { productId: "panel", qty: 6 },
        { productId: "inverter", qty: 1 },
        { productId: "retired", qty: 1 },
        { productId: "install", qty: 0 },
      ],
      CATALOG,
    );
    expect(lines.map((l) => [l.sku, l.qty])).toEqual([
      ["PANEL", 6],
      ["INVERTER", 1],
    ]);
    expect(lines[0]).toMatchObject({ unitPricePaise: 1_450_000, unitCostPaise: 1_150_000, warrantyMonths: 240 });
  });

  it("adds GST per line, takes off the subsidy and keeps the margin internal", () => {
    const lines = [lineFromProduct(PANEL, 6), lineFromProduct(INVERTER, 1), lineFromProduct(INSTALL, 1)];
    const totals = quoteTotals(lines, { capacityKw: 3, systemType: "on_grid", customerType: "residential", wantsSubsidy: true });
    // 87,000 + 42,000 + 15,000 taxable; GST 4,350 + 2,100 + 2,700
    expect(totals.taxablePaise).toBe(14_400_000);
    expect(totals.gstPaise).toBe(915_000);
    expect(totals.totalPaise).toBe(15_315_000);
    expect(totals.subsidyPaise).toBe(7_800_000);
    expect(totals.netCostPaise).toBe(15_315_000 - 7_800_000);
    expect(totals.costPaise).toBe(6 * 1_150_000 + 3_300_000);
    expect(totals.marginPaise).toBe(14_400_000 - 10_200_000);
  });

  it("shows no subsidy when the customer doesn't want it or isn't eligible", () => {
    const lines = [lineFromProduct(PANEL, 4)];
    expect(quoteTotals(lines, { capacityKw: 2, systemType: "on_grid", customerType: "residential", wantsSubsidy: false }).subsidyPaise).toBe(0);
    expect(quoteTotals(lines, { capacityKw: 2, systemType: "off_grid", customerType: "residential", wantsSubsidy: true }).subsidyPaise).toBe(0);
  });

  it("honours a negotiated unit price", () => {
    expect(quoteTotals([lineFromProduct(PANEL, 2, 1_400_000)], { capacityKw: 1, systemType: "panel_set", customerType: "residential", wantsSubsidy: false }).taxablePaise).toBe(2_800_000);
  });
});

describe("money", () => {
  it("stores rupees as whole paise", () => {
    expect(toPaise(1499.99)).toBe(149_999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });

  it("formats in Indian lakh grouping", () => {
    expect(formatINR(15_000_000)).toBe("₹1,50,000");
    expect(formatINR(12_345_678, { exact: true })).toBe("₹1,23,456.78");
    expect(formatINR(null)).toBe("₹0");
  });

  it("shortens KPI tiles to lakh and crore", () => {
    expect(formatINRCompact(42_500_000)).toBe("₹4.25 L");
    expect(formatINRCompact(1_200_000_000)).toBe("₹1.2 Cr");
    expect(formatINRCompact(-30_000_000)).toBe("-₹3 L");
    expect(formatINRCompact(9_900_000)).toBe("₹99,000");
  });

  it("guards percentages against a zero base", () => {
    expect(formatPercent(1, 8)).toBe("12.5%");
    expect(formatPercent(1, 4)).toBe("25%");
    expect(formatPercent(5, 0)).toBe("0%");
  });
});
