/**
 * Analytics privacy (product/Analytics.md §3): no share token, search text or
 * serial number may reach PostHog through a URL, and the scan form records
 * how a serial arrived.
 */
import { describe, expect, it } from "vitest";
import { maskContactText, scrubProperties, scrubUrl } from "@/lib/analytics";
import { ScanSerialSchema } from "@/lib/validation/inventory";

describe("scrubUrl", () => {
  it("masks share tokens in full and relative URLs", () => {
    expect(scrubUrl("https://www.sunpowersolutions.me/share/OzqmLlDOnQrtTiLk_dgrFXme2uY8JUqm")).toBe("https://www.sunpowersolutions.me/share/:token");
    expect(scrubUrl("/share/OzqmLlDOnQrtTiLk")).toBe("/share/:token");
  });

  it("drops search text, serials and tokens but keeps filters and ids", () => {
    expect(scrubUrl("https://x.in/leads?q=9848012345&status=new&page=2")).toBe("https://x.in/leads?status=new&page=2");
    expect(scrubUrl("/service/new?serial=GRW3K-H2504-0001&customerId=6ae5c5a8e2fde1b3dd16fa7a")).toBe("/service/new?customerId=6ae5c5a8e2fde1b3dd16fa7a");
    expect(scrubUrl("/api/v1/files/abc?share=secret")).toBe("/api/v1/files/abc");
    expect(scrubUrl("/login?callbackUrl=%2Fleads%3Fq%3DRamesh")).toBe("/login");
    expect(scrubUrl("/dashboard#profit")).toBe("/dashboard");
  });

  it("leaves values that aren't URLs alone", () => {
    expect(scrubUrl("$direct")).toBe("$direct");
    expect(scrubUrl("")).toBe("");
  });

  it("scrubs every URL in an event's properties", () => {
    const props = scrubProperties({
      $current_url: "https://x.in/share/tok?x=1",
      $pathname: "/share/tok",
      $referrer: "https://x.in/customers?q=Venkata",
      resultCount: 3,
    });
    expect(props).toEqual({ $current_url: "https://x.in/share/:token", $pathname: "/share/:token", $referrer: "https://x.in/customers", resultCount: 3 });
  });
});

describe("maskContactText (session replay)", () => {
  it("hides phone numbers however they are written", () => {
    expect(maskContactText("Call +91 98480 12345 now")).toBe("Call ••••• now");
    expect(maskContactText("9848012345")).toBe("•••••");
    expect(maskContactText("tel:+919848012345")).toBe("tel:•••••");
    expect(maskContactText("https://wa.me/919848012345?text=Hi")).toBe("https://wa.me/•••••?text=Hi");
  });

  it("hides emails and GSTINs", () => {
    expect(maskContactText("ravi.k@gmail.com")).toBe("•••@•••");
    expect(maskContactText("GSTIN 36AABCS1234F1Z5")).toBe("GSTIN •••");
  });

  it("leaves serials, amounts, document numbers and long ids readable", () => {
    for (const text of ["GRW3K-H2504-0001", "₹1,50,000", "SP-O-0205", "INV/26-27/0001", "1730000000000", "6ae5c5a8e2fde1b3dd16fa7a"]) {
      expect(maskContactText(text)).toBe(text);
    }
  });
});

describe("ScanSerialSchema", () => {
  it("records camera scans and treats typed serials as manual", () => {
    const orderId = "6ae5c5a8e2fde1b3dd16fa7a";
    expect(ScanSerialSchema.parse({ orderId, serial: "waa545-1", method: "camera" }).method).toBe("camera");
    expect(ScanSerialSchema.parse({ orderId, serial: "waa545-1" }).method).toBe("manual");
    expect(ScanSerialSchema.safeParse({ orderId, serial: "waa545-1", method: "telepathy" }).success).toBe(false);
  });
});
