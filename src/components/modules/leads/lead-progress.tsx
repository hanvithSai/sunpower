/**
 * The lead's journey from enquiry to won, so anyone opening the record sees at
 * a glance what has happened and what comes next.
 */
import { Check, XCircle } from "lucide-react";
import type { LeadStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STEPS: { status: LeadStatus; label: string }[] = [
  { status: "new", label: "Enquiry" },
  { status: "contacted", label: "Contacted" },
  { status: "qualified", label: "Qualified" },
  { status: "survey_scheduled", label: "Survey booked" },
  { status: "survey_completed", label: "Surveyed" },
  { status: "survey_approved", label: "Survey approved" },
  { status: "quoted", label: "Quoted" },
  { status: "won", label: "Won" },
];

export function LeadProgress({ status, lostReason }: { status: LeadStatus; lostReason?: string }) {
  if (status === "lost") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger/8 p-4 text-sm">
        <XCircle className="mt-0.5 size-5 shrink-0 text-danger-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">This lead was closed as lost</p>
          {lostReason ? <p className="mt-0.5 text-muted-foreground">{lostReason}</p> : null}
        </div>
      </div>
    );
  }

  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Lead progress">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.status} className="flex items-center gap-1">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                done && "bg-success/12 text-success-foreground",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-secondary text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3" aria-hidden="true" /> : null}
              {step.label}
            </span>
            {i < STEPS.length - 1 ? <span className="h-px w-3 bg-border" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
