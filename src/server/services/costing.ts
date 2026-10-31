/**
 * Job costing from actuals — "which installations made money, which lost money".
 * This service gathers what each order really used; the sums live in
 * src/lib/costing.ts:
 *
 *   material  = each dispatched serial at what that unit cost on its GRN
 *   labour    = installation time logs × each technician's hourly rate
 *   site + warranty = the order's extra-cost entries
 *
 * Replacement units are excluded from material: their cost is already in the
 * warranty repair that fitted them.
 */
import type { Types } from "mongoose";
import { costFromActuals, type Costing } from "@/lib/costing";
import { connectDB } from "../db";
import { Job, Order, SerialUnit, User, type IOrder } from "../models";

export type { Costing };

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
  const serialByOrder = new Map(serialCosts.map((s) => [String(s._id), s.costPaise]));
  const logsByOrder = new Map<string, { hours: number; hourlyRatePaise: number }[]>();
  for (const j of jobs) {
    const key = String(j.orderId);
    const logs = logsByOrder.get(key) ?? [];
    for (const t of j.timeLogs) logs.push({ hours: t.hours, hourlyRatePaise: rates.get(String(t.technicianId)) ?? 0 });
    logsByOrder.set(key, logs);
  }

  const result = new Map<string, Costing>();
  for (const o of orders) {
    const key = String(o._id);
    result.set(key, costFromActuals(o, { serialCostPaise: serialByOrder.get(key), timeLogs: logsByOrder.get(key) ?? [] }));
  }
  return result;
}

export async function costOrder(orderId: string): Promise<Costing | null> {
  await connectDB();
  const order = await Order.findById(orderId).select("taxablePaise lines pickList extraCosts").lean();
  if (!order) return null;
  return (await costOrders([order])).get(orderId) ?? null;
}
