/**
 * Tiny fixed-window rate limiter for public endpoints (enquiry form, warranty
 * lookup). In-memory per server instance — good enough to stop casual spam on
 * a free tier; swap for a shared store (e.g. Upstash) if abuse appears.
 */
import { AppError } from "../errors";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests — please try again in a minute.");
  }
}
