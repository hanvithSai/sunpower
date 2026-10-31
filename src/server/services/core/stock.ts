/**
 * The only way stock quantities change. Each call atomically adjusts
 * Product.stockQty (refusing to go below zero) and appends a StockMove to the
 * ledger, so on-hand quantities always reconcile with their history.
 */
import type { ClientSession, Types } from "mongoose";
import type { StockMoveType } from "@/lib/constants";
import { Product, type IProduct } from "../../models/catalog";
import { StockMove } from "../../models/inventory";
import { AppError, notFoundError } from "../../errors";
import { actorRef, toObjectId, type Actor } from "../../lib/actor";

export interface MoveStockInput {
  productId: string | Types.ObjectId;
  /** Signed: +received, -issued */
  qty: number;
  type: StockMoveType;
  serials?: string[];
  refType?: "purchase" | "order" | "ticket" | "manual";
  refId?: string | Types.ObjectId;
  refNumber?: string;
  note?: string;
  actor?: Actor | null;
  at?: Date;
}

export async function moveStock(input: MoveStockInput, session?: ClientSession): Promise<IProduct> {
  const productId = toObjectId(input.productId);
  const filter: Record<string, unknown> = { _id: productId };
  if (input.qty < 0) filter.stockQty = { $gte: -input.qty };

  const product = await Product.findOneAndUpdate(
    filter,
    { $inc: { stockQty: input.qty } },
    { returnDocument: "after", session },
  ).lean();

  if (!product) {
    const existing = await Product.findById(productId).session(session ?? null).lean();
    if (!existing) throw notFoundError("Product");
    throw new AppError(
      "INSUFFICIENT_STOCK",
      `Not enough stock of ${existing.name} (${existing.stockQty} on hand, ${-input.qty} needed).`,
    );
  }

  await StockMove.create(
    [
      {
        productId,
        sku: product.sku,
        qty: input.qty,
        type: input.type,
        serials: input.serials ?? [],
        refType: input.refType,
        refId: input.refId ? toObjectId(input.refId) : undefined,
        refNumber: input.refNumber,
        note: input.note,
        by: input.actor ? actorRef(input.actor) : undefined,
        at: input.at ?? new Date(),
      },
    ],
    { session },
  );

  return product;
}
