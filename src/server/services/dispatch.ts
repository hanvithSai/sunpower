/**
 * Dispatch: pack an order against its pick list, send the truck, confirm
 * delivery.
 *
 *   scan serial  → the unit is Allocated to this order (wrong product, a unit
 *                  already packed elsewhere or one not in stock is refused
 *                  with a message that names the problem)
 *   tick bulk    → cable, stands, earthing kits… counted, not scanned
 *   all packed   → the order moves to "Packed" (ready_to_dispatch) by itself
 *   dispatch     → BR-02 re-checked inside the transaction; stock leaves the
 *                  ledger, serials go In transit, and the GST tax invoice is
 *                  issued with payments so far applied (BR-18)
 *   delivered    → every serial's warranty clock starts (BR-03), using the
 *                  warranty months sold on the order. Nobody types a date.
 */
import { Types } from "mongoose";
import { PRODUCT_CATEGORY_LABELS, statusMeta, type OrderStatus, type ProductCategory } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { normalizeSerial, type DeliverOrderInput, type DispatchOrderInput } from "@/lib/validation/inventory";
import { addMonths } from "@/lib/warranty";
import { ORDER_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import { actorRef, toObjectId, type Actor } from "../lib/actor";
import { Customer, Invoice, Job, Order, Product, SerialUnit, User, type IOrder } from "../models";
import { logActivity } from "./core/activity";
import { issueInvoice } from "./core/invoicing";
import { moveStock } from "./core/stock";
import { OPEN_PICK_STATUSES } from "./inventory";

type PickLine = IOrder["pickList"][number];

export type PackingProgress = {
  serialRequired: number;
  serialScanned: number;
  bulkLines: number;
  bulkPicked: number;
  complete: boolean;
};

export function packingProgress(pickList: readonly Pick<PickLine, "qty" | "isSerialized" | "serials" | "picked">[]): PackingProgress {
  let serialRequired = 0;
  let serialScanned = 0;
  let bulkLines = 0;
  let bulkPicked = 0;
  for (const line of pickList) {
    if (line.isSerialized) {
      serialRequired += line.qty;
      serialScanned += Math.min(line.serials.length, line.qty);
    } else {
      bulkLines += 1;
      if (line.picked) bulkPicked += 1;
    }
  }
  return { serialRequired, serialScanned, bulkLines, bulkPicked, complete: serialScanned === serialRequired && bulkPicked === bulkLines };
}

/** "Packed" follows the pick list both ways: complete → ready_to_dispatch, an un-scan → back to confirmed. */
function applyPackedStatus(order: { status: OrderStatus; pickList: PickLine[] }): PackingProgress {
  const progress = packingProgress(order.pickList);
  if (progress.complete && order.status === "confirmed") order.status = "ready_to_dispatch";
  else if (!progress.complete && order.status === "ready_to_dispatch") order.status = "confirmed";
  return progress;
}

function isOpenForPacking(status: OrderStatus): boolean {
  return (OPEN_PICK_STATUSES as readonly string[]).includes(status);
}

/** What is still missing, in words, for the DISPATCH_INCOMPLETE message. */
function describeMissing(pickList: PickLine[]): string {
  const parts: string[] = [];
  for (const line of pickList) {
    if (line.isSerialized && line.serials.length < line.qty) parts.push(`${line.qty - line.serials.length} × ${line.name} to scan`);
    if (!line.isSerialized && !line.picked) parts.push(`${line.name} to tick`);
  }
  return parts.slice(0, 4).join("; ") + (parts.length > 4 ? `; and ${parts.length - 4} more` : "");
}

/* --------------------------------- Reads -------------------------------- */

export type DispatchTab = "to_pack" | "in_transit" | "delivered";

const TAB_STATUSES: Record<DispatchTab, OrderStatus[]> = {
  to_pack: ["confirmed", "ready_to_dispatch"],
  in_transit: ["dispatched"],
  delivered: ["delivered", "installing", "commissioned", "closed"],
};

export async function listDispatchQueue(tab: DispatchTab = "to_pack") {
  await connectDB();
  const [orders, counts] = await Promise.all([
    Order.find({ status: { $in: TAB_STATUSES[tab] } })
      .sort(tab === "delivered" ? { "dispatch.deliveredAt": -1 } : { confirmedAt: 1 })
      .limit(100)
      .lean(),
    Promise.all(
      (Object.keys(TAB_STATUSES) as DispatchTab[]).map(async (t) => [t, await Order.countDocuments({ status: { $in: TAB_STATUSES[t] } })] as const),
    ),
  ]);
  const [customers, jobs] = await Promise.all([
    Customer.find({ _id: { $in: orders.map((o) => o.customerId) } }).select("name address.city").lean(),
    Job.find({ _id: { $in: orders.flatMap((o) => (o.installationJobId ? [o.installationJobId] : [])) } }).select("number scheduledFor status").lean(),
  ]);
  const customerById = new Map(customers.map((c) => [String(c._id), c]));
  const jobById = new Map(jobs.map((j) => [String(j._id), j]));

  const items = orders.map((o) => {
    const customer = customerById.get(String(o.customerId));
    const job = o.installationJobId ? jobById.get(String(o.installationJobId)) : undefined;
    return {
      id: String(o._id),
      number: o.number,
      title: o.title,
      status: o.status,
      customerName: customer?.name ?? "—",
      city: customer?.address.city ?? o.siteAddress.city,
      progress: packingProgress(o.pickList),
      installOn: job?.scheduledFor,
      jobNumber: job?.number,
      vehicleNo: o.dispatch?.vehicleNo,
      dispatchedAt: o.dispatch?.dispatchedAt,
      deliveredAt: o.dispatch?.deliveredAt,
    };
  });
  // Pack the soonest installation first.
  if (tab === "to_pack") items.sort((a, b) => (a.installOn?.getTime() ?? Infinity) - (b.installOn?.getTime() ?? Infinity));
  return { items, counts: Object.fromEntries(counts) as Record<DispatchTab, number> };
}

export async function getDispatchDetail(orderId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) return null;
  const order = await Order.findById(orderId).lean();
  if (!order) return null;

  const [customer, job, invoice, products, units] = await Promise.all([
    Customer.findById(order.customerId).select("name phone address").lean(),
    order.installationJobId ? Job.findById(order.installationJobId).select("number scheduledFor status technicianIds").lean() : null,
    order.invoiceId ? Invoice.findById(order.invoiceId).select("number totalPaise paidPaise status").lean() : null,
    Product.find({ _id: { $in: order.pickList.map((l) => l.productId) } }).select("stockQty").lean(),
    SerialUnit.find({ orderId: order._id }).select("serial status warrantyEndAt productId").lean(),
  ]);
  const crew = job ? await User.find({ _id: { $in: job.technicianIds } }).select("name").lean() : [];
  const stockById = new Map(products.map((p) => [String(p._id), p.stockQty]));
  const unitBySerial = new Map(units.map((u) => [u.serial, u]));
  const warrantyBySku = new Map(order.lines.map((l) => [l.sku, l.warrantyMonths]));

  return {
    order: {
      id: String(order._id),
      number: order.number,
      title: order.title,
      status: order.status,
      capacityKw: order.capacityKw,
      siteAddress: order.siteAddress,
      dispatch: order.dispatch ?? {},
      totalPaise: order.totalPaise,
      paidPaise: order.paidPaise,
    },
    customer: customer ? { name: customer.name, phone: customer.phone, city: customer.address.city } : null,
    job: job ? { id: String(job._id), number: job.number, scheduledFor: job.scheduledFor, status: job.status, crew: crew.map((c) => c.name) } : null,
    invoice: invoice ? { id: String(invoice._id), number: invoice.number, totalPaise: invoice.totalPaise, paidPaise: invoice.paidPaise, status: invoice.status } : null,
    lines: order.pickList.map((l) => ({
      productId: String(l.productId),
      sku: l.sku,
      name: l.name,
      qty: l.qty,
      isSerialized: l.isSerialized,
      picked: l.picked,
      onHand: stockById.get(String(l.productId)) ?? 0,
      warrantyMonths: warrantyBySku.get(l.sku) ?? 0,
      serials: l.serials.map((s) => ({ serial: s, status: unitBySerial.get(s)?.status, warrantyEndAt: unitBySerial.get(s)?.warrantyEndAt })),
    })),
    progress: packingProgress(order.pickList),
    canPack: isOpenForPacking(order.status),
  };
}

