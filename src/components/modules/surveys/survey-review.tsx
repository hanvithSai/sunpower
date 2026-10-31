"use client";

/**
 * Sales review of a completed survey. Approving it unlocks quoting; the other
 * two outcomes need a note so the customer file explains what happened.
 */
import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import { ActionForm } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SurveyDecision } from "@/lib/validation/surveys";
import { reviewSurveyAction } from "@/server/actions/surveys";

const CHOICES: { value: SurveyDecision; title: string; body: string; icon: LucideIcon }[] = [
  { value: "approve", title: "Approve", body: "Measurements look right — unlock the quote.", icon: CheckCircle2 },
  { value: "resurvey", title: "Re-survey", body: "Book the same technician tomorrow, 10:00 AM.", icon: RotateCcw },
  { value: "not_feasible", title: "Not feasible", body: "Close the lead (shading, structure, access).", icon: XCircle },
];

const SUBMIT_LABEL: Record<SurveyDecision, string> = {
  approve: "Approve survey",
  resurvey: "Request re-survey",
  not_feasible: "Close as not feasible",
};

export function SurveyReview({ surveyId }: { surveyId: string }) {
  const [decision, setDecision] = useState<SurveyDecision>("approve");

  return (
    <ActionForm action={reviewSurveyAction} className="space-y-4">
      <input type="hidden" name="surveyId" value={surveyId} />
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Decision</legend>
        {CHOICES.map(({ value, title, body, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-xl border border-border bg-card p-3 text-sm transition-colors",
              "has-[:checked]:border-primary has-[:checked]:bg-primary/6",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            )}
          >
            <input
              type="radio"
              name="decision"
              value={value}
              checked={decision === value}
              onChange={() => setDecision(value)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Icon className="size-4" aria-hidden="true" />
              {title}
            </span>
            <span className="text-muted-foreground">{body}</span>
          </label>
        ))}
      </fieldset>

      {decision !== "approve" ? (
        <FormField label="Note" name="note" required>
          <Textarea id="note" name="note" rows={2} maxLength={500} required placeholder="What needs to change, or why it can't go ahead" />
        </FormField>
      ) : null}

      <SubmitButton variant={decision === "not_feasible" ? "destructive" : "default"} pendingText="Saving…">
        {SUBMIT_LABEL[decision]}
      </SubmitButton>
    </ActionForm>
  );
}
