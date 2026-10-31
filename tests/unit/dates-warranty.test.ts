/**
 * Time rules: IST day, week and month windows for the dashboard, the Indian
 * financial year on invoice numbers, and warranty clocks — per serial from
 * delivery, and workmanship from commissioning (BR-03, BR-04).
 */
import { describe, expect, it } from "vitest";
import { financialYear, getPreviousRange, getRange, startOfDayIST } from "@/lib/dates";
import { addMonths, formatSpan, getWarrantyInfo, workmanshipEnd } from "@/lib/warranty";

const at = (iso: string) => new Date(iso);

describe("IST date windows", () => {
  it("starts the day at IST midnight, not UTC midnight", () => {
    // 01:30 IST on Sunday 1 Nov is still 31 Oct in UTC.
    expect(startOfDayIST(at("2026-10-31T20:00:00Z")).toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(startOfDayIST(at("2026-10-31T10:00:00Z")).toISOString()).toBe("2026-10-30T18:30:00.000Z");
  });

  it("runs weeks Monday to Sunday in IST", () => {
    const sunday = getRange("week", at("2026-10-31T20:00:00Z")); // Sun 1 Nov, 01:30 IST
    expect(sunday.start.toISOString()).toBe("2026-10-25T18:30:00.000Z"); // Mon 26 Oct IST
    expect(sunday.end.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    const previous = getPreviousRange("week", at("2026-10-31T10:00:00Z"));
    expect(previous.start.toISOString()).toBe("2026-10-18T18:30:00.000Z");
    expect(previous.end.toISOString()).toBe("2026-10-25T18:30:00.000Z");
  });

  it("puts a late-night IST sale in the right month", () => {
    const november = getRange("month", at("2026-10-31T20:00:00Z"));
    expect(november.start.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(november.end.toISOString()).toBe("2026-11-30T18:30:00.000Z");
    const september = getPreviousRange("month", at("2026-10-31T10:00:00Z"));
    expect(september.start.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(september.end.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("turns the financial year over on 1 April IST", () => {
    expect(financialYear(at("2026-03-31T10:00:00Z"))).toBe("25-26");
    expect(financialYear(at("2026-03-31T20:00:00Z"))).toBe("26-27"); // 1 Apr, 01:30 IST
    expect(financialYear(at("2026-10-31T10:00:00Z"))).toBe("26-27");
  });
});

describe("warranty clock", () => {
  it("adds months without spilling into the next month", () => {
    expect(addMonths(at("2026-01-31T06:00:00Z"), 1).toISOString()).toBe("2026-02-28T06:00:00.000Z");
    expect(addMonths(at("2028-01-31T06:00:00Z"), 1).toISOString()).toBe("2028-02-29T06:00:00.000Z");
    expect(addMonths(at("2024-02-29T06:00:00Z"), 12).toISOString()).toBe("2025-02-28T06:00:00.000Z");
    expect(addMonths(at("2026-10-31T06:00:00Z"), 240).toISOString()).toBe("2046-10-31T06:00:00.000Z");
  });

  const now = at("2026-10-31T06:00:00Z");

  it("shows the brief's 18-month-old inverter with about 6 months left", () => {
    const delivered = at("2025-04-30T06:00:00Z");
    const info = getWarrantyInfo(delivered, addMonths(delivered, 24), now);
    expect(info.state).toBe("in_warranty");
    expect(info.daysLeft).toBe(181);
    expect(info.label).toBe("In warranty · 6 mo left");
  });

  it("shows a 28-month-old inverter as expired while its panels are still covered", () => {
    const delivered = at("2024-06-30T06:00:00Z");
    const inverter = getWarrantyInfo(delivered, addMonths(delivered, 24), now);
    expect(inverter.state).toBe("out_of_warranty");
    expect(inverter.label).toBe("Expired 4 mo ago");
    const panel = getWarrantyInfo(delivered, addMonths(delivered, 240), now);
    expect(panel.state).toBe("in_warranty");
    expect(panel.label).toBe("In warranty · 17 yr 8 mo left");
  });

  it("covers the unit up to the end moment and not a millisecond after", () => {
    expect(getWarrantyInfo(now, now, now).state).toBe("in_warranty");
    const justExpired = getWarrantyInfo(at("2024-10-31T06:00:00Z"), new Date(now.getTime() - 1), now);
    expect(justExpired.state).toBe("out_of_warranty");
    expect(justExpired.daysLeft).toBe(-1);
    expect(justExpired.label).toBe("Expired 1 day ago");
  });

  it("hasn't started before delivery", () => {
    expect(getWarrantyInfo(null, null, now)).toMatchObject({ state: "not_started", endsAt: null });
  });

  it("reads spans in days, then months and years", () => {
    expect(formatSpan(1)).toBe("1 day");
    expect(formatSpan(20)).toBe("20 days");
    expect(formatSpan(500)).toBe("1 yr 4 mo");
    expect(formatSpan(730)).toBe("2 yr");
  });
});

describe("workmanship warranty (no-serial faults)", () => {
  const lines = [
    { category: "panel", warrantyMonths: 240 },
    { category: "service", warrantyMonths: 60 },
  ];

  it("runs for the installation line's months from commissioning", () => {
    expect(workmanshipEnd({ lines, commissionedAt: at("2024-10-31T06:00:00Z") })?.toISOString()).toBe("2029-10-31T06:00:00.000Z");
  });

  it("doesn't exist before commissioning or without an installation line", () => {
    expect(workmanshipEnd({ lines })).toBeUndefined();
    expect(workmanshipEnd({ lines: [lines[0]], commissionedAt: at("2024-10-31T06:00:00Z") })).toBeUndefined();
  });

  it("takes the longest cover when several service lines were sold", () => {
    const end = workmanshipEnd({ lines: [...lines, { category: "service", warrantyMonths: 12 }], commissionedAt: at("2024-10-31T06:00:00Z") });
    expect(end?.toISOString()).toBe("2029-10-31T06:00:00.000Z");
  });
});
