/**
 * Job costing maths, pure: given an order and what it actually used, work out
 * profit. The costing service gathers the actuals from the database (serial
 * costs from their GRNs, time logs × rates); this file only does the sums.
 *
 *   revenue   = order value excluding GST
 *   material  = dispatched serials at their GRN cost (the quote's cost estimate
 *               until something is dispatched) + bulk items at the cost
 *               snapshot on the order (the picked quantities once packed)
 *   labour    = installation time logs × each technician's hourly rate
 *   site      = extra material and costs recorded on the roof
 *   warranty  = free repairs we absorbed later (parts at cost + labour)
 *   profit    = revenue − material − labour − site − warranty
 */

export type Costing = {
  revenuePaise: number;
  materialPaise: number;
  labourPaise: number;
  sitePaise: number;
  warrantyPaise: number;
  costPaise: number;
  profitPaise: number;
  /** Profit as a share of revenue, in percent. */
  marginPct: number;
  labourHours: number;
  /** Material is still the quote estimate (nothing dispatched yet). */
  estimated: boolean;
};

type CostLine = { sku: string; qty: number; unitCostPaise: number; isSerialized: boolean; category: string };

export type CostingOrder = {
  taxablePaise: number;
  lines: CostLine[];
  pickList: { sku: string; qty: number; isSerialized: boolean }[];
  extraCosts: { label: string; amountPaise: number; kind?: string }[];
};

export type CostingActuals = {
  /** Sum of GRN costs of the serials dispatched on the order; undefined until anything is dispatched. */
  serialCostPaise?: number;
  /** Installation time logs with each technician's hourly rate. */
  timeLogs: { hours: number; hourlyRatePaise: number }[];
};

/** Entries written before `kind` existed are recognised by their label. */
export function isWarrantyCost(entry: { label: string; kind?: string }): boolean {
  return entry.kind === "warranty" || entry.label.startsWith("Warranty repair");
}

export function costFromActuals(order: CostingOrder, actuals: CostingActuals): Costing {
  const costBySku = new Map(order.lines.map((l) => [l.sku, l.unitCostPaise]));
  const estimated = actuals.serialCostPaise === undefined;
  const serializedPaise = estimated
    ? order.lines.filter((l) => l.isSerialized).reduce((s, l) => s + l.qty * l.unitCostPaise, 0)
    : actuals.serialCostPaise!;
  const bulkLines = order.pickList.length
    ? order.pickList.filter((l) => !l.isSerialized)
    : order.lines.filter((l) => !l.isSerialized && l.category !== "service");
  const bulkPaise = bulkLines.reduce((s, l) => s + l.qty * (costBySku.get(l.sku) ?? 0), 0);

  let labourPaise = 0;
  let labourHours = 0;
  for (const t of actuals.timeLogs) {
    labourPaise += Math.round(t.hours * t.hourlyRatePaise);
    labourHours += t.hours;
  }

  const sitePaise = order.extraCosts.filter((e) => !isWarrantyCost(e)).reduce((s, e) => s + e.amountPaise, 0);
  const warrantyPaise = order.extraCosts.filter(isWarrantyCost).reduce((s, e) => s + e.amountPaise, 0);
  const materialPaise = serializedPaise + bulkPaise;
  const costPaise = materialPaise + labourPaise + sitePaise + warrantyPaise;
  const profitPaise = order.taxablePaise - costPaise;
  return {
    revenuePaise: order.taxablePaise,
    materialPaise,
    labourPaise,
    sitePaise,
    warrantyPaise,
    costPaise,
    profitPaise,
    marginPct: order.taxablePaise ? Math.round((profitPaise / order.taxablePaise) * 1000) / 10 : 0,
    labourHours,
    estimated,
  };
}
