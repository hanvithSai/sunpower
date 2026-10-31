/**
 * Finance extras: the CSV writer (quoting and formula-injection guard), the
 * subsidy feasibility warning, and the subsidy document form as the browser
 * posts it (photo ids from <MediaUploader>).
 */
import { describe, expect, it } from "vitest";
import { feasibilityPending } from "@/lib/subsidy";
import { AddSubsidyDocumentSchema } from "@/lib/validation/finance";
import { toCsv } from "@/server/lib/csv";
import { formToObject } from "@/server/lib/validate";

const ID = "6ae5c5a8e2fde1b3dd16fa7a";
const FILE = "6ae5c5a8e2fde1b3dd16fa7b";

function form(fields: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v);
  return fd;
}

describe("toCsv", () => {
  const body = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

  it("quotes commas, quotes and new lines", () => {
    expect(body(toCsv(["a"], [['Rao, "Ravi"']]))[1]).toBe('"Rao, ""Ravi"""');
  });

  it("never lets a typed name run as a spreadsheet formula", () => {
    const [, row] = body(toCsv(["name", "amount"], [["=HYPERLINK(\"http://x\")", -1200]]));
    expect(row!.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(row!.endsWith(",-1200")).toBe(true); // numbers stay numbers
  });

  it("writes dates as YYYY-MM-DD", () => {
    expect(body(toCsv(["d"], [[new Date("2026-10-31T10:00:00Z")]]))[1]).toBe("2026-10-31");
  });
});

describe("feasibilityPending (F16)", () => {
  it("warns until the DISCOM approves feasibility", () => {
    expect(feasibilityPending({ applicable: true, status: "not_applied" })).toBe(true);
    expect(feasibilityPending({ applicable: true, status: "applied" })).toBe(true);
    expect(feasibilityPending({ applicable: true, status: "feasibility_approved" })).toBe(false);
    expect(feasibilityPending({ applicable: false, status: "not_applicable" })).toBe(false);
  });
});

describe("AddSubsidyDocumentSchema", () => {
  it("takes one or more photo ids", () => {
    const parsed = AddSubsidyDocumentSchema.parse(formToObject(form([["orderId", ID], ["kind", "feasibility_letter"], ["photos", FILE], ["photos", ID]])));
    expect(parsed.photos).toEqual([FILE, ID]);
  });

  it("needs a photo and waits for uploads to finish", () => {
    expect(AddSubsidyDocumentSchema.safeParse(formToObject(form([["orderId", ID], ["kind", "other"]]))).success).toBe(false);
    const uploading = AddSubsidyDocumentSchema.safeParse(formToObject(form([["orderId", ID], ["kind", "other"], ["photos", FILE], ["photos__uploading", "1"]])));
    expect(uploading.success).toBe(false);
  });
});
