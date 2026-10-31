/**
 * The technician's home on their phone: what's in progress, today's surveys
 * and installations in order, what's coming up, and hours logged this month.
 * Nobody has to phone the crew — new jobs appear here the moment an order is
 * confirmed.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Sun, Timer } from "lucide-react";
import { WorkCard } from "@/components/modules/jobs/work-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getMyWork } from "@/server/services/jobs";

export const metadata: Metadata = { title: "My work" };

export default async function MyWorkPage() {
  const user = await requireUser(["technician"]);
  const now = new Date();
  const work = await getMyWork(user.id, now);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Hello, ${firstName}`} description={`${formatDate(now)} · your surveys and installations`} />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Today" value={work.today.length + work.inProgress.length} hint="Visits on your list" icon={CalendarCheck} tone="brand" />
        <StatCard label="Hours this month" value={work.hoursThisMonth.toLocaleString("en-IN")} hint={`${work.jobsThisMonth} job${work.jobsThisMonth === 1 ? "" : "s"} logged`} icon={Timer} tone="info" />
      </div>

      {work.inProgress.length ? (
        <section aria-labelledby="now-heading" className="mb-6">
          <h2 id="now-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-warning-foreground">
            In progress
          </h2>
          <div className="space-y-3">
            {work.inProgress.map((item) => (
              <WorkCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="today-heading" className="mb-6">
        <h2 id="today-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </h2>
        {work.today.length ? (
          <div className="space-y-3">
            {work.today.map((item) => (
              <WorkCard key={item.id} item={item} timeOnly />
            ))}
          </div>
        ) : (
          <EmptyState icon={Sun} title="Nothing else today" description="New surveys and installations appear here automatically." />
        )}
      </section>

      {work.upcoming.length ? (
        <section aria-labelledby="next-heading" className="mb-6">
          <h2 id="next-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coming up
          </h2>
          <div className="space-y-3">
            {work.upcoming.map((item) => (
              <WorkCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {work.recentDone.length ? (
        <section aria-labelledby="done-heading">
          <h2 id="done-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Done this week
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {work.recentDone.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{j.customerName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {j.title} · <span className="font-mono">{j.number}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(j.finishedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
