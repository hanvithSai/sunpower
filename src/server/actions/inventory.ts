"use server";
/**
 * Warehouse Server Actions: goods receipts (JSON from the GRN form), packing
 * (serial scans and bulk ticks), dispatch and delivery. Scans return the new
 * packing progress so the bench updates without waiting for a page refresh.
 * The director can also correct stock after a count and write off a unit.
 */
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { AdjustStockSchema, BulkPickSchema, DeliverOrderSchema, DispatchOrderSchema, ReceiveGoodsSchema, ScanSerialSchema, WriteOffSerialSchema } from "@/lib/validation/inventory";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm, parseInput } from "../lib/validate";
import { deliverOrder, dispatchOrder, scanSerial, setBulkPicked, unscanSerial } from "../services/dispatch";
import { adjustStock, receiveGoods, writeOffSerial } from "../services/inventory";

function refreshInventory() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/serials");
  revalidatePath("/inventory/purchases");
}

function refreshDispatch(orderId: string) {
  revalidatePath("/dispatch");
  revalidatePath(`/dispatch/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}

/** Called directly from the GRN form with a JSON payload. */
export async function receiveGoodsAction(input: unknown): Promise<ActionState> {
  return runAction(["warehouse"], async (user) => {
    const data = parseInput(ReceiveGoodsSchema, input);
    const result = await receiveGoods(data, user);
    refreshInventory();
    trackServer("grn_received", { lines: data.lines.length, units: result.units, serials: result.serials }, user.id);
    return {
      ok: true,
      message: `${result.number} received: ${result.units} units${result.serials ? `, ${result.serials} serials registered` : ""}`,
      data: { purchaseId: result.purchaseId },
    };
  });
}

export async function scanSerialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["warehouse"], async (user) => {
    const { orderId, serial } = parseForm(ScanSerialSchema, formData);
    const result = await scanSerial(orderId, serial, user);
    refreshDispatch(orderId);
    trackServer("serial_scanned", { ok: true }, user.id);
    return {
      ok: true,
      message: result.packed
        ? `${result.serial} added — everything is packed and ready to dispatch`
        : `${result.serial} added: ${result.productName} (${result.scanned} of ${result.qty})`,
      data: { progress: result.progress },
    };
  });
}

export async function unscanSerialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["warehouse"], async (user) => {
    const { orderId, serial } = parseForm(ScanSerialSchema, formData);
    await unscanSerial(orderId, serial, user);
    refreshDispatch(orderId);
    return { ok: true, message: `${serial} removed and back in stock` };
  });
}

export async function bulkPickAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["warehouse"], async (user) => {
    const { orderId, productId, picked } = parseForm(BulkPickSchema, formData);
    await setBulkPicked(orderId, productId, picked, user);
    refreshDispatch(orderId);
    return { ok: true };
  });
}

export async function dispatchOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["warehouse"], async (user) => {
    const input = parseForm(DispatchOrderSchema, formData);
    const result = await dispatchOrder(input, user);
    refreshDispatch(input.orderId);
    refreshInventory();
    revalidatePath("/invoices");
    trackServer("order_dispatched", { serials: result.serials }, user.id);
    if (result.invoiceNumber) trackServer("invoice_issued", { type: "sale" }, user.id);
    return {
      ok: true,
      message: `${result.orderNumber} dispatched${result.invoiceNumber ? ` — tax invoice ${result.invoiceNumber} issued` : ""}`,
    };
  });
}

export async function deliverOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["warehouse"], async (user) => {
    const input = parseForm(DeliverOrderSchema, formData);
    const result = await deliverOrder(input, user);
    refreshDispatch(input.orderId);
    revalidatePath("/jobs");
    revalidatePath("/my-work");
    trackServer("order_delivered", { warranties: result.warranties }, user.id);
    return { ok: true, message: `${result.orderNumber} delivered — ${result.warranties} warranties started` };
  });
}

/** Director only: correct a bulk item after a count, with a reason on the ledger. */
export async function adjustStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction([], async (user) => {
    const input = parseForm(AdjustStockSchema, formData);
    const result = await adjustStock(input, user);
    revalidatePath("/inventory");
    return { ok: true, message: `${result.name}: ${result.before} → ${result.after}` };
  });
}

/** Director only: a damaged or lost unit leaves stock as Faulty. */
export async function writeOffSerialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction([], async (user) => {
    const input = parseForm(WriteOffSerialSchema, formData);
    const result = await writeOffSerial(input, user);
    revalidatePath("/inventory");
    revalidatePath("/inventory/serials");
    return { ok: true, message: `${result.serial} written off` };
  });
}
