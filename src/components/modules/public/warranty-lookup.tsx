"use client";

/**
 * Public warranty check. A homeowner types the serial on the unit's label, or
 * their mobile number plus the last 4 characters of any serial on their roof.
 * Posts to a rate-limited Server Action (never a GET, so nothing personal
 * lands in a URL) and shows each unit's cover with call / WhatsApp buttons
 * for raising a complaint. Names are masked; no phone or address is shown.
 */
import { useState, type ReactNode } from "react";
import { MessageCircle, Phone, Search, ShieldAlert, ShieldCheck, ShieldQuestion, Wrench } from "lucide-react";
import { ActionForm, useActionFormState } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { COMPANY } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { lookupWarrantyAction } from "@/server/actions/public";
import type { PublicWarranty, PublicWarrantyUnit } from "@/server/services/warranty";
import { cta } from "@/lib/analytics";

type Mode = "serial" | "phone";

const COMPANY_TEL = `tel:${COMPANY.phone.replace(/\s+/g, "")}`;

/** `example` is a real serial streamed in by the page (", e.g. GRW3K-…"); the form never waits for it. */
export function WarrantyLookup({ example }: { example?: ReactNode }) {
  const [mode, setMode] = useState<Mode>("serial");
  const [result, setResult] = useState<PublicWarranty | null>(null);

  function handleSuccess(state: ActionState) {
    setResult((state?.data?.result as PublicWarranty | undefined) ?? null);
  }

  return (
    <div className="space-y-6">
      <ActionForm action={lookupWarrantyAction} onSuccess={handleSuccess} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Honeypot: hidden from people and assistive tech, attractive to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <input type="hidden" name="by" value={mode} />

        <div role="radiogroup" aria-label="Look up by" className="grid grid-cols-2 rounded-xl border border-border bg-secondary/50 p-1">
          {(
            [
              ["serial", "Serial number"],
              ["phone", "Mobile number"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => {
                setMode(value);
                setResult(null);
              }}
              className={cn(
                "h-10 rounded-lg text-sm font-medium transition-colors pointer-coarse:h-11",
                mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "serial" ? (
          <FormField label="Serial number" name="serial" required hint={<>Printed on the sticker on the inverter, battery or panel{example}</>}>
            <Input id="serial" name="serial" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono" />
          </FormField>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <FormField label="Mobile number" name="phone" required hint="The number you gave us">
              <Input id="phone" name="phone" inputMode="tel" autoComplete="tel" />
            </FormField>
            <FormField label="Last 4 of any serial" name="last4" required hint="From any unit on your roof">
              <Input id="last4" name="last4" maxLength={4} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" />
            </FormField>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">We never show your phone number or address here.</p>
          <SubmitButton size="lg" pendingText="Checking…" {...cta("warranty_submit")}>
            <Search aria-hidden="true" />
            Check warranty
          </SubmitButton>
        </div>
        <NoMatch />
      </ActionForm>

      {result ? <WarrantyResult result={result} /> : null}
    </div>
  );
}

/** The one message every miss gets (unknown serial, wrong last 4, not delivered yet). */
function NoMatch() {
  const { state } = useActionFormState();
  if (!state || state.ok || state.fieldErrors) return null;
  return (
    <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm text-foreground">
      {state.message}
    </p>
  );
}

function WarrantyResult({ result }: { result: PublicWarranty }) {
  const anyExpired = result.units.some((u) => u.state === "out_of_warranty") || result.workmanship?.state === "out_of_warranty";
  const complaint = `Hello SunPower, I'd like to raise a service complaint (${result.customer}).`;
  return (
    <section aria-live="polite" aria-label="Warranty result" className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-xs font-medium font-sans tracking-normal text-muted-foreground">Installed for</p>
        <p className="text-lg font-semibold text-foreground">{result.customer}</p>
      </div>
      <ul className="space-y-3">
        {result.units.map((u) => (
          <UnitRow key={u.serial} unit={u} />
        ))}
        {result.workmanship ? (
          <li className="flex items-start gap-3 rounded-xl border border-border p-4">
            <Tone state={result.workmanship.state} icon={Wrench} />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Workmanship warranty</p>
              <p className="text-sm text-muted-foreground">Installation, wiring, earthing and structure · until {formatDate(result.workmanship.endsAt)}</p>
              <p className={cn("mt-1 text-sm font-medium", result.workmanship.state === "in_warranty" ? "text-success-foreground" : "text-danger-foreground")}>{result.workmanship.label}</p>
            </div>
          </li>
        ) : null}
      </ul>
      <p className="text-sm text-muted-foreground">
        {anyExpired
          ? "Covered items are repaired or replaced free. For anything out of warranty we quote parts and labour before starting."
          : "Repairs and replacements under warranty cost you nothing."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg">
          <a href={COMPANY_TEL} {...cta("warranty_call")}>
            <Phone aria-hidden="true" />
            Call {COMPANY.phone}
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={`https://wa.me/91${COMPANY.whatsapp}?text=${encodeURIComponent(complaint)}`} target="_blank" rel="noopener noreferrer" {...cta("warranty_whatsapp")}>
            <MessageCircle aria-hidden="true" />
            Raise a complaint on WhatsApp
          </a>
        </Button>
      </div>
    </section>
  );
}

function UnitRow({ unit }: { unit: PublicWarrantyUnit }) {
  const covered = unit.state === "in_warranty" || unit.state === "not_started";
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border p-4">
      <Tone state={unit.state} icon={covered ? ShieldCheck : unit.state === "out_of_warranty" ? ShieldAlert : ShieldQuestion} />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{unit.productName}</p>
        <p className="text-sm text-muted-foreground">
          {unit.category} · <span className="font-mono">{unit.serial}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {unit.deliveredAt ? `Delivered ${formatDate(unit.deliveredAt)}` : "Not delivered yet"}
          {unit.endsAt ? ` · cover ${unit.state === "out_of_warranty" ? "ended" : "until"} ${formatDate(unit.endsAt)}` : ""}
        </p>
        <p className={cn("mt-1 text-sm font-medium", covered ? "text-success-foreground" : unit.state === "out_of_warranty" ? "text-danger-foreground" : "text-muted-foreground")}>{unit.label}</p>
      </div>
    </li>
  );
}

function Tone({ state, icon: Icon }: { state: PublicWarrantyUnit["state"]; icon: typeof ShieldCheck }) {
  const covered = state === "in_warranty" || state === "not_started";
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl",
        covered ? "bg-success/16 text-success-foreground" : state === "out_of_warranty" ? "bg-danger/12 text-danger" : "bg-secondary text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}
