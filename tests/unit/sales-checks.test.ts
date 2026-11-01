/**
 * Sales-side checks as the browser posts them: the missing-parts warning on
 * quotes (R-24), Panel Sets carrying no subsidy, a business GSTIN on the
 * enquiry (R-03), the public warranty lookup form (F20) and name masking.
 */
import { describe, expect, it } from "vitest";
import { maskName } from "@/lib/format";
import { missingComponents, REQUIRED_COMPONENTS } from "@/lib/quote-calc";
import { estimateSubsidyPaise } from "@/lib/subsidy";
import { ManualLeadSchema, PublicEnquirySchema } from "@/lib/validation/leads";
import { MarkQuoteSentSchema } from "@/lib/validation/quotes";
import { WarrantyLookupSchema } from "@/lib/validation/warranty";
import { canTransition, ORDER_FLOW } from "@/lib/workflows";
import { formToObject } from "@/server/lib/validate";

const ID = "6ae5c5a8e2fde1b3dd16fa7a";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const lines = (cats: string[]) => cats.map((category) => ({ category: category as never, qty: 1 }));

describe("missingComponents (R-24)", () => {
  it("passes a complete On-Grid bill of materials", () => {
    expect(missingComponents("on_grid", lines(REQUIRED_COMPONENTS.on_grid))).toEqual([]);
  });

  it("flags the earthing line when it is removed", () => {
    const withoutEarthing = REQUIRED_COMPONENTS.on_grid.filter((c) => c !== "earthing");
    expect(missingComponents("on_grid", lines(withoutEarthing))).toEqual(["earthing"]);
  });

  it("needs a battery for Off-Grid but no net meter", () => {
    const missing = missingComponents("off_grid", lines(REQUIRED_COMPONENTS.on_grid));
    expect(missing).toEqual(["battery"]);
  });

  it("asks only for panels, connectors and cable on a Panel Set", () => {
    expect(missingComponents("panel_set", lines(["panel", "connector", "cable"]))).toEqual([]);
    expect(missingComponents("panel_set", lines(["panel"]))).toEqual(["connector", "cable"]);
  });

  it("ignores lines with zero quantity", () => {
    expect(missingComponents("panel_set", [...lines(["panel", "connector"]), { category: "cable", qty: 0 }])).toEqual(["cable"]);
  });

  it("reads the send-anyway tick from the quote page", () => {
    expect(MarkQuoteSentSchema.parse(formToObject(form({ quoteId: ID, sendWithMissing: "on" }))).sendWithMissing).toBe(true);
    expect(MarkQuoteSentSchema.parse(formToObject(form({ quoteId: ID }))).sendWithMissing).toBe(false);
  });
});

describe("Panel Sets", () => {
  it("carry no PM Surya Ghar subsidy", () => {
    expect(estimateSubsidyPaise(3, "panel_set", "residential")).toBe(0);
    expect(estimateSubsidyPaise(3, "on_grid", "residential")).toBeGreaterThan(0);
  });

  it("can close straight from delivery", () => {
    expect(canTransition(ORDER_FLOW, "delivered", "closed")).toBe(true);
    expect(canTransition(ORDER_FLOW, "dispatched", "closed")).toBe(false);
  });
});

describe("PublicEnquirySchema GSTIN (R-03)", () => {
  const base = { name: "Sri Sai Polymers", phone: "9848012345", email: "accounts@srisaipolymers.in", city: "Kompally", pincode: "500014", customerType: "commercial", capacityKw: "5", systemType: "on_grid" };

  it("upper-cases a valid GSTIN", () => {
    expect(PublicEnquirySchema.parse(formToObject(form({ ...base, gstin: "36aakfs4421m1z3" }))).gstin).toBe("36AAKFS4421M1Z3");
  });

  it("rejects a malformed GSTIN and allows none", () => {
    expect(PublicEnquirySchema.safeParse(formToObject(form({ ...base, gstin: "36AAKFS4421" }))).success).toBe(false);
    expect(PublicEnquirySchema.parse(formToObject(form({ ...base, gstin: "" }))).gstin).toBeUndefined();
  });
});

describe("Enquiry contact details", () => {
  const base = { name: "Swathi Reddy", phone: "+91 98480-12345", email: "swathi@example.com", city: "Kukatpally", pincode: "500072", capacityKw: "3", systemType: "on_grid" };
  const errors = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, field: string) =>
    r.error?.issues.filter((i) => i.path[0] === field).map((i) => i.message) ?? [];

  it("refuses letters in the mobile number instead of stripping them", () => {
    const r = PublicEnquirySchema.safeParse(formToObject(form({ ...base, phone: "98480abc12345" })));
    expect(r.success).toBe(false);
    expect(errors(r, "phone")).toContain("Use digits only, no letters");
    expect(PublicEnquirySchema.parse(formToObject(form(base))).phone).toBe("9848012345");
  });

  it("requires a valid email on the website form", () => {
    expect(errors(PublicEnquirySchema.safeParse(formToObject(form({ ...base, email: "" }))), "email")).toEqual(["Enter your email address"]);
    expect(errors(PublicEnquirySchema.safeParse(formToObject(form({ ...base, email: "swathi@" }))), "email")).toEqual(["Enter a valid email address"]);
  });

  it("requires email on manual entry only for website enquiries", () => {
    expect(ManualLeadSchema.safeParse(formToObject(form({ ...base, email: "", source: "whatsapp" }))).success).toBe(true);
    expect(ManualLeadSchema.safeParse(formToObject(form({ ...base, email: "", source: "website" }))).success).toBe(false);
  });
});

describe("WarrantyLookupSchema (F20)", () => {
  it("normalises a typed serial", () => {
    expect(WarrantyLookupSchema.parse(formToObject(form({ by: "serial", serial: " grw3k-h2504-0001 ", email: "ramana@example.com" }))).serial).toBe("GRW3K-H2504-0001");
  });

  it("needs both the phone and the last 4 characters", () => {
    const missing = WarrantyLookupSchema.safeParse(formToObject(form({ by: "phone", phone: "+91 98480 12345", email: "ramana@example.com" })));
    expect(missing.success).toBe(false);
    const ok = WarrantyLookupSchema.parse(formToObject(form({ by: "phone", phone: "+91 98480 12345", last4: "0001", email: "ramana@example.com" })));
    expect(ok).toMatchObject({ phone: "9848012345", last4: "0001" });
  });

  it("refuses letters in the mobile number and needs an email", () => {
    expect(WarrantyLookupSchema.safeParse(formToObject(form({ by: "phone", phone: "98480O12345", last4: "0001", email: "ramana@example.com" }))).success).toBe(false);
    expect(WarrantyLookupSchema.safeParse(formToObject(form({ by: "serial", serial: "GRW3K-H2504-0001" }))).success).toBe(false);
    expect(WarrantyLookupSchema.safeParse(formToObject(form({ by: "serial", serial: "GRW3K-H2504-0001", email: "not-an-email" }))).success).toBe(false);
  });

  it("masks names to an initial and a surname letter", () => {
    expect(maskName("Venkata Ramana Rao")).toBe("V. R****");
    expect(maskName("Padmavathi")).toBe("P****");
  });
});
