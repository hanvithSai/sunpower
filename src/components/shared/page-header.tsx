/**
 * PageHeader — the title block at the top of every app page.
 *
 *   <PageHeader
 *     title="Leads"
 *     description="Every enquiry from the website, WhatsApp, calls and walk-ins."
 *     breadcrumbs={[{ label: "Sales" }, { label: "Leads" }]}
 *     actions={<Button>New enquiry</Button>}
 *   />
 *
 * Breadcrumbs with an `href` render as links; the last crumb without one is marked as the
 * current page. Breadcrumbs and actions are hidden when printing. Server-safe.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Breadcrumb = { label: string; href?: string };

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
};

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" data-print-hide>
            <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="rounded-sm transition-colors hover:text-foreground"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
                    )}
                    {!isLast ? (
                      <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-9">{title}</h1>
        {description ? <div className="max-w-2xl text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2" data-print-hide>
          {actions}
        </div>
      ) : null}
    </header>
  );
}
