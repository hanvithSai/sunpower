/**
 * classifyDbError maps real MongoDB driver failures to the safe categories the
 * health endpoint reports. Messages below are copied from actual errors seen
 * against Atlas (wrong password, quoted URI, mistyped host).
 */
import { describe, expect, it } from "vitest";
import { classifyDbError } from "@/server/lib/db-errors";

function driverError(name: string, message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { name, ...extra });
}

describe("classifyDbError", () => {
  it("detects a missing connection string", () => {
    expect(classifyDbError(new Error("MONGODB_URI is not set. Copy .env.example to .env.local — see Setup.md."))).toBe("uri_missing");
  });

  it("detects a malformed or quoted connection string", () => {
    const error = driverError("MongoParseError", 'Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"');
    expect(classifyDbError(error)).toBe("uri_invalid");
  });

  it("detects rejected credentials (Atlas and self-hosted)", () => {
    expect(classifyDbError(driverError("MongoServerError", "bad auth : authentication failed", { code: 8000, codeName: "AtlasError" }))).toBe(
      "auth_failed",
    );
    expect(classifyDbError(driverError("MongoServerError", "Authentication failed.", { code: 18, codeName: "AuthenticationFailed" }))).toBe(
      "auth_failed",
    );
  });

  it("detects an unresolvable cluster hostname", () => {
    expect(classifyDbError(new Error("querySrv ENOTFOUND _mongodb._tcp.sunpower.zzzzzz.mongodb.net"))).toBe("dns");
  });

  it("detects an unreachable cluster", () => {
    const error = driverError("MongooseServerSelectionError", "Could not connect to any servers in your MongoDB Atlas cluster.");
    expect(classifyDbError(error)).toBe("timeout");
  });

  it("falls back to unknown without throwing on odd inputs", () => {
    expect(classifyDbError(new Error("something else"))).toBe("unknown");
    expect(classifyDbError(undefined)).toBe("unknown");
    expect(classifyDbError("plain string")).toBe("unknown");
  });
});