/* ------------------------------- Packing -------------------------------- */

export type ScanResult = {
  serial: string;
  productName: string;
  scanned: number;
  qty: number;
  progress: PackingProgress;
  packed: boolean;
};

/** Allocate one scanned unit to the order. Every refusal names what is wrong. */
export async function scanSerial(orderId: string, rawSerial: string, actor: Actor): Promise<ScanResult> {
  const serial = normalizeSerial(rawSerial);
  return withTransaction(async (session) => {
    const now = new Date();
    const order = await Order.findById(orderId).session(session);
    if (!order) throw notFoundError("Order");
    if (!isOpenForPacking(order.status)) {
      throw new AppError("INVALID_STATE", `Order ${order.number} is "${statusMeta("order", order.status).label}" — packing is closed.`);
    }

    const unit = await SerialUnit.findOne({ serial }).session(session);
    if (!unit) throw new AppError("NOT_FOUND", `${serial} isn't in the serial register. Receive it on a goods receipt first.`);
    if (unit.status === "allocated" && unit.orderId?.equals(order._id)) {
      throw new AppError("CONFLICT", `${serial} is already scanned on this order.`);
    }
    if (unit.status === "allocated") {
      const other = await Order.findById(unit.orderId).select("number").session(session).lean();
      throw new AppError("CONFLICT", `${serial} is already packed for ${other?.number ?? "another order"}.`);
    }
    if (unit.status !== "in_stock") {
      throw new AppError("INVALID_STATE", `${serial} is "${statusMeta("serial", unit.status).label}" — only units in stock can be packed.`);
    }

    const line = order.pickList.find((l) => l.isSerialized && l.productId.equals(unit.productId));
    if (!line) {
      const needed = order.pickList.filter((l) => l.isSerialized && l.serials.length < l.qty).map((l) => l.name);
      throw new AppError(
        "VALIDATION",
        `${serial} is a ${unit.productName}; this order needs ${needed.length ? needed.join(" or ") : "no more serial-tracked items"}.`,
      );
    }
    if (line.serials.length >= line.qty) {
      throw new AppError("VALIDATION", `All ${line.qty} × ${line.name} for this order are already scanned.`);
    }

    const claimed = await SerialUnit.updateOne(
      { _id: unit._id, status: "in_stock" },
      {
        $set: { status: "allocated", orderId: order._id, customerId: order.customerId, allocatedAt: now },
        $push: { history: { status: "allocated", at: now, note: `Packed for ${order.number}`, by: actor.name } },
      },
      { session },
    );
    if (claimed.modifiedCount !== 1) throw new AppError("CONFLICT", `${serial} was just packed by someone else. Scan another unit.`);

    line.serials.push(serial);
    const wasPacked = order.status === "ready_to_dispatch";
    const progress = applyPackedStatus(order);
    await order.save({ session });
    if (!wasPacked && order.status === "ready_to_dispatch") {
      await logActivity(
        { entityType: "order", entityId: order._id, customerId: order.customerId, action: "packed", message: `Packed: ${progress.serialScanned} serials scanned and ${progress.bulkLines} bulk lines ticked`, actor },
        session,
      );
    }
    return { serial, productName: unit.productName, scanned: line.serials.length, qty: line.qty, progress, packed: order.status === "ready_to_dispatch" };
  });
}

