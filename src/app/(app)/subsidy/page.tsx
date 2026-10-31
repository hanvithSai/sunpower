/**
 * PM Surya Ghar subsidy board: every residential on-grid customer's file by
 * stage, from "not applied" to "disbursed", so no customer loses a subsidy to
 * lost paperwork. A forest summary shows how many files and how much money sit
 * at each stage; below, one column per stage shows five files and scrolls the
 * rest, and each card moves to its next stage in one step.
 *
 * Amounts are what the scheme's rule expects for each system until the money
 * is actually credited (then the disbursed amount) — an estimate is never shown
 * as an approved payment.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { FileText, MapPin } from "lucide-react";
import { SubsidyAdvanceDialog } from "@/components/modules/finance/subsidy-advance-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ScrollColumn } from "@/components/shared/scroll-column";
import { statusMeta, type SubsidyStatus } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SUBSIDY_STEPS } from "@/lib/workflows";
import { requireUser } from "@/server/auth/session";
import { getSubsidyBoard } from "@/server/services/finance";

export const metadata: Metadata = { title: "Subsidy" };

const COLUMNS: SubsidyStatus[] = [...SUBSIDY_STEPS, "rejected"];

/** A thin coloured line on top of each column: grey before filing, green as it advances, red if rejected. */
const ACCENT: Partial<Record<SubsidyStatus, string>> = {
  not_applied: "bg-muted-foreground/40",
  disbursed: "bg-success",
  rejected: "bg-danger",
};

export default async function SubsidyPage() {
  const user = await requireUser(["sales"]);
  const now = new Date();
  const board = await getSubsidyBoard();
  const canEdit = user.role === "sales" || user.role === "admin";
  const stage = (s: SubsidyStatus) => board.get(s) ?? [];
  const amountOf = (s: SubsidyStatus) => stage(s).reduce((sum, c) => sum + (s === "disbursed" ? c.disbursedPaise : c.expectedPaise), 0);
  const pendingPaise = COLUMNS.filter((s) => s !== "disbursed" && s !== "rejected").reduce((sum, s) => sum + amountOf(s), 0);

  return (
    <>
      <PageHeader title="PM Surya Ghar subsidy" description="Every residential on-grid customer's subsidy file, stage by stage. We file it; the government credits the customer." />

      <section aria-label="Subsidy files by stage" className="mb-6 overflow-hidden rounded-xl bg-forest text-forest-foreground">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <p className="text-sm text-forest-muted">
            <span className="font-display text-2xl font-semibold text-white tabular-nums">{formatINR(pendingPaise)}</span> expected, not yet credited to
            customers
          </p>
          <p className="text-sm text-forest-muted">
            <span className="font-semibold text-white tabular-nums">{formatINR(amountOf("disbursed"))}</span> already disbursed
          </p>
        </div>
        <ol className="mt-4 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
          {COLUMNS.map((s) => (
            <li key={s} className="min-w-0 border-t border-white/10 px-4 py-3 xl:border-l xl:first:border-l-0">
              <a href={`#col-${s}`} className="block rounded-sm">
                <span className="block text-[13px] leading-tight font-medium text-forest-foreground">{statusMeta("subsidy", s).label}</span>
                <span className="mt-1 block font-display text-2xl font-semibold text-white tabular-nums">{stage(s).length}</span>
                <span className="block text-xs text-forest-muted tabular-nums">{formatINRCompact(amountOf(s))}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1650px] grid-cols-7 gap-3">
          {COLUMNS.map((status) => {
            const cards = stage(status);
            return (
              <section key={status} id={`col-${status}`} aria-labelledby={`col-${status}-title`} className="flex scroll-mt-20 flex-col overflow-hidden rounded-xl border border-border bg-card">
                <span aria-hidden="true" className={cn("h-1", ACCENT[status] ?? "bg-primary/70")} />
                <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                  <h2 id={`col-${status}-title`} className="font-sans text-[13px] font-semibold tracking-normal text-foreground">
                    {statusMeta("subsidy", status).label}
                  </h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{cards.length}</span>
                </header>
                <div className="flex-1 bg-muted p-2">
                  {cards.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-muted-foreground">No files at this stage</p>
                  ) : (
                    <ScrollColumn label={`${statusMeta("subsidy", status).label} files`}>
                      {cards.map((c) => (
                        <article key={c.id} className={cn("rounded-lg border bg-card p-3 text-sm", status === "rejected" ? "border-danger/40" : "border-border")}>
                          <Link href={`/orders/${c.id}`} className="block truncate font-medium text-foreground hover:text-primary">
                            {c.customer}
                          </Link>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" aria-hidden="true" />
                            {c.city} · {c.capacityKw} kW
                          </p>
                          <p className={cn("mt-2 font-semibold tabular-nums", status === "disbursed" ? "text-success-foreground" : "text-foreground")}>
                            {status === "disbursed" ? `${formatINR(c.disbursedPaise)} credited` : `${formatINR(c.expectedPaise)} expected`}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <FileText className="size-3 shrink-0" aria-hidden="true" />
                            {c.documents ? `${c.documents} paper${c.documents === 1 ? "" : "s"} on file` : "No papers on file"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            <span className="tabular-nums">{c.number}</span>
                            {c.applicationNo ? ` · ${c.applicationNo}` : ""}
                            {c.since ? ` · ${formatRelative(c.since, now)}` : ""}
                          </p>
                          {canEdit ? (
                            <div className="mt-2.5">
                              <SubsidyAdvanceDialog orderId={c.id} status={c.status} expectedPaise={c.expectedPaise} />
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </ScrollColumn>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
