/**
 * Helpers for `/api/v1/*` route handlers: consistent JSON errors
 * `{ error: { code, message, fieldErrors? } }` and role checks.
 *
 *   export const GET = apiHandler(async (req) => {
 *     const user = await requireApiUser(["support"]);   // reads cookies first (Cache Components)
 *     return Response.json({ ... });
 *   });
 */
import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { Role } from "@/lib/constants";
import { canAccess } from "@/lib/navigation";
import { getCurrentUser, type SessionUser } from "../auth/session";
import { connectDB } from "../db";
import { AppError, isDuplicateKeyError } from "../errors";

export type HandlerContext<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

export function apiHandler<P extends Record<string, string> = Record<string, string>>(
  handler: (request: Request, context: HandlerContext<P>) => Promise<Response>,
) {
  return async (request: Request, context: HandlerContext<P>): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      unstable_rethrow(error);
      return jsonError(error);
    }
  };
}

export function jsonError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors } },
      { status: error.status },
    );
  }
  if (isDuplicateKeyError(error)) {
    return Response.json({ error: { code: "CONFLICT", message: "Duplicate record" } }, { status: 409 });
  }
  console.error("[api] unexpected error", error);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

/** Signed-in user (optionally restricted to roles) or a 401/403 AppError. Also connects the DB. */
export async function requireApiUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "Sign in required");
  if (roles && !canAccess(user.role, roles)) throw new AppError("FORBIDDEN", "Not allowed");
  await connectDB();
  return user;
}

/** Read a JSON body safely (400 on malformed JSON). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON");
  }
}

/** Best-effort client IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
