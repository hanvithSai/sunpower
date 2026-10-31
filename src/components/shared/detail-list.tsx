/**
 * DetailList — label/value pairs for record pages (customer, site, system, warranty …).
 *
 *   <DetailList
 *     columns={2}
 *     items={[
 *       { label: "Mobile", value: formatPhone(lead.phone) },
 *       { label: "DISCOM", value: lead.discom },
 *     ]}
 *   />
 *
 * Empty values (null, undefined, "") render as an em dash. Uses <dl> semantics. Server-safe.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DetailListItem = { label: string; value: ReactNode };

export type DetailListProps = {
  items: DetailListItem[];
  columns?: 1 | 2 | 3;
};

const COLUMNS: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function DetailList({ items, columns = 2 }: DetailListProps) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4", COLUMNS[columns])}>
      {items.map((item, index) => {
        const isEmpty = item.value === null || item.value === undefined || item.value === "";
        return (
          <div key={`${item.label}-${index}`} className="min-w-0 space-y-1">
            <dt className="text-[13px] text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-medium wrap-break-word text-foreground">
              {isEmpty ? <span className="text-muted-foreground">—</span> : item.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
