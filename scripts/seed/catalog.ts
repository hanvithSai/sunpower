/**
 * SunPower's catalog: real Indian brands, 2026 INR cost/price, HSN codes and
 * GST (solar equipment 5% after GST 2.0; batteries, electricals and the
 * installation service 18%), plus the ten ready-made packages from the brief —
 * 1–5 kW On-Grid and Off-Grid — each with its complete bill of materials.
 * Warranties follow the brief: panels 20 years, inverters/batteries/charge
 * controllers 2 years.
 */
import type { ProductCategory, ProductUnit, SystemType } from "@/lib/constants";

export type ProductSeed = {
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  unit: ProductUnit;
  isSerialized: boolean;
  specs: Record<string, string | number>;
  costRs: number;
  priceRs: number;
  gstRate: number;
  hsn: string;
  warrantyMonths: number;
  reorderLevel: number;
  /** Opening stock for bulk (non-serialized) items; serialized stock arrives via goods receipts. */
  openingStock?: number;
};

const panel = (sku: string, name: string, brand: string, watt: number, tech: string, costRs: number, priceRs: number): ProductSeed => ({
  sku, name, brand, category: "panel", unit: "nos", isSerialized: true,
  specs: { watt, technology: tech, dcr: "Yes" }, costRs, priceRs, gstRate: 5, hsn: "854143", warrantyMonths: 240, reorderLevel: 30,
});

