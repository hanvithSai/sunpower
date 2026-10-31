/**
 * Cookie consent (product/Analytics.md §3): analytics is opt-in, a choice
 * lasts 12 months and one policy version, and browser privacy signals count
 * as a rejection until the visitor explicitly accepts.
 */
import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, consentRecord, consentStatus } from "@/lib/consent";

const now = new Date("2026-11-01T10:00:00Z");
const stored = (analytics: string, at: string, v = CONSENT_VERSION) => JSON.stringify({ v, analytics, at });

describe("consentStatus", () => {
  it("asks when nothing is stored, unless the browser already said no", () => {
    expect(consentStatus(null, now, false)).toBe("pending");
    expect(consentStatus(null, now, true)).toBe("denied");
  });

  it("keeps a recent choice, and an explicit yes beats a privacy signal", () => {
    expect(consentStatus(stored("granted", "2026-10-01T00:00:00Z"), now, false)).toBe("granted");
    expect(consentStatus(stored("granted", "2026-10-01T00:00:00Z"), now, true)).toBe("granted");
    expect(consentStatus(stored("denied", "2026-10-01T00:00:00Z"), now, false)).toBe("denied");
  });

  it("asks again after 12 months, after a policy version change, or if the record is unreadable", () => {
    expect(consentStatus(stored("granted", "2025-10-01T00:00:00Z"), now, false)).toBe("pending");
    expect(consentStatus(stored("granted", "2026-10-01T00:00:00Z", CONSENT_VERSION - 1), now, false)).toBe("pending");
    expect(consentStatus("{not json", now, false)).toBe("pending");
    expect(consentStatus(stored("maybe", "2026-10-01T00:00:00Z"), now, false)).toBe("pending");
  });

  it("round-trips the record it writes", () => {
    expect(consentStatus(JSON.stringify(consentRecord("granted", now)), now, false)).toBe("granted");
  });
});
