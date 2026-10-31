/**
 * EmptyState — what a list shows when there is nothing to show yet (or no search match).
 *
 *   <EmptyState
 *     icon={UserRoundSearch}
 *     title="No leads match “Ravi”"
 *     description="Try a phone number or clear the filters."
 *     action={<Button asChild><Link href="/leads?new=1">New enquiry</Link></Button>}
 *   />
 *
 * Server-safe, so pages can pass a lucide icon component directly.
 */
import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {description ? <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