/** Take a scanned unit off the order (wrong box picked up, damaged in packing). */
export async function unscanSerial(orderId: string, rawSerial: string, actor: Actor): Promise<PackingProgress> {
  const serial = normalizeSerial(rawSerial);
  return withTransaction(async (session) => {
    const now = new Date();
    const order = await Order.findById(orderId).session(session);
    if (!order) throw notFoundError("Order");
    if (!isOpenForPacking(order.status)) throw new AppError("INVALID_STATE", "This order has already left the warehouse.");
    const line = order.pickList.find((l) => l.serials.includes(serial));
    if (!line) throw new AppError("NOT_FOUND", `${serial} isn't on this order.`);

    line.serials = line.serials.filter((s) => s !== serial);
    await SerialUnit.updateOne(
      { serial, orderId: order._id, status: "allocated" },
      {
        $set: { status: "in_stock" },
        $unset: { orderId: "", customerId: "", allocatedAt: "" },
        $push: { history: { status: "in_stock", at: now, note: `Removed from ${order.number}`, by: actor.name } },
      },
      { session },
    );
    const progress = applyPackedStatus(order);
    await order.save({ session });
    return progress;
  });
}

/** Tick (or untick) a bulk line. Ticking checks there is enough on the shelf. */
export async function setBulkPicked(orderId: string, productId: string, picked: boolean, actor: Actor): Promise<PackingProgress> {
  return withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw notFoundError("Order");
    if (!isOpenForPacking(order.status)) throw new AppError("INVALID_STATE", "This order has already left the warehouse.");
    const line = order.pickList.find((l) => !l.isSerialized && l.productId.equals(toObjectId(productId)));
    if (!line) throw new AppError("NOT_FOUND", "That item isn't a bulk line on this order.");

    if (picked) {
      const product = await Product.findById(line.productId).select("stockQty unit").session(session).lean();
      const onHand = product?.stockQty ?? 0;
      if (onHand < line.qty) {
        throw new AppError("INSUFFICIENT_STOCK", `Only ${onHand} of ${line.name} on hand; ${line.qty} needed. Receive more stock first.`);
      }
    }
    line.picked = picked;
    const wasPacked = order.status === "ready_to_dispatch";
    const progress = applyPackedStatus(order);
    await order.save({ session });
    if (!wasPacked && order.status === "ready_to_dispatch") {
      await logActivity(
        { entityType: "order", entityId: order._id, customerId: order.customerId, action: "packed", message: `Packed: ${progress.serialScanned} serials scanned and ${progress.bulkLines} bulk lines ticked`, actor },
        session,
      );
    }
    return progress;
  });
}

