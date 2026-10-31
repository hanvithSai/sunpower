/**
 * Liveness + database check for uptime monitors and CI smoke tests.
 * GET /api/v1/health -> 200 { status: "ok", db: "up", latencyMs } or 503.
 */
import mongoose from "mongoose";
import { connection } from "next/server";
import { connectDB } from "@/server/db";

export async function GET() {
  await connection(); // always run at request time
  const started = Date.now();
  try {
    await connectDB();
    await mongoose.connection.db!.admin().ping();
    return Response.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
