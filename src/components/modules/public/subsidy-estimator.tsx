"use client";

/**
 * PM Surya Ghar estimate on the landing page. Uses the same rule the quote
 * builder uses (estimateSubsidyRs in src/lib/subsidy.ts), so the number a
 * homeowner sees here is the number on their quote. It is an estimate under
 * the scheme's rules, not an approval, and the copy says so.
 */
import { useState } from "react";
import Link from "next/link";
import { cta } from "@/lib/analytics";
import { CUSTOMER_TYPE_LABELS, type CustomerType } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { SUBSIDY_RULES, estimateSubsidyRs, isSubsidyEligible } from "@/lib/subsidy";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const SIZES = [1, 2, 3, 4, 5] as const;
const SYSTEMS = [
  { id: "on_grid", label: "On-Grid" },
  { id: "off_grid", label: "Off-Grid" },
] as const;

function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-foreground">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-10 min-w-12 rounded-lg border px-3.5 text-sm font-medium transition-colors pointer-coarse:h-11",
              value === o.id ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SubsidyEstimator() {
  const [kw, setKw] = useState<number>(3);
  const [customer, setCustomer] = useState<CustomerType>("residential");
  const [system, setSystem] = useState<"on_grid" | "off_grid">("on_grid");

  const eligible = isSubsidyEligible(system, customer);
  const subsidyRs = estimateSubsidyRs(kw, system, customer);
  const reason =
    customer !== "residential"
      ? "The scheme covers homes only, so businesses and factories aren't eligible."
      : system !== "on_grid"
        ? "The scheme covers grid-connected systems only, so off-grid systems aren't eligible."
        : null;

  return (
    <div className="grid gap-8 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
      <div className="space-y-6">
        <Choice label="System size" options={SIZES.map((s) => ({ id: s, label: `${s} kW` }))} value={kw} onChange={setKw} />
        <Choice
          label="Who is it for?"
          options={(["residential", "commercial"] as const).map((c) => ({ id: c, label: c === "residential" ? "My home" : CUSTOMER_TYPE_LABELS[c] }))}
          value={customer}
          onChange={setCustomer}
        />
        <Choice label="System type" options={SYSTEMS} value={system} onChange={setSystem} />
      </div>

      <div className="flex flex-col justify-between gap-6 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
        <div aria-live="polite">
          <p className="text-sm text-muted-foreground">Estimated PM Surya Ghar subsidy</p>
          <p className={cn("mt-1 font-display text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl", eligible ? "text-primary" : "text-muted-foreground")}>
            {formatINR(subsidyRs * 100)}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {reason ??
              `Under the scheme: ${formatINR(SUBSIDY_RULES.perKwFirstTwoRs * 100)} per kW for the first 2 kW and ${formatINR(SUBSIDY_RULES.thirdKwRs * 100)} for the 3rd, up to ${formatINR(SUBSIDY_RULES.capRs * 100)}. It is credited to your bank account after the DISCOM inspects the installation, so it isn't a discount on the invoice.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/enquiry?kw=${kw}&type=${system}`} className={buttonVariants({ size: "lg" })} {...cta("estimator_get_quote")}>
            Get a quote for {kw} kW
          </Link>
          <p className="text-xs text-muted-foreground">An estimate under current rules, not an approval. We file the application for you.</p>
        </div>
      </div>
    </div>
  );
}
