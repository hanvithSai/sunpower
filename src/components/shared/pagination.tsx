"use client";

/**
 * Pagination — "Page 2 of 7" with Previous / Next links that keep the other query params.
 *
 *   <Pagination page={page} totalPages={totalPages} />
 *
 * Page 1 drops the `page` param for clean URLs. Renders nothing when there is only one page.
 * It carries its own <Suspense> boundary because it reads `useSearchParams()`.
 */
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export type PaginationProps = {
  page: number;
  totalPages: number;
};

export function Pagination({ page, totalPages }: PaginationProps) {
  const total = Math.max(1, Math.floor(totalPages) || 1);
  if (total <= 1) return null;
  const current = Math.min(Math.max(1, Math.floor(page) || 1), total);

  return (
    <Suspense fallback={<PaginationBar page={current} totalPages={total} prevHref={null} nextHref={null} />}>
      <UrlPagination page={current} totalPages={total} />
    </Suspense>
  );
}

function UrlPagination({ page, totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <PaginationBar
      page={page}
      totalPages={totalPages}
      prevHref={page > 1 ? hrefFor(page - 1) : null}
      nextHref={page < totalPages ? hrefFor(page + 1) : null}
    />
  );
}

type PaginationBarProps = PaginationProps & { prevHref: string | null; nextHref: string | null };

function PaginationBar({ page, totalPages, prevHref, nextHref }: PaginationBarProps) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4" data-print-hide>
      <p className="text-[13px] text-muted-foreground tabular-nums">
        Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {prevHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={prevHref} rel="prev">
              <ChevronLeft aria-hidden="true" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
        )}
        {nextHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={nextHref} rel="next">
              Next
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </nav>
  );
}
