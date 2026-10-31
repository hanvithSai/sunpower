/**
 * Director's dashboard: the lifecycle pipeline (every open project, stage by
 * stage), then today / this week / this month — which installations
 * made or lost money, what is still unfinished, open repairs and subsidy —
 * with a read-only share link and CSV exports.
 */
import type { Metadata } from "next";
import { DashboardView } from "@/components/modules/dashboard/dashboard-view";
import { LifecyclePipeline } from "@/components/modules/dashboard/lifecycle-pipeline";
import { SharePanel } from "@/components/modules/dashboard/share-panel";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { RANGE_LABELS, type RangeKey } from "@/lib/dates";
import { formatDate, toDateInputValue } from "@/lib/format";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { getDashboard, getPipeline } from "@/server/services/dashboard";
import { listShareLinks } from "@/server/services/finance";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser([]);
  const sp = await searchParams;
  const now = new Date();
  const param = first(sp.range);
  const range: RangeKey = param === "today" || param === "week" ? param : "month";
  const [data, links, pipeline] = await Promise.all([getDashboard(range, now), listShareLinks(now), getPipeline(now)]);

  return (
    <>
      <PageHeader
        title={`Good ${now.getUTCHours() + 5.5 < 12 ? "morning" : now.getUTCHours() + 5.5 < 17 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`}
        description={`${RANGE_LABELS[range]} · ${formatDate(data.period.start)} – ${formatDate(new Date(data.period.end.getTime() - 1))}`}
        actions={<SharePanel links={links} range={range} month={toDateInputValue(now).slice(0, 7)} />}
      />
      <LifecyclePipeline stages={pipeline} />
      <div className="mt-6 mb-5">
        <FilterTabs
          param="range"
          allLabel="This month"
          options={[
            { value: "week", label: "This week" },
            { value: "today", label: "Today" },
          ]}
        />
      </div>
      <DashboardView data={data} linkable now={now} />
    </>
  );
}
