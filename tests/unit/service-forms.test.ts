/**
 * Service desk forms as the browser posts them (FormData → formToObject →
 * Zod), plus the ticket state machine's confirmation gate (BR-06).
 */
import { describe, expect, it } from "vitest";
import { canTransition, TICKET_FLOW } from "@/lib/workflows";
import { AssignTicketSchema, BillingOverrideSchema, ConfirmTicketSchema, CreateTicketSchema, ResolveTicketSchema } from "@/lib/validation/service";
import { formToObject } from "@/server/lib/validate";

const ID = "6ae5c5a8e2fde1b3dd16fa7a";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("CreateTicketSchema", () => {
  const base = { category: "fault_code", description: "Zero power", priority: "high", channel: "phone" };

  it("accepts a serial in any case and upper-cases it", () => {
    const parsed = CreateTicketSchema.parse(formToObject(form({ ...base, serial: " grw3k-2610-0001 " })));
    expect(parsed.serial).toBe("GRW3K-2610-0001");
    expect(parsed.customerId).toBeUndefined();
  });

  it("accepts a customer for faults with no serial", () => {
    expect(CreateTicketSchema.safeParse(formToObject(form({ ...base, category: "wiring_earthing", customerId: ID }))).success).toBe(true);
  });

  it("needs a serial or a customer", () => {
    const result = CreateTicketSchema.safeParse(formToObject(form(base)));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["serial"]);
  });
});

describe("ResolveTicketSchema", () => {
  it("parses parts posted as JSON and labour hours", () => {
    const parsed = ResolveTicketSchema.parse(
      formToObject(form({ ticketId: ID, type: "repair", notes: "Fuses replaced", labourHours: "1.5", parts: JSON.stringify([{ productId: ID, qty: "2" }]) })),
    );
    expect(parsed.labourHours).toBe(1.5);
    expect(parsed.parts).toEqual([{ productId: ID, qty: 2 }]);
  });

  it("needs the replacement unit's serial for a replacement", () => {
    expect(ResolveTicketSchema.safeParse(formToObject(form({ ticketId: ID, type: "replacement", notes: "Swap", labourHours: "2", parts: "[]" }))).success).toBe(false);
    expect(
      ResolveTicketSchema.safeParse(formToObject(form({ ticketId: ID, type: "replacement", notes: "Swap", labourHours: "2", parts: "[]", replacementSerial: "grw3k-2610-0002" }))).data?.replacementSerial,
    ).toBe("GRW3K-2610-0002");
  });

  it("rejects fractional part quantities", () => {
    expect(ResolveTicketSchema.safeParse({ ticketId: ID, type: "repair", notes: "x", labourHours: 1, parts: [{ productId: ID, qty: 1.5 }] }).success).toBe(false);
  });
});

describe("other ticket forms", () => {
  it("books a visit with a datetime-local value", () => {
    expect(AssignTicketSchema.safeParse({ ticketId: ID, technicianId: ID, visitAt: "2026-11-02T10:00" }).success).toBe(true);
    expect(AssignTicketSchema.safeParse({ ticketId: ID, technicianId: ID, visitAt: "tomorrow" }).success).toBe(false);
  });

  it("an override always needs a reason", () => {
    expect(BillingOverrideSchema.safeParse(formToObject(form({ ticketId: ID, billable: "true", reason: "" }))).success).toBe(false);
    expect(BillingOverrideSchema.parse(formToObject(form({ ticketId: ID, billable: "false", reason: "Goodwill" }))).billable).toBe(false);
  });

  it("a confirmation records who and how", () => {
    expect(ConfirmTicketSchema.safeParse({ ticketId: ID, confirmedBy: "Srinivas Rao", channel: "call" }).success).toBe(true);
    expect(ConfirmTicketSchema.safeParse({ ticketId: ID, confirmedBy: "Srinivas Rao", channel: "email" }).success).toBe(false);
  });
});

describe("TICKET_FLOW (BR-06)", () => {
  it("never closes straight from resolved", () => {
    expect(canTransition(TICKET_FLOW, "resolved", "closed")).toBe(false);
    expect(canTransition(TICKET_FLOW, "resolved", "customer_confirmed")).toBe(true);
    expect(canTransition(TICKET_FLOW, "customer_confirmed", "closed")).toBe(true);
  });

  it('"Not fixed" reopens from resolved, confirmed or closed', () => {
    for (const from of ["resolved", "customer_confirmed", "closed"] as const) expect(canTransition(TICKET_FLOW, from, "in_progress")).toBe(true);
  });
});
