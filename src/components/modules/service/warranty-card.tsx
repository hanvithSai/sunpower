/**
 * The answer support needs in one glance: is this covered, on what basis
 * (the serial's own warranty or our workmanship), until when, and so what does
 * the customer pay. Server-safe.
 */
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { WarrantyBasis, WarrantyState } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatSpan } from "@/lib/warranty";
import { cn } from "@/lib/utils";

export type WarrantyCardProps = {
  state: WarrantyState;
  basis: WarrantyBasis;
  endsAt?: Date | null;
  /** From getWarrantyInfo: positive while covered, negative once expired. */
  daysLeft?: number;
  billable?: boolean;
  serial?: string;
  productName?: string;
  overrideReason?: string;
};

export function WarrantyCard({ state, basis, endsAt, daysLeft, billable, serial, productName, overrideReason }: WarrantyCardProps) {
  const covered = state === "in_warranty";
  const free = billable === undefined ? covered : !billable;
  const Icon = covered ? ShieldCheck : state === "out_of_warranty" ? ShieldAlert : ShieldQuestion;
  const basisText =
    basis === "workmanship" ? "Workmanship warranty (installation, wiring, earthing, structure)" : basis === "serial" ? `${productName ?? "Unit"} warranty` : "No SunPower installation";

  return (
    <section
      aria-label="Warranty"
      className={cn("rounded-2xl border p-5", covered ? "border-success/40 bg-success/8" : state === "out_of_warranty" ? "border-danger/30 bg-danger/6" : "border-border bg-secondary/40")}
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", covered ? "bg-success/16 text-success-foreground" : state === "out_of_warranty" ? "bg-danger/12 text-danger" : "bg-secondary text-muted-foreground")}>
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">{covered ? "In warranty" : state === "out_of_warranty" ? "Out of warranty" : "Not covered"}</p>
          <p className="text-sm text-muted-foreground">
            {endsAt && daysLeft !== undefined ? `${daysLeft >= 0 ? `${formatSpan(daysLeft)} left` : `${formatSpan(-daysLeft)} ago`} · ` : ""}
            {endsAt ? `${covered ? "until" : "ended"} ${formatDate(endsAt)}` : basis === "none" ? "Nothing installed to claim against" : "Starts on delivery"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {basisText}
            {serial ? <span className="font-mono"> · {serial}</span> : null}
          </p>
        </div>
      </div>
      <p className={cn("mt-4 rounded-xl px-3 py-2 text-sm font-medium", free ? "bg-success/14 text-success-foreground" : "bg-warning/14 text-warning-foreground")}>
        {free ? "₹0 to the customer — parts and labour are on us." : "Parts and labour will be billed automatically when the ticket is resolved."}
        {overrideReason ? <span className="block text-xs font-normal">Changed by support: {overrideReason}</span> : null}
      </p>
    </section>
  );
}