export const PRODUCTS: ProductSeed[] = [
  // Panels (DCR — required for PM Surya Ghar)
  panel("PNL-WAA-545", "Waaree Arka 545 Wp Mono PERC (DCR)", "Waaree", 545, "Mono PERC", 12_100, 14_900),
  panel("PNL-ADN-550", "Adani Shine 550 Wp TOPCon Bifacial (DCR)", "Adani Solar", 550, "TOPCon bifacial", 12_800, 15_600),
  panel("PNL-TPS-540", "Tata Power Solar 540 Wp Mono PERC (DCR)", "Tata Power Solar", 540, "Mono PERC", 12_300, 15_200),
  panel("PNL-VKR-545", "Vikram Somera 545 Wp Mono PERC (DCR)", "Vikram Solar", 545, "Mono PERC", 12_000, 14_800),

  // On-grid inverters
  { sku: "INV-GRW-1K", name: "Growatt MIC 1000TL-X 1 kW On-Grid Inverter", brand: "Growatt", category: "inverter", unit: "nos", isSerialized: true, specs: { kw: 1, phase: "Single" }, costRs: 14_500, priceRs: 17_900, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 3 },
  { sku: "INV-GRW-2K", name: "Growatt MIN 2000TL-X 2 kW On-Grid Inverter", brand: "Growatt", category: "inverter", unit: "nos", isSerialized: true, specs: { kw: 2, phase: "Single" }, costRs: 19_000, priceRs: 23_500, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 3 },
  { sku: "INV-GRW-3K", name: "Growatt MIN 3000TL-X 3 kW On-Grid Inverter", brand: "Growatt", category: "inverter", unit: "nos", isSerialized: true, specs: { kw: 3, phase: "Single" }, costRs: 23_500, priceRs: 28_900, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 4 },
  { sku: "INV-SGR-4K", name: "Sungrow SG4.0RS 4 kW On-Grid Inverter", brand: "Sungrow", category: "inverter", unit: "nos", isSerialized: true, specs: { kw: 4, phase: "Single" }, costRs: 31_000, priceRs: 37_900, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 3 },
  { sku: "INV-SGR-5K", name: "Sungrow SG5.0RS 5 kW On-Grid Inverter", brand: "Sungrow", category: "inverter", unit: "nos", isSerialized: true, specs: { kw: 5, phase: "Single" }, costRs: 35_500, priceRs: 42_900, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 3 },

  // Off-grid PCUs (inverter + MPPT)
  { sku: "PCU-LUM-1K", name: "Luminous NXG 1100 Solar PCU 1 kVA / 12 V", brand: "Luminous", category: "inverter", unit: "nos", isSerialized: true, specs: { kva: 1, bankVolt: 12 }, costRs: 9_800, priceRs: 12_900, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 2 },
  { sku: "PCU-UTL-2K", name: "UTL Gamma+ 2 kVA / 24 V Solar PCU", brand: "UTL", category: "inverter", unit: "nos", isSerialized: true, specs: { kva: 2, bankVolt: 24 }, costRs: 17_000, priceRs: 21_500, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 2 },
  { sku: "PCU-UTL-3K", name: "UTL Gamma+ 3.5 kVA / 48 V Solar PCU", brand: "UTL", category: "inverter", unit: "nos", isSerialized: true, specs: { kva: 3.5, bankVolt: 48 }, costRs: 26_000, priceRs: 32_500, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 2 },
  { sku: "PCU-LUM-5K", name: "Luminous Solarverter Pro 5 kVA / 48 V", brand: "Luminous", category: "inverter", unit: "nos", isSerialized: true, specs: { kva: 5, bankVolt: 48 }, costRs: 42_000, priceRs: 51_900, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 2 },

  // Batteries
  { sku: "BAT-EXD-150", name: "Exide Solar Tubular 150 Ah 12 V Battery", brand: "Exide", category: "battery", unit: "nos", isSerialized: true, specs: { ah: 150, volt: 12 }, costRs: 12_200, priceRs: 14_900, gstRate: 18, hsn: "850720", warrantyMonths: 24, reorderLevel: 8 },
  { sku: "BAT-LUM-200", name: "Luminous LPTT 200 Ah 12 V Tubular Battery", brand: "Luminous", category: "battery", unit: "nos", isSerialized: true, specs: { ah: 200, volt: 12 }, costRs: 15_800, priceRs: 18_900, gstRate: 18, hsn: "850720", warrantyMonths: 24, reorderLevel: 8 },

  // Charge controllers (listed in every package by the brief)
  { sku: "CC-MPPT-40", name: "Luminous MPPT Charge Controller 40 A", brand: "Luminous", category: "charge_controller", unit: "nos", isSerialized: true, specs: { amps: 40 }, costRs: 6_800, priceRs: 8_900, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 4 },
  { sku: "CC-MPPT-60", name: "Luminous MPPT Charge Controller 60 A", brand: "Luminous", category: "charge_controller", unit: "nos", isSerialized: true, specs: { amps: 60 }, costRs: 9_800, priceRs: 12_500, gstRate: 5, hsn: "850440", warrantyMonths: 24, reorderLevel: 3 },

  // Balance of system (bulk, non-serialized)
  { sku: "STR-GI-1KW", name: "Hot-dip GI Mounting Structure (per kW set)", brand: "SunPower Fab", category: "structure", unit: "set", isSerialized: false, specs: { coatingMicron: 80 }, costRs: 5_200, priceRs: 6_800, gstRate: 5, hsn: "730820", warrantyMonths: 120, reorderLevel: 15, openingStock: 60 },
  { sku: "ACDB-1PH", name: "ACDB Single Phase with MCB & SPD", brand: "Havells", category: "acdb", unit: "nos", isSerialized: false, specs: { phase: "Single" }, costRs: 2_600, priceRs: 3_500, gstRate: 18, hsn: "853710", warrantyMonths: 12, reorderLevel: 8, openingStock: 25 },
  { sku: "DCDB-2IN", name: "DCDB 2-String with Fuses & SPD", brand: "Havells", category: "dcdb", unit: "nos", isSerialized: false, specs: { strings: 2 }, costRs: 2_900, priceRs: 3_900, gstRate: 18, hsn: "853710", warrantyMonths: 12, reorderLevel: 8, openingStock: 25 },
  { sku: "CBL-DC-4", name: "Polycab Solar DC Cable 4 sq mm", brand: "Polycab", category: "cable", unit: "m", isSerialized: false, specs: { sqmm: 4 }, costRs: 52, priceRs: 70, gstRate: 18, hsn: "854449", warrantyMonths: 0, reorderLevel: 300, openingStock: 1500 },
  { sku: "CBL-AC-6", name: "Havells AC Armoured Cable 6 sq mm", brand: "Havells", category: "cable", unit: "m", isSerialized: false, specs: { sqmm: 6 }, costRs: 95, priceRs: 125, gstRate: 18, hsn: "854449", warrantyMonths: 0, reorderLevel: 200, openingStock: 900 },
  { sku: "MC4-PAIR", name: "MC4 Connector Pair (IP68)", brand: "Elmex", category: "connector", unit: "set", isSerialized: false, specs: { rating: "IP68" }, costRs: 120, priceRs: 180, gstRate: 18, hsn: "853690", warrantyMonths: 0, reorderLevel: 40, openingStock: 200 },
  { sku: "EARTH-KIT", name: "Chemical Earthing Kit with 3 m Electrode", brand: "JMV", category: "earthing", unit: "kit", isSerialized: false, specs: { electrodeM: 3 }, costRs: 3_100, priceRs: 4_200, gstRate: 18, hsn: "853590", warrantyMonths: 0, reorderLevel: 20, openingStock: 90 },
  { sku: "LA-CU-1M", name: "Copper Lightning Arrestor 1 m", brand: "JMV", category: "lightning_arrestor", unit: "nos", isSerialized: false, specs: { heightM: 1 }, costRs: 2_600, priceRs: 3_500, gstRate: 18, hsn: "853540", warrantyMonths: 0, reorderLevel: 6, openingStock: 4 },
  { sku: "MTR-NET-1PH", name: "Bi-directional Net Meter, Single Phase (DISCOM approved)", brand: "L&T", category: "meter", unit: "nos", isSerialized: false, specs: { phase: "Single" }, costRs: 3_800, priceRs: 4_800, gstRate: 18, hsn: "902830", warrantyMonths: 12, reorderLevel: 6, openingStock: 18 },

  // Spares used on service visits
  { sku: "SPR-FAN", name: "Inverter Cooling Fan", brand: "Generic", category: "accessory", unit: "nos", isSerialized: false, specs: {}, costRs: 450, priceRs: 900, gstRate: 18, hsn: "841459", warrantyMonths: 0, reorderLevel: 5, openingStock: 12 },
  { sku: "SPR-SPD", name: "DC Surge Protection Device (SPD)", brand: "Havells", category: "accessory", unit: "nos", isSerialized: false, specs: {}, costRs: 1_100, priceRs: 1_800, gstRate: 18, hsn: "853630", warrantyMonths: 0, reorderLevel: 5, openingStock: 3 },
  { sku: "SPR-FUSE", name: "DC Fuse 15 A (pair)", brand: "Havells", category: "accessory", unit: "set", isSerialized: false, specs: {}, costRs: 180, priceRs: 350, gstRate: 18, hsn: "853610", warrantyMonths: 0, reorderLevel: 10, openingStock: 40 },

  // Service
  { sku: "SVC-INSTALL", name: "Installation, Testing & Commissioning (per kW)", brand: "SunPower", category: "service", unit: "kw", isSerialized: false, specs: {}, costRs: 0, priceRs: 4_500, gstRate: 18, hsn: "995461", warrantyMonths: 60, reorderLevel: 0 },
];