/* ------------------------------ Dispatch -------------------------------- */

/**
 * BR-02 + BR-18: the truck leaves only with every serial scanned and every bulk
 * line ticked (re-checked here, not trusted from the screen); stock leaves the
 * ledger, and the GST tax invoice is issued in the same transaction.
 */
export async function dispatchOrder(input: DispatchOrderInput, actor: Actor, opts: { at?: Date } = {}) {
  return withTransaction(async (session) => {
    const now = opts.at ?? new Date();
    const order = await Order.findById(input.orderId).session(session);
    if (!order) throw notFoundError("Order");

    const progress = packingProgress(order.pickList);
    if (isOpenForPacking(order.status) && !progress.complete) {
      throw new AppError("DISPATCH_INCOMPLETE", `Not ready to dispatch: ${describeMissing(order.pickList)}.`);
    }
    assertTransition("order", ORDER_FLOW, order.status, "dispatched");

    const serials = order.pickList.flatMap((l) => l.serials);
    const allocated = await SerialUnit.countDocuments({ serial: { $in: serials }, orderId: order._id, status: "allocated" }).session(session);
    if (allocated !== serials.length) {
      throw new AppError("DISPATCH_INCOMPLETE", "Some scanned serials are no longer allocated to this order. Re-scan the pick list.");
    }

    for (const line of order.pickList) {
      if (line.qty <= 0) continue;
      await moveStock(
        {
          productId: line.productId,
          qty: -line.qty,
          type: "dispatch",
          serials: line.serials,
          refType: "order",
          refId: order._id,
          refNumber: order.number,
          note: `Dispatched in ${input.vehicleNo}`,
          actor,
          at: now,
        },
        session,
      );
    }
    await SerialUnit.updateMany(
      { serial: { $in: serials }, orderId: order._id },
      {
        $set: { status: "dispatched", dispatchedAt: now },
        $push: { history: { status: "dispatched", at: now, note: `Dispatched on ${order.number} in ${input.vehicleNo}`, by: actor.name } },
      },
      { session },
    );

    order.status = "dispatched";
    order.dispatch = {
      ...(order.dispatch ?? {}),
      vehicleNo: input.vehicleNo,
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      dispatchedAt: now,
      dispatchedBy: actorRef(actor),
    };

    let invoiceNumber: string | undefined;
    if (!order.invoiceId) {
      const serialsByProduct = new Map(order.pickList.map((l) => [String(l.productId), l.serials]));
      const invoice = await issueInvoice(
        {
          type: "sale",
          customerId: order.customerId,
          orderId: order._id,
          lines: order.lines.map((l) => {
            const lineSerials = serialsByProduct.get(String(l.productId)) ?? [];
            return {
              description: lineSerials.length ? `${l.name} (S/N ${lineSerials.join(", ")})` : l.name,
              hsn: l.hsn,
              qty: l.qty,
              unitPricePaise: l.unitPricePaise,
              gstRate: l.gstRate,
            };
          }),
          paidPaise: order.paidPaise,
          issuedAt: now,
          dueInDays: 15,
          notes: `Against order ${order.number}`,
          actor,
        },
        session,
      );
      order.invoiceId = invoice._id;
      invoiceNumber = invoice.number;
    }

    await order.save({ session });
    await logActivity(
      {
        entityType: "order",
        entityId: order._id,
        customerId: order.customerId,
        action: "dispatched",
        message: `Dispatched in ${input.vehicleNo} (${input.driverName}) with ${serials.length} serials${invoiceNumber ? `; tax invoice ${invoiceNumber} issued` : ""}`,
        actor,
        at: now,
      },
      session,
    );
    return { orderNumber: order.number, invoiceNumber, serials: serials.length };
  });
}

