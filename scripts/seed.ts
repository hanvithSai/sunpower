/**
 * Demo data seeder.
 *
 *   npm run seed              local database (npm run db:local)
 *   npm run seed -- --yes     required for a remote database such as Atlas
 *
 * Phase 0 scope: builds every collection's indexes and creates/updates the
 * staff accounts (idempotent upsert by email — nothing is deleted). Later
 * phases extend this script with the catalog, customers, pipeline, orders,
 * inventory, service and finance data described in Plan.md §6.
 */
import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { User } from "@/server/models";
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

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
