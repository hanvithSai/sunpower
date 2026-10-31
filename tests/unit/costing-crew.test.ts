/**
 * Profit per job from actuals (F14) and crew choice (BR-07). Both rules are
 * pure; the services only gather the numbers from the database.
 */
import { describe, expect, it } from "vitest";
import { costFromActuals, isWarrantyCost, type CostingOrder } from "@/lib/costing";
import { chooseCrew, isSundayIST } from "@/lib/crew";
import { addDays } from "@/lib/dates";

const ORDER: CostingOrder = {
  taxablePaise: 20_000_000, // ₹2,00,000 excl. GST
  lines: [
    { sku: "PNL", qty: 6, unitCostPaise: 1_150_000, isSerialized: true, category: "panel" },
    { sku: "INV", qty: 1, unitCostPaise: 3_300_000, isSerialized: true, category: "inverter" },
    { sku: "CBL", qty: 30, unitCostPaise: 6_000, isSerialized: false, category: "cable" },
    { sku: "INS", qty: 1, unitCostPaise: 0, isSerialized: false, category: "service" },
  ],
  pickList: [],
  extraCosts: [],
};

describe("costFromActuals (F14)", () => {
  it("estimates material from the quote until anything is dispatched", () => {
    const c = costFromActuals(ORDER, { timeLogs: [] });
    expect(c.estimated).toBe(true);
    expect(c.materialPaise).toBe(6 * 1_150_000 + 3_300_000 + 30 * 6_000);
    expect(c.profitPaise).toBe(20_000_000 - c.materialPaise);
  });

  it("uses each serial's GRN cost and the picked bulk quantities once packed", () => {
    const packed = { ...ORDER, pickList: [{ sku: "PNL", qty: 6, isSerialized: true }, { sku: "CBL", qty: 40, isSerialized: false }] };
    const c = costFromActuals(packed, { serialCostPaise: 10_050_000, timeLogs: [] });
    expect(c.estimated).toBe(false);
    expect(c.materialPaise).toBe(10_050_000 + 40 * 6_000);
  });

  it("charges labour at each technician's rate", () => {
    const c = costFromActuals(ORDER, {
      serialCostPaise: 0,
      timeLogs: [
        { hours: 6.5, hourlyRatePaise: 25_000 },
        { hours: 6.5, hourlyRatePaise: 20_000 },
        { hours: 0.25, hourlyRatePaise: 33_333 },
      ],
    });
    expect(c.labourHours).toBe(13.25);
    expect(c.labourPaise).toBe(162_500 + 130_000 + 8_333);
  });

  it("splits roof extras from warranty repairs, including entries written before `kind` existed", () => {
    const withExtras = {
      ...ORDER,
      extraCosts: [
        { label: "Extra DC cable 40 m", amountPaise: 240_000, kind: "site" },
        { label: "Warranty repair SP-T-0004", amountPaise: 3_500_000 },
        { label: "Inverter swap", amountPaise: 500_000, kind: "warranty" },
      ],
    };
    const c = costFromActuals(withExtras, { serialCostPaise: 10_000_000, timeLogs: [] });
    expect(c.sitePaise).toBe(240_000);
    expect(c.warrantyPaise).toBe(4_000_000);
    expect(isWarrantyCost({ label: "Warranty repair X" })).toBe(true);
    expect(isWarrantyCost({ label: "Scaffolding", kind: "site" })).toBe(false);
  });

  it("shows a loss when a free inverter replacement outweighs the margin", () => {
    const c = costFromActuals(
      { ...ORDER, extraCosts: [{ label: "Warranty repair", amountPaise: 9_570_000, kind: "warranty" }] },
      { serialCostPaise: 10_200_000, timeLogs: [{ hours: 18, hourlyRatePaise: 25_000 }] },
    );
    expect(c.costPaise).toBe(10_200_000 + 30 * 6_000 + 450_000 + 9_570_000);
    expect(c.profitPaise).toBeLessThan(0);
    expect(c.profitPaise).toBe(-400_000);
    expect(c.marginPct).toBe(-2);
  });

  it("reports a zero margin on a zero-value order instead of dividing by zero", () => {
    expect(costFromActuals({ ...ORDER, taxablePaise: 0, lines: [] }, { timeLogs: [] }).marginPct).toBe(0);
  });
});

// Mon 2 Nov 2026, IST midnight.
const MONDAY = new Date("2026-11-01T18:30:00Z");
const crewOf = (...names: string[]) => names.map((name) => ({ _id: name, name }));
const TEAM = crewOf("Anil", "Bhaskar", "Chandu", "Deepak", "Esha");

describe("chooseCrew (BR-07)", () => {
  it("knows Sunday in IST", () => {
    expect(isSundayIST(addDays(MONDAY, -1))).toBe(true);
    expect(isSundayIST(MONDAY)).toBe(false);
  });

  it("takes the three least-loaded installers who are free that day", () => {
    const pick = chooseCrew(TEAM, {
      firstDay: MONDAY,
      load: new Map([["Anil", 4], ["Bhaskar", 1], ["Chandu", 0], ["Deepak", 2], ["Esha", 0]]),
      busyOn: () => new Set(["Esha"]),
    });
    expect(pick.crew.map((c) => c.name)).toEqual(["Chandu", "Bhaskar", "Deepak"]);
    expect(pick.day).toEqual(MONDAY);
    expect(pick.doubleBooked).toBe(false);
  });

  it("moves to the next day when fewer than three are free, never double-booking", () => {
    const pick = chooseCrew(TEAM, {
      firstDay: MONDAY,
      load: new Map(),
      busyOn: (day) => (day.getTime() === MONDAY.getTime() ? new Set(["Anil", "Bhaskar", "Chandu"]) : new Set()),
    });
    expect(pick.day).toEqual(addDays(MONDAY, 1));
    expect(pick.crew.map((c) => c.name)).toEqual(["Anil", "Bhaskar", "Chandu"]);
  });

  it("skips Sunday", () => {
    const saturday = addDays(MONDAY, 5);
    const pick = chooseCrew(TEAM, {
      firstDay: saturday,
      load: new Map(),
      busyOn: (day) => (day.getTime() === saturday.getTime() ? new Set(["Anil", "Bhaskar", "Chandu"]) : new Set()),
    });
    expect(pick.day).toEqual(addDays(saturday, 2)); // Monday, not Sunday
  });

  it("falls back to the preferred day and flags it when nobody is free for two weeks", () => {
    const pick = chooseCrew(TEAM, { firstDay: MONDAY, load: new Map([["Esha", 9]]), busyOn: () => new Set(["Anil", "Bhaskar", "Chandu"]) });
    expect(pick.doubleBooked).toBe(true);
    expect(pick.day).toEqual(MONDAY);
    expect(pick.crew.map((c) => c.name)).toEqual(["Anil", "Bhaskar", "Chandu"]);
  });

  it("books a smaller crew when the team is smaller, and nobody when there is no installer", () => {
    expect(chooseCrew(crewOf("Anil", "Bhaskar"), { firstDay: MONDAY, load: new Map(), busyOn: () => new Set() }).crew).toHaveLength(2);
    expect(chooseCrew([], { firstDay: MONDAY, load: new Map(), busyOn: () => new Set() })).toMatchObject({ crew: [], doubleBooked: false });
  });
});
