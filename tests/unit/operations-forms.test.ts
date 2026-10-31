/**
 * The warehouse and crew forms post FormData (or JSON) that goes through
 * formToObject + Zod before any service runs. These tests feed the schemas
 * exactly what the browser sends, so a renamed field or a checkbox quirk
 * fails here rather than on a rooftop. Packing progress is the rule behind
 * the dispatch gate (BR-02).
 */
import { describe, expect, it } from "vitest";
import { CompleteJobSchema, RescheduleJobSchema } from "@/lib/validation/jobs";
import { DispatchOrderSchema, ReceiveGoodsSchema, ScanSerialSchema, splitSerials } from "@/lib/validation/inventory";
import { formToObject } from "@/server/lib/validate";
import { packingProgress } from "@/server/services/dispatch";

const ID = "6ae5c5a8e2fde1b3dd16fa7a";
const PHOTO = "6ae5c5a8e2fde1b3dd16fa7b";
const SIGNATURE = "data:image/png;base64,iVBORw0KGgo=";

function form(fields: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v);
  return fd;
}

/** What the completion form posts when every box is ticked (checkboxes send "on"). */
function completionForm(overrides: Record<string, string | null> = {}): FormData {
  const base: Record<string, string> = {
    jobId: ID,
    extras: "[]",
    startedAt: "2026-10-31T09:30",
    finishedAt: "2026-10-31T15:00",
    confirmedKw: "3",
    generationReadingKw: "2.4",
    mounting: "on",
    panels: "on",
    wiring: "on",
    earthing: "on",
    inverter: "on",
    generationTested: "on",
    kitComplete: "on",
    photos: PHOTO,
    signature: SIGNATURE,
    signedBy: "Lakshmi Narayana",
    customerRemarks: "",
    notes: "",
  };
  const entries = Object.entries({ ...base, ...overrides }).filter((e): e is [string, string] => e[1] !== null);
  return form(entries);
}

describe("CompleteJobSchema (BR-14 completion form)", () => {
  it("accepts a complete form and coerces checkboxes, numbers and JSON extras", () => {
    const fd = completionForm({ extras: JSON.stringify([{ productId: ID, qty: "12" }]) });
    const parsed = CompleteJobSchema.safeParse(formToObject(fd));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.confirmedKw).toBe(3);
    expect(parsed.data.generationTested).toBe(true);
    expect(parsed.data.photos).toEqual([PHOTO]);
    expect(parsed.data.extras).toEqual([{ productId: ID, qty: 12 }]);
    expect(parsed.data.customerRemarks).toBeUndefined();
  });

  it("collects several photos posted under the same name", () => {
    const fd = completionForm();
    fd.append("photos", "6ae5c5a8e2fde1b3dd16fa7c");
    const parsed = CompleteJobSchema.parse(formToObject(fd));
    expect(parsed.photos).toHaveLength(2);
  });

  it("refuses to complete without the generation test", () => {
    const result = CompleteJobSchema.safeParse(formToObject(completionForm({ generationTested: null })));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "generationTested")).toBe(true);
  });

  it("refuses an empty signature or no photos", () => {
    expect(CompleteJobSchema.safeParse(formToObject(completionForm({ signature: "" }))).success).toBe(false);
    expect(CompleteJobSchema.safeParse(formToObject(completionForm({ photos: null }))).success).toBe(false);
  });

  it("needs the missing items when the kit wasn't complete", () => {
    const result = CompleteJobSchema.safeParse(formToObject(completionForm({ kitComplete: null })));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["missingItems"]);
    expect(CompleteJobSchema.safeParse(formToObject(completionForm({ kitComplete: null, missingItems: "1 MC4 pair" }))).success).toBe(true);
  });

  it("blocks submit while photos are still uploading", () => {
    const result = CompleteJobSchema.safeParse(formToObject(completionForm({ photos__uploading: "1" })));
    expect(result.success).toBe(false);
  });

  it("needs a note for any other site cost", () => {
    expect(CompleteJobSchema.safeParse(formToObject(completionForm({ extraCostRs: "800" }))).success).toBe(false);
    expect(CompleteJobSchema.safeParse(formToObject(completionForm({ extraCostRs: "800", extraCostNote: "Crane" }))).success).toBe(true);
  });
});

