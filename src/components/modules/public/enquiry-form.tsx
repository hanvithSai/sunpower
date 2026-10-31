"use client";

/**
 * Website enquiry form. Posts to a public Server Action (rate-limited, with a
 * honeypot), then shows the customer their reference number and what happens
 * next. Prefills system size/type from `?kw=3&type=on_grid` links.
 */
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { LeadFields } from "@/components/modules/leads/lead-fields";
import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { submitEnquiryAction } from "@/server/actions/public";
import { cta } from "@/lib/analytics";

const NEXT_STEPS = [
  "Our sales team calls you within 2 working hours.",
  "A technician visits for a free roof survey.",
  "You get a clear quote with the PM Surya Ghar subsidy worked out.",
];

export function EnquiryForm() {
  const searchParams = useSearchParams();
  const [reference, setReference] = useState<string | null | undefined>(undefined);

  function handleSuccess(state: ActionState) {
    const ref = state?.data?.reference;
    setReference(typeof ref === "string" ? ref : null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (reference !== undefined) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-12 text-success-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Thank you — we&apos;ve got your enquiry</h2>
        {reference ? (
          <p className="mt-2 text-muted-foreground">
            Your reference number is <span className="font-mono font-semibold text-foreground">{reference}</span>
          </p>
        ) : null}
        <ol className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm">
          {NEXT_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <span className="text-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  const kw = Number(searchParams.get("kw")) || undefined;
  const type = searchParams.get("type") ?? undefined;

  return (
    <ActionForm action={submitEnquiryAction} onSuccess={handleSuccess} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      {/* Honeypot: hidden from people and assistive tech, attractive to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <LeadFields defaults={{ capacityKw: kw, systemType: type }} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">We only use your number to call you about this enquiry. No spam, ever.</p>
        <SubmitButton size="lg" pendingText="Sending…" {...cta("enquiry_submit")}>
          <Send aria-hidden="true" />
          Get my free quote
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
