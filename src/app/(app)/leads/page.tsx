/**
 * Sales pipeline: every enquiry from the website, WhatsApp, calls and walk-ins.
 * Board view groups leads by stage; table view lists everything with filters.
 * The headline cards point at what needs attention right now.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BellRing, ClipboardCheck, FileText, Inbox, Kanban, List, Plus, Sparkles } from "lucide-react";
import { LeadBoard } from "@/components/modules/leads/lead-board";
import { LeadTable } from "@/components/modules/leads/lead-table";
import { NewLeadDialog } from "@/components/modules/leads/new-lead-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { LEAD_SOURCE_LABELS, LEAD_STATUSES, options, statusMeta } from "@/lib/constants";
import { first, hrefWith, type SearchParamsRecord } from "@/lib/query";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getLeadPipelineStats, listLeadBoard, listLeads } from "@/server/services/leads";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser(["sales", "support"]);
  const sp = await searchParams;
  const now = new Date();

  const view = first(sp.view) === "table" ? "table" : "board";
  const mine = first(sp.mine) === "1";
  const filter = {
    status: first(sp.status),
    source: first(sp.source),
    q: first(sp.q),
    assignedTo: mine ? user.id : undefined,
    page: Number(first(sp.page)) || 1,
  };

  const [stats, board, table] = await Promise.all([
    getLeadPipelineStats(now, mine ? user.id : undefined),
    view === "board" ? listLeadBoard(filter, now) : Promise.resolve(null),
    view === "table" ? listLeads(filter, now) : Promise.resolve(null),
  ]);
  const isEmpty = board ? board.every((c) => c.total === 0) : table?.total === 0;
  const filtered = Boolean(filter.q || filter.source || filter.status || mine);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry from the website, WhatsApp, calls and walk-ins — none of them get lost."
        actions={
          <Suspense
            fallback={
              <Button disabled>
                <Plus aria-hidden="true" />
                New enquiry
              </Button>
            }
          >
            <NewLeadDialog />
          </Suspense>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Uncontacted over 2 h"
          value={stats.uncontacted}
          icon={BellRing}
          tone={stats.uncontacted > 0 ? "danger" : "neutral"}
          hint="First call is overdue"
          href={hrefWith("/leads", {}, { view: "table", status: "new" })}
        />
        <StatCard label="New this week" value={stats.newThisWeek} icon={Sparkles} tone="info" hint="All sources" />
        <StatCard
          label="Surveys to review"
          value={stats.awaitingReview}
          icon={ClipboardCheck}
          tone={stats.awaitingReview > 0 ? "warning" : "neutral"}
          hint="Approve to unlock quotes"
          href="/surveys?status=completed"
        />
        <StatCard
          label="Ready to quote"
          value={stats.readyToQuote}
          icon={FileText}
          tone="success"
          hint="Survey approved"
          href={hrefWith("/leads", {}, { view: "table", status: "survey_approved" })}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80">
          <SearchInput placeholder="Search name, phone, city or SP-L-…" />
        </div>
        <div className="inline-flex rounded-[10px] bg-secondary p-0.5" role="group" aria-label="View">
          <ViewLink href={hrefWith("/leads", sp, { view: undefined, page: undefined })} active={view === "board"} icon={Kanban} label="Board" />
          <ViewLink href={hrefWith("/leads", sp, { view: "table" })} active={view === "table"} icon={List} label="Table" />
        </div>
        <Link
          href={hrefWith("/leads", sp, { mine: mine ? undefined : "1", page: undefined })}
          aria-pressed={mine}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition-colors",
            mine ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Assigned to me
        </Link>
      </div>
      <div className="mb-4">
        <FilterTabs param="source" allLabel="All sources" options={options(LEAD_SOURCE_LABELS)} />
      </div>

      {isEmpty ? (
        <EmptyState
          icon={Inbox}
          title={filtered ? "No leads match these filters" : "No enquiries yet"}
          description={
            filtered
              ? "Try a different search or clear the filters."
              : "Website enquiries land here automatically. Use “New enquiry” for WhatsApp, calls and walk-ins."
          }
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link href="/leads">Clear filters</Link>
              </Button>
            ) : undefined
          }
        />
      ) : board ? (
        <LeadBoard columns={board} now={now} />
      ) : table ? (
        <div className="space-y-4">
          <FilterTabs
            param="status"
            allLabel="All stages"
            options={LEAD_STATUSES.map((s) => ({ value: s, label: statusMeta("lead", s).label, count: table.counts[s] ?? 0 }))}
          />
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <LeadTable rows={table.items} now={now} />
          </div>
          <Pagination page={table.page} totalPages={table.totalPages} />
        </div>
      ) : null}
    </>
  );
}

function ViewLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: typeof List; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