/** BR-03: delivery starts every serial's warranty — start = delivery, end = start + months sold. */
export async function deliverOrder(input: DeliverOrderInput, actor: Actor, opts: { at?: Date } = {}) {
  return withTransaction(async (session) => {
    const now = opts.at ?? new Date();
    const order = await Order.findById(input.orderId).session(session);
    if (!order) throw notFoundError("Order");
    assertTransition("order", ORDER_FLOW, order.status, "delivered");

    const monthsBySku = new Map(order.lines.map((l) => [l.sku, l.warrantyMonths]));
    const units = await SerialUnit.find({ orderId: order._id, status: "dispatched" }).session(session).lean();
    if (units.length > 0) {
      await SerialUnit.bulkWrite(
        units.map((u) => {
          const months = monthsBySku.get(u.sku) ?? u.warrantyMonths;
          return {
            updateOne: {
              filter: { _id: u._id },
              update: {
                $set: { deliveredAt: now, warrantyStartAt: now, warrantyEndAt: addMonths(now, months), warrantyMonths: months },
                $push: { history: { status: "dispatched", at: now, note: `Delivered to site — ${months}-month warranty started`, by: actor.name } },
              },
            },
          };
        }),
        { session },
      );
    }

    // Nothing to install (a hardware-only Panel Set): delivery completes the order.
    const hardwareOnly = !order.installationJobId;
    order.status = "delivered";
    if (hardwareOnly) {
      assertTransition("order", ORDER_FLOW, "delivered", "closed");
      order.status = "closed";
      order.closedAt = now;
    }
    order.dispatch = {
      ...(order.dispatch ?? {}),
      deliveredAt: now,
      deliveredBy: actorRef(actor),
      deliveryNote: [`Received by ${input.receivedBy}`, input.note].filter(Boolean).join(". "),
    };
    await order.save({ session });

    // "6 panels to 31 Oct 2046 · 1 inverter to 31 Oct 2028"
    const byCategory = new Map<ProductCategory, { n: number; months: number }>();
    for (const u of units) {
      const entry = byCategory.get(u.category) ?? { n: 0, months: monthsBySku.get(u.sku) ?? u.warrantyMonths };
      entry.n += 1;
      byCategory.set(u.category, entry);
    }
    const summary = [...byCategory.entries()]
      .map(([cat, v]) => `${v.n} ${PRODUCT_CATEGORY_LABELS[cat].toLowerCase()}${v.n === 1 ? "" : "s"} to ${formatDate(addMonths(now, v.months))}`)
      .join(" · ");
    await logActivity(
      {
        entityType: "order",
        entityId: order._id,
        customerId: order.customerId,
        action: "delivered",
        message: `Delivered, received by ${input.receivedBy}. Warranties started: ${summary || "no serial-tracked items"}${hardwareOnly ? ". Hardware only, so the order is complete" : ""}`,
        actor,
        at: now,
      },
      session,
    );
    return { orderNumber: order.number, warranties: units.length, summary };
  });
}
