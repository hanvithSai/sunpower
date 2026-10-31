/**
 * StatusBadge — the single way to show a domain status (lead, order, ticket, warranty …).
 * Label and colour come from STATUS_META in @/lib/constants, so every screen agrees;
 * unknown values degrade to a neutral badge with a humanised label.
 *
 *   <StatusBadge kind="ticket" status={ticket.status} />
 */
import type { StatusKind } from "@/lib/constants";
import { statusMeta } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export type StatusBadgeProps = {
  kind: StatusKind;
  status: string;
  className?: string;
};

export function StatusBadge({ kind, status, className }: StatusBadgeProps) {
  const meta = statusMeta(kind, status);
  const label = meta.label.charAt(0).toUpperCase() + meta.label.slice(1);

  return (
    <Badge variant={meta.tone} className={className} data-status={status}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      {label}
    </Badge>
  );
}
