/**
 * Turn a MongoDB connection failure into a safe, actionable category.
 *
 * The health endpoint reports this category instead of the raw error, so a
 * broken deployment can be diagnosed with one request without ever exposing
 * the connection string. (Background: the production sign-in incident in
 * engineering/Engineering.md had to be diagnosed from response timings.)
 */

export type DbFailureReason = "uri_missing" | "uri_invalid" | "auth_failed" | "dns" | "timeout" | "unknown";

export const DB_FAILURE_HINTS: Record<DbFailureReason, string> = {
  uri_missing: "MONGODB_URI is not set for this deployment. Add it in the hosting settings and redeploy.",
  uri_invalid: "MONGODB_URI is not a valid connection string. Check for quotes, spaces or placeholders.",
  auth_failed: "MongoDB rejected the username or password in MONGODB_URI.",
  dns: "The cluster hostname in MONGODB_URI could not be resolved.",
  timeout: "MongoDB could not be reached in time. Check Atlas Network Access and that the cluster is running.",
  unknown: "Unexpected database error. Check the server logs.",
};

export function classifyDbError(error: unknown): DbFailureReason {
  const err = (error ?? {}) as { name?: unknown; message?: unknown; code?: unknown; codeName?: unknown };
  const name = String(err.name ?? "");
  const message = String(err.message ?? error ?? "");

  if (message.includes("MONGODB_URI is not set")) return "uri_missing";
  if (name === "MongoParseError" || /invalid scheme|invalid connection string|uri must include|malformed/i.test(message)) {
    return "uri_invalid";
  }
  // Atlas answers wrong credentials with "bad auth : authentication failed" (code 8000); self-hosted uses code 18.
  if (err.code === 18 || err.codeName === "AuthenticationFailed" || /bad auth|authentication failed/i.test(message)) {
    return "auth_failed";
  }
  if (/querySrv|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return "dns";
  if (/ServerSelection/i.test(name) || /timed out|ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(message)) return "timeout";
  return "unknown";
}
