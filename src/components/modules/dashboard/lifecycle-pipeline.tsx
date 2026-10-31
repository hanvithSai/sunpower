/**
 * The dashboard's top strip: every open project, stage by stage, from enquiry
 * to commissioning (getPipeline in src/server/services/dashboard.ts). One
 * connected band on deep forest — the same energy line as the landing page —
 * where each stage links to the module that moves it forward.
 */
import Link from "next/link";
import type { PipelineStage } from "@/server/services/dashboard";
import { cn } from "@/lib/utils";

export function LifecyclePipeline({ stages, linkable = true }: { stages: PipelineStage[]; linkable?: boolean }) {
  const total = stages.slice(0, -1).reduce((t, s) => t + s.count, 0);

  return (
    <section aria-labelledby="pipeline-title" className="overflow-hidden rounded-xl bg-forest text-forest-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <h2 id="pipeline-title" className="text-lg font-semibold text-white">
          Every project, stage by stage
        </h2>
        <p className="text-sm text-forest-muted">
          <span className="font-semibold text-white tabular-nums">{total}</span> open from enquiry to installation
        </p>
      </div>
      <ol className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 [&>li]:min-w-0">
        {stages.map((s) => {
          const body = (
            <>
              <span className="flex min-w-0 items-start gap-2 text-[13px] leading-tight">
                <span
                  aria-hidden="true"
                  className={cn("mt-1 size-2 shrink-0 rounded-full", s.count > 0 ? (s.key === "commissioned" ? "bg-sun" : "bg-volt") : "bg-white/20")}
                />
                <span className="min-w-0 font-medium break-words text-forest-foreground">{s.label}</span>
              </span>
              <span className="mt-2 block font-display text-3xl font-semibold text-white tabular-nums">{s.count}</span>
              <span className="mt-0.5 block text-xs leading-snug text-forest-muted">{s.note}</span>
            </>
          );
          return (
            <li key={s.key} className="min-w-0 border-t border-white/10 xl:border-l xl:first:border-l-0">
              {linkable ? (
                <Link
                  href={s.href}
                  className="block h-full min-w-0 px-4 py-4 transition-colors hover:bg-white/6 focus-visible:-outline-offset-2"
                  aria-label={`${s.label}: ${s.count} ${s.note}`}
                >
                  {body}
                </Link>
              ) : (
                <div className="min-w-0 px-4 py-4">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
