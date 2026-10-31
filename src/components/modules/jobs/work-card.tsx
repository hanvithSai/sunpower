/**
 * One survey, installation or service visit on the technician's agenda:
 * when, where (with a maps link), who to call, and what's blocking it.
 * Big tap targets for a phone held in one hand. Server-safe.
 */
import Link from "next/link";
import { ClipboardCheck, Clock, MapPin, MessageCircle, Phone, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatTime, telLink, waLink } from "@/lib/format";
import { cn } from "@/lib/utils";

export type WorkItem = {
  kind: "survey" | "installation" | "service";
  id: string;
  href: string;
  number: string;
  title: string;
  at: Date;
  status: string;
  customerName: string;
  phone?: string;
  address: string;
  blocker?: string;
};

export function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function WorkCard({ item, timeOnly = false }: { item: WorkItem; timeOnly?: boolean }) {
  const Icon = item.kind === "survey" ? ClipboardCheck : Wrench;
  return (
    <article className={cn("rounded-2xl border bg-card p-4 shadow-sm", item.status === "in_progress" ? "border-warning/60" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{item.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {item.title} · <span className="font-mono">{item.number}</span>
            </p>
          </div>
        </div>
        <StatusBadge kind={item.kind === "survey" ? "survey" : "job"} status={item.status} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm">
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
        {timeOnly ? formatTime(item.at) : formatDateTime(item.at)}
      </p>
      <a href={mapsLink(item.address)} target="_blank" rel="noreferrer" className="mt-1 flex items-start gap-1.5 text-sm text-primary hover:underline">
        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {item.address}
      </a>
      {item.blocker ? <p className="mt-2 rounded-lg bg-warning/12 px-2.5 py-1.5 text-xs font-medium text-warning-foreground">{item.blocker}</p> : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {item.phone ? (
          <>
            <Button asChild variant="outline" size="lg">
              <a href={telLink(item.phone)} aria-label={`Call ${item.customerName}`}>
                <Phone aria-hidden="true" />
                Call
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={waLink(item.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${item.customerName}`}>
                <MessageCircle aria-hidden="true" />
                Chat
              </a>
            </Button>
          </>
        ) : (
          <span className="col-span-2" />
        )}
        <Button asChild size="lg">
          <Link href={item.href}>Open</Link>
        </Button>
      </div>
    </article>
  );
}
