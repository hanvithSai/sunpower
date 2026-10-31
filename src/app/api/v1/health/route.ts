/**
 * Liveness + database check for uptime monitors and post-deploy smoke tests.
 *
 *   200 { status: "ok",       db: "up",   latencyMs, time, version, region }
 *   503 { status: "degraded", db: "down", reason, hint, time, version, region }
 *
 * `version` is the deployed Git commit and `region` the serverless region
 * (bom1 = Mumbai), so one request proves which build is live and where.
 * `reason` is a safe category from classifyDbError — never the connection
 * string or the raw driver message.
 */
import mongoose from "mongoose";
import { connection } from "next/server";
import { connectDB } from "@/server/db";
import { DB_FAILURE_HINTS, classifyDbError } from "@/server/lib/db-errors";

export async function GET() {
  await connection(); // always run at request time
  const started = Date.now();
  const deployment = {
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    region: process.env.VERCEL_REGION ?? "local",
  };

  try {
    await connectDB();
    await mongoose.connection.db!.admin().ping();
    return Response.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
      ...deployment,
    });
  } catch (error) {
    const reason = classifyDbError(error);
    console.error("[health] database check failed", { reason, error: error instanceof Error ? error.message : String(error) });
    return Response.json(
      {
        status: "degraded",
        db: "down",
        reason,
        hint: DB_FAILURE_HINTS[reason],
        time: new Date().toISOString(),
        ...deployment,
      },
      { status: 503 },
    );
  }
}
