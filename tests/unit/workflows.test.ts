/**
 * State machines (src/lib/workflows.ts): every status has a row, every target
 * is a real status, the happy paths walk end to end, and the gates from the
 * brief hold — no quote before an approved survey, no delivery before
 * dispatch, no close before the customer confirms (BR-06).
 */
import { describe, expect, it } from "vitest";
import {
  JOB_STATUSES,
  LEAD_STATUSES,
  ORDER_STATUSES,
  QUOTE_STATUSES,
  SUBSIDY_STATUSES,
  SURVEY_STATUSES,
  TICKET_STATUSES,
} from "@/lib/constants";
import {
  canTransition,
  JOB_FLOW,
  LEAD_FLOW,
  ORDER_FLOW,
  ORDER_STEPS,
  QUOTE_FLOW,
  SUBSIDY_FLOW,
  SUBSIDY_STEPS,
  SURVEY_FLOW,
  TICKET_FLOW,
  type Flow,
} from "@/lib/workflows";

const FLOWS: [string, Flow<string>, readonly string[]][] = [
  ["lead", LEAD_FLOW, LEAD_STATUSES],
  ["survey", SURVEY_FLOW, SURVEY_STATUSES],
  ["quote", QUOTE_FLOW, QUOTE_STATUSES],
  ["order", ORDER_FLOW, ORDER_STATUSES],
  ["job", JOB_FLOW, JOB_STATUSES],
  ["ticket", TICKET_FLOW, TICKET_STATUSES],
  ["subsidy", SUBSIDY_FLOW, SUBSIDY_STATUSES],
];

function walk<S extends string>(flow: Flow<S>, path: S[]): boolean {
  return path.every((status, i) => i === 0 || canTransition(flow, path[i - 1], status));
}

describe("every flow is complete", () => {
  it.each(FLOWS)("%s: a row per status, and only real statuses as targets", (_name, flow, statuses) => {
    expect(Object.keys(flow).sort()).toEqual([...statuses].sort());
    for (const targets of Object.values(flow)) for (const t of targets) expect(statuses).toContain(t);
  });

  it("refuses unknown statuses", () => {
    expect(canTransition(ORDER_FLOW, "shipped" as never, "delivered")).toBe(false);
  });
});

describe("lead → quote gate", () => {
  it("walks enquiry to won only through an approved survey", () => {
    expect(walk(LEAD_FLOW, ["new", "contacted", "qualified", "survey_scheduled", "survey_completed", "survey_approved", "quoted", "won"])).toBe(true);
    expect(canTransition(LEAD_FLOW, "qualified", "quoted")).toBe(false);
    expect(canTransition(LEAD_FLOW, "survey_completed", "quoted")).toBe(false);
  });

  it("sends a rejected survey back for a re-survey, and a lost lead can come back", () => {
    expect(canTransition(LEAD_FLOW, "survey_completed", "survey_scheduled")).toBe(true);
    expect(canTransition(LEAD_FLOW, "lost", "new")).toBe(true);
    expect(LEAD_FLOW.won).toEqual([]);
  });

  it("allows a new quote version while quoted", () => {
    expect(canTransition(LEAD_FLOW, "quoted", "quoted")).toBe(true);
  });
});

describe("quote", () => {
  it("is final once accepted, rejected or expired", () => {
    expect(QUOTE_FLOW.accepted).toEqual([]);
    expect(QUOTE_FLOW.rejected).toEqual([]);
    expect(QUOTE_FLOW.expired).toEqual([]);
    expect(canTransition(QUOTE_FLOW, "draft", "expired")).toBe(false);
  });
});

describe("order", () => {
  it("follows the stepper from payment to closed", () => {
    expect(walk(ORDER_FLOW, ORDER_STEPS)).toBe(true);
  });

  it("can't be delivered before dispatch or dispatched before packing", () => {
    expect(canTransition(ORDER_FLOW, "confirmed", "dispatched")).toBe(false);
    expect(canTransition(ORDER_FLOW, "ready_to_dispatch", "delivered")).toBe(false);
    expect(canTransition(ORDER_FLOW, "pending_payment", "ready_to_dispatch")).toBe(false);
  });

  it("can be unpacked back to confirmed, but not cancelled once it has left", () => {
    expect(canTransition(ORDER_FLOW, "ready_to_dispatch", "confirmed")).toBe(true);
    expect(canTransition(ORDER_FLOW, "dispatched", "cancelled")).toBe(false);
  });
});

describe("installation job", () => {
  it("starts before it completes, and is final after", () => {
    expect(walk(JOB_FLOW, ["scheduled", "scheduled", "in_progress", "completed"])).toBe(true);
    expect(canTransition(JOB_FLOW, "scheduled", "completed")).toBe(false);
    expect(canTransition(JOB_FLOW, "in_progress", "cancelled")).toBe(false);
    expect(JOB_FLOW.completed).toEqual([]);
  });
});

describe("ticket (BR-06)", () => {
  it("closes only after the customer confirms", () => {
    expect(walk(TICKET_FLOW, ["open", "assigned", "in_progress", "resolved", "customer_confirmed", "closed"])).toBe(true);
    const closers = TICKET_STATUSES.filter((s) => canTransition(TICKET_FLOW, s, "closed"));
    expect(closers).toEqual(["customer_confirmed"]);
  });
});

describe("subsidy", () => {
  it("walks the PM Surya Ghar stages in order without skipping feasibility", () => {
    expect(walk(SUBSIDY_FLOW, SUBSIDY_STEPS)).toBe(true);
    expect(canTransition(SUBSIDY_FLOW, "applied", "net_meter_installed")).toBe(false);
  });

  it("lets a rejected file be re-applied, and nothing follows disbursement", () => {
    expect(canTransition(SUBSIDY_FLOW, "inspected", "rejected")).toBe(true);
    expect(canTransition(SUBSIDY_FLOW, "rejected", "applied")).toBe(true);
    expect(SUBSIDY_FLOW.disbursed).toEqual([]);
    expect(SUBSIDY_FLOW.not_applicable).toEqual([]);
  });
});