describe("RescheduleJobSchema", () => {
  it("reads the crew checkboxes as a list", () => {
    const fd = form([
      ["jobId", ID],
      ["scheduledFor", "2026-11-05T09:30"],
      ["technicianIds", ID],
      ["technicianIds", PHOTO],
      ["leadTechnicianId", ""],
    ]);
    const parsed = RescheduleJobSchema.parse(formToObject(fd));
    expect(parsed.technicianIds).toEqual([ID, PHOTO]);
    expect(parsed.leadTechnicianId).toBeUndefined();
  });

  it("needs at least one technician", () => {
    expect(RescheduleJobSchema.safeParse({ jobId: ID, scheduledFor: "2026-11-05T09:30" }).success).toBe(false);
  });
});

describe("warehouse forms", () => {
  it("splits pasted serial lists and normalises case", () => {
    expect(splitSerials(" waa545-2609-0001, WAA545-2609-0002\nwaa545-2609-0003\t ")).toEqual(["WAA545-2609-0001", "WAA545-2609-0002", "WAA545-2609-0003"]);
  });

  it("upper-cases a scanned serial and rejects junk", () => {
    expect(ScanSerialSchema.parse({ orderId: ID, serial: " grw3k-2610-0001 " }).serial).toBe("GRW3K-2610-0001");
    expect(ScanSerialSchema.safeParse({ orderId: ID, serial: "<script>" }).success).toBe(false);
  });

  it("validates a goods receipt with a supplier GSTIN", () => {
    const ok = ReceiveGoodsSchema.safeParse({
      supplierName: "Waaree Energies Ltd",
      supplierGstin: "24aaacw4537n1zd",
      invoiceNo: "WEL/1",
      invoiceDate: "2026-10-30",
      lines: [{ productId: ID, qty: "2", unitCostRs: "12100", serials: ["a-1", "a-2"] }],
    });
    expect(ok.success).toBe(true);
    expect(ok.data?.supplierGstin).toBe("24AAACW4537N1ZD");
    expect(ok.data?.lines[0]?.serials).toEqual(["A-1", "A-2"]);
    expect(ReceiveGoodsSchema.safeParse({ supplierName: "X", invoiceNo: "1", invoiceDate: "2026-10-30", lines: [] }).success).toBe(false);
  });

  it("upper-cases the vehicle number on dispatch", () => {
    expect(DispatchOrderSchema.parse({ orderId: ID, vehicleNo: "ts09ea1234", driverName: "Raju" }).vehicleNo).toBe("TS09EA1234");
  });
});

describe("packingProgress (dispatch gate, BR-02)", () => {
  const panel = { qty: 6, isSerialized: true, serials: ["A", "B", "C", "D", "E", "F"], picked: false };
  const inverter = { qty: 1, isSerialized: true, serials: [] as string[], picked: false };
  const cable = { qty: 35, isSerialized: false, serials: [] as string[], picked: true };

  it("is incomplete while a serial is missing", () => {
    const p = packingProgress([panel, inverter, cable]);
    expect(p).toMatchObject({ serialRequired: 7, serialScanned: 6, bulkLines: 1, bulkPicked: 1, complete: false });
  });

  it("is incomplete while a bulk line is unticked", () => {
    expect(packingProgress([panel, { ...cable, picked: false }]).complete).toBe(false);
  });

  it("is complete when every unit is scanned and every bulk line ticked", () => {
    expect(packingProgress([panel, { ...inverter, serials: ["G"] }, cable]).complete).toBe(true);
  });
});
