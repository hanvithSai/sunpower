/**
 * Goods receipts (GRNs) for the serialized catalog, so the warehouse has real
 * units to scan at dispatch. Serialized stock can only enter through a GRN,
 * and each unit carries its own purchase cost (batches differ slightly) so job
 * costing uses what that exact unit cost.
 *
 * Serials are deterministic (re-runs skip GRNs whose supplier invoice already
 * exists), and look like the labels on real boxes, e.g. WAA545-2609-0001.
 */

export type GrnSeed = {
  supplierName: string;
  supplierGstin: string;
  invoiceNo: string;
  /** Days before today the goods arrived (the invoice is dated a day earlier). */
  daysAgo: number;
  lines: { sku: string; qty: number; unitCostRs: number; serialPrefix: string }[];
};

export const GRNS: GrnSeed[] = [
  {
    supplierName: "Waaree Energies Ltd",
    supplierGstin: "24AAACW4537N1ZD",
    invoiceNo: "WEL/26-27/08812",
    daysAgo: 24,
    lines: [
      { sku: "PNL-WAA-545", qty: 40, unitCostRs: 11_950, serialPrefix: "WAA545-2609" },
      { sku: "PNL-VKR-545", qty: 12, unitCostRs: 11_900, serialPrefix: "VKR545-2609" },
    ],
  },
  {
    supplierName: "Sri Venkateswara Solar Distributors",
    supplierGstin: "36ABCFS7214K1Z8",
    invoiceNo: "SVSD/1427",
    daysAgo: 18,
    lines: [
      { sku: "INV-GRW-1K", qty: 3, unitCostRs: 14_300, serialPrefix: "GRW1K-2609" },
      { sku: "INV-GRW-2K", qty: 4, unitCostRs: 18_800, serialPrefix: "GRW2K-2609" },
      { sku: "INV-GRW-3K", qty: 6, unitCostRs: 23_200, serialPrefix: "GRW3K-2609" },
      { sku: "INV-SGR-4K", qty: 3, unitCostRs: 30_700, serialPrefix: "SG4K-2609" },
      { sku: "INV-SGR-5K", qty: 3, unitCostRs: 35_200, serialPrefix: "SG5K-2609" },
      { sku: "CC-MPPT-40", qty: 6, unitCostRs: 6_700, serialPrefix: "LUMCC40-2609" },
      { sku: "CC-MPPT-60", qty: 4, unitCostRs: 9_700, serialPrefix: "LUMCC60-2609" },
    ],
  },
  {
    supplierName: "Deccan Power Batteries & Inverters",
    supplierGstin: "36AAJFD3381M1Z2",
    invoiceNo: "DPBI/26/0619",
    daysAgo: 12,
    lines: [
      { sku: "PCU-LUM-1K", qty: 2, unitCostRs: 9_700, serialPrefix: "LUMNXG-2610" },
      { sku: "PCU-UTL-2K", qty: 2, unitCostRs: 16_900, serialPrefix: "UTLG2-2610" },
      { sku: "PCU-UTL-3K", qty: 2, unitCostRs: 25_800, serialPrefix: "UTLG35-2610" },
      { sku: "PCU-LUM-5K", qty: 2, unitCostRs: 41_600, serialPrefix: "LUMSVP5-2610" },
      { sku: "BAT-EXD-150", qty: 12, unitCostRs: 12_100, serialPrefix: "EXD150-2610" },
      { sku: "BAT-LUM-200", qty: 10, unitCostRs: 15_700, serialPrefix: "LUM200-2610" },
    ],
  },
  {
    // A newer, slightly dearer batch: costing must use each unit's own cost.
    supplierName: "Waaree Energies Ltd",
    supplierGstin: "24AAACW4537N1ZD",
    invoiceNo: "WEL/26-27/09377",
    daysAgo: 4,
    lines: [
      { sku: "PNL-WAA-545", qty: 30, unitCostRs: 12_150, serialPrefix: "WAA545-2610" },
      { sku: "PNL-TPS-540", qty: 24, unitCostRs: 12_250, serialPrefix: "TPS540-2610" },
      { sku: "PNL-ADN-550", qty: 12, unitCostRs: 12_750, serialPrefix: "ADN550-2610" },
      { sku: "INV-GRW-3K", qty: 4, unitCostRs: 23_600, serialPrefix: "GRW3K-2610" },
    ],
  },
];

export function grnSerials(prefix: string, qty: number): string[] {
  return Array.from({ length: qty }, (_, i) => `${prefix}-${String(i + 1).padStart(4, "0")}`);
}
