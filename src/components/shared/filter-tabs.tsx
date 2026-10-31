"use client";

/**
 * FilterTabs — pill links that filter a list through the URL (?status=…).
 *
 *   <FilterTabs
 *     param="status"
 *     options={[{ value: "new", label: "New", count: 12 }, { value: "won", label: "Won" }]}
 *   />
 *
 * "All" removes the param; every link keeps the other params and drops `page`.
 * Plain links, so filters work with middle-click, back/forward and no JavaScript.
 * It carries its own <Suspense> boundary because it reads `useSearchParams()`.
 */
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type FilterTabOption = { value: string; label: string; count?: number };

export type FilterTabsProps = {
  param: string;
  options: FilterTabOption[];
  /** Label of the "no filter" pill. Defaults to "All". */
  allLabel?: string;
};

export function FilterTabs({ param, options, allLabel = "All" }: FilterTabsProps) {
  // Until the URL is known, links still work: they keep the path and set just this param.
  const fallbackHref = (value: string) => (value ? `?${new URLSearchParams({ [param]: value })}` : "?");

  return (
    <Suspense fallback={<FilterPills options={withAll(options, allLabel)} hrefFor={fallbackHref} active={null} />}>
      <UrlFilterTabs param={param} options={options} allLabel={allLabel} />
    </Suspense>
  );
}

function withAll(options: FilterTabOption[], allLabel: string): FilterTabOption[] {
  return [{ value: "", label: allLabel }, ...options];
}

function UrlFilterTabs({ param, options, allLabel }: Required<FilterTabsProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(param) ?? "";

  function hrefFor(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    params.delete("page");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return <FilterPills options={withAll(options, allLabel)} hrefFor={hrefFor} active={active} />;
}

type FilterPillsProps = {
  options: FilterTabOption[];
  hrefFor: (value: string) => string;
  /** null while the URL is not known yet (Suspense fallback). */
  active: string | null;
};

function FilterPills({ options, hrefFor, active }: FilterPillsProps) {
  return (
    <nav aria-label="Filters" className="-mx-1 overflow-x-auto px-1 py-1" data-print-hide>
      <ul className="flex w-max items-center gap-1.5">
        {options.map((option) => {
          const isActive = active !== null && option.value === active;
          return (
            <li key={option.value || "__all"}>
              <Link
                href={hrefFor(option.value)}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap",
                  "transition-colors duration-150 ease-out pointer-coarse:h-11",
                  isActive
                    ? "bg-foreground text-white"
                    : "bg-card text-muted-foreground ring-1 ring-border ring-inset hover:bg-accent hover:text-foreground",
                )}
              >
                {option.label}
                {typeof option.count === "number" ? (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-center text-[11px] leading-4 font-semibold tabular-nums",
                      isActive ? "bg-white/20 text-white" : "bg-secondary text-foreground/70",
                    )}
                  >
                    {option.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
