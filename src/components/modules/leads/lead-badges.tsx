/**
 * Small lead indicators: where the enquiry came from, and how long a new lead
 * has waited for its first call (amber after 1 h, red once the 2 h SLA breaks).
 */
import { Clock, Ellipsis, Globe, MessageCircle, Phone, Store, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LEAD_FIRST_RESPONSE_SLA_HOURS, LEAD_SOURCE_LABELS, type LeadSource } from "@/lib/constants";

const SOURCE_ICONS: Record<LeadSource, LucideIcon> = {
  website: Globe,
  whatsapp: MessageCircle,
  phone: Phone,
  walk_in: Store,
  referral: Users,
  other: Ellipsis,
};

export function SourceLabel({ source }: { source: LeadSource }) {
  const Icon = SOURCE_ICONS[source];
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {LEAD_SOURCE_LABELS[source]}
    </span>
  );
}

function formatWait(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} days`;
}

/** Only rendered for leads still waiting for their first call. */
export function SlaBadge({ waitingHours }: { waitingHours: number | null }) {
  if (waitingHours === null) return null;
  const wait = formatWait(waitingHours);
  if (waitingHours >= LEAD_FIRST_RESPONSE_SLA_HOURS) {
    return (
      <Badge variant="danger" title="First-call SLA of 2 hours breached">
        <Clock aria-hidden="true" />
        Uncontacted · {wait}
      </Badge>
    );
  }
  if (waitingHours >= 1) return <Badge variant="warning">Call soon · {wait}</Badge>;
  return <Badge variant="info">New · {wait}</Badge>;
}
