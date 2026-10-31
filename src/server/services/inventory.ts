/**
 * Inventory: what is on the shelf, where every serialized unit is, and goods
 * receipts (GRN) — the only way serialized stock enters the warehouse.
 *
 *   On hand   = Product.stockQty (the ledger total; for serialized products it
 *               equals the units In stock + Allocated).
 *   Reserved  = units on the pick lists of confirmed orders not yet dispatched.
 *   Available = on hand − reserved; at or below the reorder level → low stock.
 *   Value     = serialized units at their own GRN cost, bulk items at catalog cost.
 *
 * A GRN records each unit's purchase cost on its SerialUnit, so job costing
 * later uses what that exact inverter cost, not today's catalog price.
 */
import { Types } from "mongoose";
import { SERIAL_STATUSES, type ProductCategory, type SerialStatus } from "@/lib/constants";
import { fromISTInput, escapeRegex } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { ReceiveGoodsInput } from "@/lib/validation/inventory";
import { connectDB, withTransaction } from "../db";
import { AppError } from "../errors";
import { actorRef, type Actor } from "../lib/actor";
import { Customer, Order, Product, Purchase, SerialUnit } from "../models";
import { logActivity } from "./core/activity";
import { nextNumber } from "./core/counters";
import { moveStock } from "./core/stock";

/** Orders whose pick lists still hold stock in the warehouse. */
export const OPEN_PICK_STATUSES = ["confirmed", "ready_to_dispatch"] as const;

export type StockView = "all" | "low" | "serialized";

export type StockRow = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  unit: string;
  isSerialized: boolean;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  low: boolean;
  valuePaise: number;
  warrantyMonths: number;
};

/** Units reserved on open pick lists, by product id. */
async function reservedByProduct(): Promise<Map<string, number>> {
  const rows = await Order.aggregate<{ _id: Types.ObjectId; qty: number }>([
    { $match: { status: { $in: [...OPEN_PICK_STATUSES] } } },
    { $unwind: "$pickList" },
    { $group: { _id: "$pickList.productId", qty: { $sum: "$pickList.qty" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.qty]));
}

export async function listStock(filter: { q?: string; view?: StockView } = {}) {
  await connectDB();
  const query: Record<string, unknown> = { active: true, category: { $ne: "service" } };
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ name: rx }, { sku: rx }, { brand: rx }];
  }

  const [products, reserved, serialValue] = await Promise.all([
    Product.find(query).sort({ category: 1, name: 1 }).lean(),
    reservedByProduct(),
    SerialUnit.aggregate<{ _id: Types.ObjectId; valuePaise: number }>([
      { $match: { status: { $in: ["in_stock", "allocated"] } } },
      { $group: { _id: "$productId", valuePaise: { $sum: "$costPaise" } } },
    ]),
  ]);
  const valueBySerialProduct = new Map(serialValue.map((v) => [String(v._id), v.valuePaise]));

  const rows: StockRow[] = products.map((p) => {
    const id = String(p._id);
    const onHand = p.stockQty;
    const held = reserved.get(id) ?? 0;
    const available = onHand - held;
    return {
      id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      unit: p.unit,
      isSerialized: p.isSerialized,
      onHand,
      reserved: held,
      available,
      reorderLevel: p.reorderLevel,
      low: available <= p.reorderLevel,
      valuePaise: p.isSerialized ? (valueBySerialProduct.get(id) ?? 0) : Math.max(0, onHand) * p.costPaise,
      warrantyMonths: p.warrantyMonths,
    };
  });

  const view = filter.view ?? "all";
  const items = view === "low" ? rows.filter((r) => r.low) : view === "serialized" ? rows.filter((r) => r.isSerialized) : rows;
  return {
    items,
    totals: {
      valuePaise: rows.reduce((sum, r) => sum + r.valuePaise, 0),
      lowCount: rows.filter((r) => r.low).length,
      serialUnits: rows.filter((r) => r.isSerialized).reduce((sum, r) => sum + r.onHand, 0),
      reservedUnits: rows.reduce((sum, r) => sum + r.reserved, 0),
    },
  };
}

/* ---------------------------- Serial register --------------------------- */