export type PackageSeed = {
  code: string;
  name: string;
  systemType: SystemType;
  capacityKw: number;
  description: string;
  lines: { sku: string; qty: number }[];
};

const ON_GRID_INVERTER: Record<number, string> = { 1: "INV-GRW-1K", 2: "INV-GRW-2K", 3: "INV-GRW-3K", 4: "INV-SGR-4K", 5: "INV-SGR-5K" };
const OFF_GRID_PCU: Record<number, string> = { 1: "PCU-LUM-1K", 2: "PCU-UTL-2K", 3: "PCU-UTL-3K", 4: "PCU-LUM-5K", 5: "PCU-LUM-5K" };
/** Battery bank: 12 V / 24 V / 48 V depending on size. */
const OFF_GRID_BATTERY: Record<number, { sku: string; qty: number }> = {
  1: { sku: "BAT-EXD-150", qty: 1 },
  2: { sku: "BAT-EXD-150", qty: 2 },
  3: { sku: "BAT-EXD-150", qty: 4 },
  4: { sku: "BAT-LUM-200", qty: 4 },
  5: { sku: "BAT-LUM-200", qty: 4 },
};

function bom(kw: number, systemType: SystemType): { sku: string; qty: number }[] {
  const panels = Math.ceil((kw * 1000) / 545);
  const lines = [
    { sku: systemType === "on_grid" ? "PNL-WAA-545" : "PNL-TPS-540", qty: panels },
    { sku: systemType === "on_grid" ? ON_GRID_INVERTER[kw]! : OFF_GRID_PCU[kw]!, qty: 1 },
    { sku: kw <= 3 ? "CC-MPPT-40" : "CC-MPPT-60", qty: 1 },
    { sku: "STR-GI-1KW", qty: kw },
    { sku: "ACDB-1PH", qty: 1 },
    { sku: "DCDB-2IN", qty: 1 },
    { sku: "CBL-DC-4", qty: 20 + 5 * kw },
    { sku: "CBL-AC-6", qty: 15 + 3 * kw },
    { sku: "MC4-PAIR", qty: Math.ceil(panels / 2) + 1 },
    { sku: "EARTH-KIT", qty: 3 },
    { sku: "LA-CU-1M", qty: 1 },
  ];
  if (systemType === "on_grid") lines.push({ sku: "MTR-NET-1PH", qty: 1 });
  else lines.push(OFF_GRID_BATTERY[kw]!);
  lines.push({ sku: "SVC-INSTALL", qty: kw });
  return lines;
}

export const PACKAGES: PackageSeed[] = [1, 2, 3, 4, 5].flatMap((kw) => [
  {
    code: `ONG-${kw}`,
    name: `${kw} kW On-Grid System`,
    systemType: "on_grid" as const,
    capacityKw: kw,
    description: `Grid-connected ${kw} kW rooftop system with net metering — eligible for the PM Surya Ghar subsidy for homes.`,
    lines: bom(kw, "on_grid"),
  },
  {
    code: `OFG-${kw}`,
    name: `${kw} kW Off-Grid System`,
    systemType: "off_grid" as const,
    capacityKw: kw,
    description: `${kw} kW system with tubular battery backup for power cuts and areas with weak grid supply.`,
    lines: bom(kw, "off_grid"),
  },
]);
