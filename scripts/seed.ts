/**
 * Demo data seeder.
 *
 *   npm run seed              local database (npm run db:local)
 *   npm run seed -- --yes     required for a remote database such as Atlas
 *
 * Idempotent, never deletes: upserts the staff accounts (by email) and the
 * catalog — products (by SKU), the ten 1–5 kW packages (by code) and opening
 * stock for bulk items that have never moved (with matching ledger entries) —
 * and goods receipts with serial numbers (skipped when the supplier invoice is
 * already on file). Later phases add customers, pipeline, orders, service and
 * finance data described in Plan.md §6.
 */
import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { addDays } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import { connectDB } from "@/server/db";
import { actorRef } from "@/server/lib/actor";
import { Package, Product, Purchase, StockMove, User } from "@/server/models";
import { receiveGoods } from "@/server/services/inventory";
import { PACKAGES, PRODUCTS } from "./seed/catalog";
import { seedHistory } from "./seed/history";
import { GRNS, grnSerials } from "./seed/inventory";
import { DEMO_PASSWORD, STAFF } from "./seed/users";

// connectDB() reads MONGODB_URI lazily, so loading .env.local here is in time.
loadEnvConfig(process.cwd());

function isLocalUri(uri: string): boolean {
  return /^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(uri);
}

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  if (!uri) throw new Error("MONGODB_URI is not set — see Setup.md");
  if (!isLocalUri(uri) && !process.argv.includes("--yes")) {
    console.error("Refusing to seed a remote database without confirmation. Run: npm run seed -- --yes");
    process.exit(1);
  }

  await connectDB();
  console.log(`Connected to ${mongoose.connection.host} / ${mongoose.connection.name}`);

  // Unique email index first; other collections build their indexes on first use (autoIndex).
  await User.createIndexes();

  // One bulk round trip — far faster than 20 sequential upserts on a slow network.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const result = await User.bulkWrite(
    STAFF.map((staff) => ({
      updateOne: {
        filter: { email: staff.email },
        update: {
          $set: {
            name: staff.name,
            phone: staff.phone,
            role: staff.role,
            passwordHash,
            hourlyRatePaise: staff.hourlyRateRs * 100,
            skills: staff.skills,
            active: true,
          },
        },
        upsert: true,
      },
    })),
  );
  console.log(`Staff accounts: ${result.upsertedCount} created, ${result.modifiedCount} updated`);

  await seedCatalog();
  await seedPurchases();
  console.log(await seedHistory());

  const byRole = await User.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$role", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.table(byRole.map((r) => ({ role: r._id, accounts: r.count })));
  console.log("\nDemo logins (password for all: %s)", DEMO_PASSWORD);
  for (const email of ["director", "sales", "tech", "warehouse", "support"]) {
    console.log(`  ${email}@sunpower.demo`);
  }

  await mongoose.disconnect();
}

/** Products, packages and opening stock — all bulk writes (few round trips on slow networks). */
async function seedCatalog() {
  await Promise.all([Product.createIndexes(), Package.createIndexes()]);
  const director = await User.findOne({ role: "admin" }).select("name").lean();
  if (!director) throw new Error("Seed staff first: no admin user found");

  await Product.bulkWrite(
    PRODUCTS.map((p) => ({
      updateOne: {
        filter: { sku: p.sku },
        update: {
          $set: {
            name: p.name,
            brand: p.brand,
            category: p.category,
            unit: p.unit,
            isSerialized: p.isSerialized,
            specs: p.specs,
            costPaise: p.costRs * 100,
            pricePaise: p.priceRs * 100,
            gstRate: p.gstRate,
            hsn: p.hsn,
            warrantyMonths: p.warrantyMonths,
            reorderLevel: p.reorderLevel,
            active: true,
          },
          $setOnInsert: { stockQty: 0 },
        },
        upsert: true,
      },
    })),
  );
  const products = await Product.find({ sku: { $in: PRODUCTS.map((p) => p.sku) } }).select("sku").lean();
  const idBySku = new Map(products.map((p) => [p.sku, p._id]));

  // Opening stock only for bulk items with no ledger history yet, so re-runs never double count.
  const moved = new Set((await StockMove.distinct("productId")).map(String));
  const opening = PRODUCTS.filter((p) => p.openingStock && !moved.has(String(idBySku.get(p.sku))));
  if (opening.length > 0) {
    await Product.bulkWrite(
      opening.map((p) => ({ updateOne: { filter: { sku: p.sku }, update: { $inc: { stockQty: p.openingStock! } } } })),
    );
    await StockMove.insertMany(
      opening.map((p) => ({
        productId: idBySku.get(p.sku),
        sku: p.sku,
        qty: p.openingStock!,
        type: "adjustment",
        serials: [],
        refType: "manual",
        note: "Opening stock",
        by: actorRef({ id: String(director._id), name: director.name }),
        at: new Date(),
      })),
    );
  }

  await Package.bulkWrite(
    PACKAGES.map((pkg) => ({
      updateOne: {
        filter: { code: pkg.code },
        update: {
          $set: {
            name: pkg.name,
            systemType: pkg.systemType,
            capacityKw: pkg.capacityKw,
            description: pkg.description,
            lines: pkg.lines.map((l) => {
              const productId = idBySku.get(l.sku);
              if (!productId) throw new Error(`Package ${pkg.code} references unknown SKU ${l.sku}`);
              return { productId, qty: l.qty };
            }),
            active: true,
          },
        },
        upsert: true,
      },
    })),
  );
  console.log(`Catalog: ${PRODUCTS.length} products, ${PACKAGES.length} packages, opening stock for ${opening.length} bulk items`);
}

/** Goods receipts through the real service, so ledger, serial units and costs match what the app does. */
async function seedPurchases() {
  const keeper = await User.findOne({ role: "warehouse" }).select("name").lean();
  if (!keeper) throw new Error("Seed staff first: no warehouse user found");
  const actor = { id: String(keeper._id), name: keeper.name };
  const products = await Product.find({ sku: { $in: GRNS.flatMap((g) => g.lines.map((l) => l.sku)) } }).select("sku").lean();
  const idBySku = new Map(products.map((p) => [p.sku, String(p._id)]));

  let received = 0;
  let units = 0;
  for (const grn of GRNS) {
    if (await Purchase.exists({ invoiceNo: grn.invoiceNo, "supplier.name": grn.supplierName })) continue;
    const at = addDays(new Date(), -grn.daysAgo);
    const result = await receiveGoods(
      {
        supplierName: grn.supplierName,
        supplierGstin: grn.supplierGstin,
        invoiceNo: grn.invoiceNo,
        invoiceDate: toDateInputValue(addDays(at, -1)),
        notes: undefined,
        lines: grn.lines.map((l) => {
          const productId = idBySku.get(l.sku);
          if (!productId) throw new Error(`GRN ${grn.invoiceNo} references unknown SKU ${l.sku}`);
          return { productId, qty: l.qty, unitCostRs: l.unitCostRs, serials: l.serialPrefix ? grnSerials(l.serialPrefix, l.qty) : [] };
        }),
      },
      actor,
      { at },
    );
    received += 1;
    units += result.serials;
  }
  console.log(`Goods receipts: ${received} received (${units} serialized units), ${GRNS.length - received} already on file`);
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