export async function listSerials(filter: { q?: string; status?: string; page?: number; pageSize?: number }) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter.status && (SERIAL_STATUSES as readonly string[]).includes(filter.status)) query.status = filter.status;
  const q = filter.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ serial: rx }, { sku: rx }, { productName: rx }];
  }
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 25);
  const countQuery = { ...query };
  delete countQuery.status;

  const [units, total, grouped] = await Promise.all([
    SerialUnit.find(query).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    SerialUnit.countDocuments(query),
    SerialUnit.aggregate<{ _id: SerialStatus; n: number }>([{ $match: countQuery }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  const orderIds = units.map((u) => u.orderId).filter((id): id is Types.ObjectId => Boolean(id));
  const customerIds = units.map((u) => u.customerId).filter((id): id is Types.ObjectId => Boolean(id));
  const purchaseIds = units.map((u) => u.purchaseId).filter((id): id is Types.ObjectId => Boolean(id));
  const [orders, customers, purchases] = await Promise.all([
    Order.find({ _id: { $in: orderIds } }).select("number").lean(),
    Customer.find({ _id: { $in: customerIds } }).select("name address.city").lean(),
    Purchase.find({ _id: { $in: purchaseIds } }).select("number").lean(),
  ]);
  const orderById = new Map(orders.map((o) => [String(o._id), o.number]));
  const customerById = new Map(customers.map((c) => [String(c._id), c]));
  const purchaseById = new Map(purchases.map((p) => [String(p._id), p.number]));

  return {
    items: units.map((u) => {
      const customer = u.customerId ? customerById.get(String(u.customerId)) : undefined;
      return {
        id: String(u._id),
        serial: u.serial,
        sku: u.sku,
        productName: u.productName,
        category: u.category,
        status: u.status,
        costPaise: u.costPaise,
        purchaseNumber: u.purchaseId ? purchaseById.get(String(u.purchaseId)) : undefined,
        orderId: u.orderId ? String(u.orderId) : undefined,
        orderNumber: u.orderId ? orderById.get(String(u.orderId)) : undefined,
        customerName: customer?.name,
        city: customer?.address.city,
        warrantyStartAt: u.warrantyStartAt,
        warrantyEndAt: u.warrantyEndAt,
        updatedAt: u.updatedAt,
      };
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: Object.fromEntries(grouped.map((g) => [g._id, g.n])) as Partial<Record<SerialStatus, number>>,
  };
}

/* ----------------------------- Goods receipts --------------------------- */

export async function listPurchases(filter: { page?: number; pageSize?: number } = {}) {
  await connectDB();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 20);
  const [rows, total] = await Promise.all([
    Purchase.find().sort({ receivedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Purchase.countDocuments(),
  ]);
  return {
    items: rows.map((p) => ({
      id: String(p._id),
      number: p.number,
      supplier: p.supplier.name,
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      lineCount: p.lines.length,
      units: p.lines.reduce((n, l) => n + l.qty, 0),
      serialCount: p.lines.reduce((n, l) => n + l.serials.length, 0),
      totalPaise: p.totalPaise,
      receivedAt: p.receivedAt,
      receivedBy: p.receivedBy.name,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getPurchase(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const p = await Purchase.findById(id).lean();
  if (!p) return null;
  return {
    id: String(p._id),
    number: p.number,
    supplier: p.supplier,
    invoiceNo: p.invoiceNo,
    invoiceDate: p.invoiceDate,
    lines: p.lines.map((l) => ({ ...l, productId: String(l.productId) })),
    totalPaise: p.totalPaise,
    receivedAt: p.receivedAt,
    receivedBy: p.receivedBy.name,
    notes: p.notes,
  };
}

/** Products the GRN form can receive (everything physical, serialized first). */
export async function listReceivableProducts() {
  await connectDB();
  const products = await Product.find({ active: true, category: { $ne: "service" } })
    .sort({ isSerialized: -1, category: 1, name: 1 })
    .select("sku name brand category unit isSerialized costPaise stockQty")
    .lean();
  return products.map((p) => ({
    id: String(p._id),
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: p.category,
    unit: p.unit,
    isSerialized: p.isSerialized,
    costPaise: p.costPaise,
    stockQty: p.stockQty,
  }));
}

/**
 * Receive goods against a supplier invoice. Serialized lines need exactly one
 * unique serial per unit; every unit becomes an In-stock SerialUnit carrying
 * its purchase cost, and every line posts a stock move — all in one transaction.
 */
export async function receiveGoods(input: ReceiveGoodsInput, actor: Actor, opts: { at?: Date } = {}) {
  await connectDB();
  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  const products = await Product.find({ _id: { $in: productIds }, active: true }).lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const fieldErrors: Record<string, string> = {};
  const seen = new Set<string>();
  const allSerials: string[] = [];
  input.lines.forEach((line, i) => {
    const product = productById.get(line.productId);
    if (!product || product.category === "service") {
      fieldErrors[`lines.${i}.productId`] = "Pick a stocked product";
      return;
    }
    if (product.isSerialized) {
      if (line.serials.length !== line.qty) {
        fieldErrors[`lines.${i}.serials`] = `${line.qty} unit${line.qty === 1 ? "" : "s"} need${line.qty === 1 ? "s" : ""} ${line.qty} serial${line.qty === 1 ? "" : "s"}; ${line.serials.length} entered`;
      }
      for (const s of line.serials) {
        if (seen.has(s)) fieldErrors[`lines.${i}.serials`] = `${s} is entered twice`;
        seen.add(s);
        allSerials.push(s);
      }
    } else if (line.serials.length > 0) {
      fieldErrors[`lines.${i}.serials`] = `${product.name} isn't serial-tracked; leave serials empty`;
    }
  });
  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError("VALIDATION", Object.values(fieldErrors)[0], fieldErrors);
  }

  const existing = await SerialUnit.find({ serial: { $in: allSerials } }).select("serial sku").limit(5).lean();
  if (existing.length > 0) {
    const list = existing.map((e) => e.serial).join(", ");
    throw new AppError("CONFLICT", `Already in the serial register: ${list}. Each serial can be received only once.`);
  }

  const receivedAt = opts.at ?? new Date();
  const invoiceDate = fromISTInput(input.invoiceDate);
  if (invoiceDate.getTime() > receivedAt.getTime()) {
    throw new AppError("VALIDATION", "The supplier invoice date can't be in the future.", { invoiceDate: "Can't be in the future" });
  }

  return withTransaction(async (session) => {
    const number = await nextNumber("purchase", session);
    const lines = input.lines.map((l) => {
      const product = productById.get(l.productId)!;
      return {
        productId: product._id,
        sku: product.sku,
        name: product.name,
        qty: l.qty,
        unitCostPaise: Math.round(l.unitCostRs * 100),
        serials: l.serials,
      };
    });
    const totalPaise = lines.reduce((sum, l) => sum + l.qty * l.unitCostPaise, 0);
    const [purchase] = await Purchase.create(
      [
        {
          number,
          supplier: { name: input.supplierName, gstin: input.supplierGstin },
          invoiceNo: input.invoiceNo,
          invoiceDate,
          lines,
          totalPaise,
          receivedAt,
          receivedBy: actorRef(actor),
          notes: input.notes,
        },
      ],
      { session },
    );

    for (const line of lines) {
      const product = productById.get(String(line.productId))!;
      await moveStock(
        {
          productId: line.productId,
          qty: line.qty,
          type: "purchase",
          serials: line.serials,
          refType: "purchase",
          refId: purchase._id,
          refNumber: number,
          note: `${input.supplierName} invoice ${input.invoiceNo}`,
          actor,
          at: receivedAt,
        },
        session,
      );
      if (product.isSerialized) {
        await SerialUnit.insertMany(
          line.serials.map((serial) => ({
            serial,
            productId: product._id,
            sku: product.sku,
            productName: product.name,
            category: product.category,
            status: "in_stock",
            purchaseId: purchase._id,
            costPaise: line.unitCostPaise,
            warrantyMonths: product.warrantyMonths,
            history: [{ status: "in_stock", at: receivedAt, note: `Received on ${number}`, by: actor.name }],
          })),
          { session },
        );
      }
    }

    const units = lines.reduce((n, l) => n + l.qty, 0);
    await logActivity(
      {
        entityType: "purchase",
        entityId: purchase._id,
        action: "received",
        message: `${number}: ${units} units from ${input.supplierName} (${formatINR(totalPaise)}), ${allSerials.length} serials registered`,
        actor,
        at: receivedAt,
      },
      session,
    );

    return { purchaseId: String(purchase._id), number, units, serials: allSerials.length, totalPaise };
  });
}
