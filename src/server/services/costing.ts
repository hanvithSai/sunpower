/**
 * Job costing from actuals — "which installations made money, which lost money".
 *
 *   revenue   = order value excluding GST
 *   material  = each dispatched serial at what that unit cost on its GRN, plus
 *               bulk items at the cost snapshot on the order (estimated from the
 *               quote until the kit is dispatched)
 *   labour    = installation time logs × each technician's hourly rate
 *   site      = extra material and costs recorded on the roof
 *   warranty  = free repairs we absorbed later (parts at cost + labour)
 *   profit    = revenue − material − labour − site − warranty
 *
 * Replacement units are excluded from material: their cost is already in the
 * warranty repair that fitted them.
 */
import type { Types } from "mongoose";
import { connectDB } from "../db";
import { Job, Order, SerialUnit, User, type IOrder } from "../models";

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

type OrderForCosting = Pick<IOrder, "_id" | "taxablePaise" | "lines" | "pickList" | "extraCosts">;

export async function costOrders(orders: OrderForCosting[]): Promise<Map<string, Costing>> {
  await connectDB();
  const ids = orders.map((o) => o._id);
  const [serialCosts, jobs] = await Promise.all([
    SerialUnit.aggregate<{ _id: Types.ObjectId; costPaise: number; n: number }>([
      { $match: { orderId: { $in: ids }, replacesSerial: { $exists: false } } },
      { $group: { _id: "$orderId", costPaise: { $sum: "$costPaise" }, n: { $sum: 1 } } },
    ]),
    Job.find({ orderId: { $in: ids }, type: "installation", status: { $ne: "cancelled" } }).select("orderId timeLogs").lean(),
  ]);
  const techIds = [...new Set(jobs.flatMap((j) => j.timeLogs.map((t) => String(t.technicianId))))];
  const rates = new Map((await User.find({ _id: { $in: techIds } }).select("hourlyRatePaise").lean()).map((u) => [String(u._id), u.hourlyRatePaise]));
  const serialByOrder = new Map(serialCosts.map((s) => [String(s._id), s]));
  const labourByOrder = new Map<string, { paise: number; hours: number }>();
  for (const j of jobs) {
    const key = String(j.orderId);
    const acc = labourByOrder.get(key) ?? { paise: 0, hours: 0 };
    for (const t of j.timeLogs) {
      acc.paise += Math.round(t.hours * (rates.get(String(t.technicianId)) ?? 0));
      acc.hours += t.hours;
    }
    labourByOrder.set(key, acc);
  }

  const result = new Map<string, Costing>();
  for (const o of orders) {
    const key = String(o._id);
    const costBySku = new Map(o.lines.map((l) => [l.sku, l.unitCostPaise]));
    const serial = serialByOrder.get(key);
    const estimated = !serial;
    const serializedPaise = serial
      ? serial.costPaise
      : o.lines.filter((l) => l.isSerialized).reduce((s, l) => s + l.qty * l.unitCostPaise, 0);
    const bulkLines = o.pickList.length ? o.pickList.filter((l) => !l.isSerialized) : o.lines.filter((l) => !l.isSerialized && l.category !== "service");
    const bulkPaise = bulkLines.reduce((s, l) => s + l.qty * (costBySku.get(l.sku) ?? 0), 0);
    const labour = labourByOrder.get(key) ?? { paise: 0, hours: 0 };
    // Entries written before `kind` existed are recognised by their label.
    const isWarranty = (e: (typeof o.extraCosts)[number]) => e.kind === "warranty" || e.label.startsWith("Warranty repair");
    const sitePaise = o.extraCosts.filter((e) => !isWarranty(e)).reduce((s, e) => s + e.amountPaise, 0);
    const warrantyPaise = o.extraCosts.filter(isWarranty).reduce((s, e) => s + e.amountPaise, 0);
    const materialPaise = serializedPaise + bulkPaise;
    const costPaise = materialPaise + labour.paise + sitePaise + warrantyPaise;
    const profitPaise = o.taxablePaise - costPaise;
    result.set(key, {
      revenuePaise: o.taxablePaise,
      materialPaise,
      labourPaise: labour.paise,
      sitePaise,
      warrantyPaise,
      costPaise,
      profitPaise,
      marginPct: o.taxablePaise ? Math.round((profitPaise / o.taxablePaise) * 1000) / 10 : 0,
      labourHours: labour.hours,
      estimated,
    });
  }
  return result;
}

export async function costOrder(orderId: string): Promise<Costing | null> {
  await connectDB();
  const order = await Order.findById(orderId).select("taxablePaise lines pickList extraCosts").lean();
  if (!order) return null;
  return (await costOrders([order])).get(orderId) ?? null;
}
