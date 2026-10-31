/**
 * PM Surya Ghar subsidy board: every residential on-grid customer's file by
 * stage, from "not applied" to "disbursed", so no customer loses a subsidy to
 * lost paperwork. Each card moves to its next stage in one step.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { SubsidyAdvanceDialog } from "@/components/modules/finance/subsidy-advance-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { statusMeta, type SubsidyStatus } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SUBSIDY_STEPS } from "@/lib/workflows";
import { requireUser } from "@/server/auth/session";
import { getSubsidyBoard } from "@/server/services/finance";

export const metadata: Metadata = { title: "Subsidy" };

const COLUMNS: SubsidyStatus[] = [...SUBSIDY_STEPS, "rejected"];

export default async function SubsidyPage() {
  const user = await requireUser(["sales"]);
  const now = new Date();
  const board = await getSubsidyBoard();
  const canEdit = user.role === "sales" || user.role === "admin";
  const pendingPaise = [...board.entries()].filter(([s]) => s !== "disbursed" && s !== "rejected").flatMap(([, cards]) => cards).reduce((sum, c) => sum + c.expectedPaise, 0);

  return (
    <>
      <PageHeader title="PM Surya Ghar subsidy" description={`Residential on-grid customers. ${formatINR(pendingPaise)} still to reach customers' accounts.`} />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-7 gap-3">
          {COLUMNS.map((status) => {
            const cards = board.get(status) ?? [];
            return (
              <section key={status} aria-labelledby={`col-${status}`} className="flex flex-col rounded-2xl bg-secondary/50 p-2">
                <h2 id={`col-${status}`} className="flex items-center justify-between px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {statusMeta("subsidy", status).label}
                  <span className="tabular-nums">{cards.length}</span>
                </h2>
                <ul className="space-y-2">
                  {cards.map((c) => (
                    <li key={c.id} className={cn("rounded-xl border bg-card p-3 text-sm shadow-sm", status === "rejected" ? "border-danger/40" : "border-border")}>
                      <Link href={`/orders/${c.id}`} className="block truncate font-medium text-foreground hover:text-primary">
                        {c.customer}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{c.number}</span> · {c.capacityKw} kW · {c.city}
                      </p>
                      <p className="mt-1 text-xs tabular-nums">{status === "disbursed" ? `${formatINR(c.disbursedPaise)} credited` : `${formatINR(c.expectedPaise)} expected`}</p>
                      {c.applicationNo ? <p className="truncate font-mono text-[11px] text-muted-foreground">{c.applicationNo}</p> : null}
                      {c.since ? <p className="text-[11px] text-muted-foreground">since {formatRelative(c.since, now)}</p> : null}
                      {canEdit ? (
                        <div className="mt-2">
                          <SubsidyAdvanceDialog orderId={c.id} status={c.status} expectedPaise={c.expectedPaise} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
