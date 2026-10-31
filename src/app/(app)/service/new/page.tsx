/**
 * Raise a ticket. Find the customer by phone or the unit by serial (⌘K lands
 * here too); the warranty decision and the customer's installed units show
 * before anyone types the complaint, so support can tell the caller straight
 * away whether it's free.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Phone, SearchX } from "lucide-react";
import { CreateTicketForm } from "@/components/modules/service/ticket-forms";
import { WarrantyCard } from "@/components/modules/service/warranty-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Section } from "@/components/shared/section";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORY_LABELS, TICKET_CATEGORY_LABELS, type TicketCategory } from "@/lib/constants";
import { formatDate, formatPhone, telLink, waLink } from "@/lib/format";
import { first, type SearchParamsRecord } from "@/lib/query";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { searchRecords } from "@/server/services/search";
import { previewTicket } from "@/server/services/tickets";

export const metadata: Metadata = { title: "New ticket" };

const CATEGORY_FOR: Partial<Record<string, TicketCategory>> = { inverter: "fault_code", battery: "battery", panel: "low_generation", charge_controller: "battery" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser(["support"]);
  const sp = await searchParams;
  const now = new Date();
  const serial = first(sp.serial);
  const customerId = first(sp.customerId);
  const q = first(sp.q);

  let preview: Awaited<ReturnType<typeof previewTicket>> | null = null;
  let problem: string | null = null;
  if (serial || customerId) {
    try {
      preview = await previewTicket({ serial, customerId }, now);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      problem = error.message;
    }
  }
  const matches = !preview && q ? (await searchRecords(q, user.role, now)).filter((r) => r.type === "serial" || r.type === "customer") : [];
  const unit = preview?.units.find((u) => u.serial === preview?.decision.serial);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="New service ticket" breadcrumbs={[{ label: "Service", href: "/service" }, { label: "New" }]} description="Find the customer or the unit first — the warranty answer comes before the paperwork." />

      {!preview ? (
        <Section title="Who's calling?">
          <div className="max-w-md">
            <SearchInput param="q" placeholder="Phone number, name or serial (last 4 is enough)" />
          </div>
          {problem ? <p className="mt-3 text-sm text-danger-foreground">{problem}</p> : null}
          {q ? (
            matches.length ? (
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
                {matches.map((m) => (
                  <li key={`${m.type}:${m.id}`}>
                    <Link href={m.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/50">
                      <span className="min-w-0">
                        <span className={cn("block truncate font-medium", m.type === "serial" && "font-mono text-sm")}>{m.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.subtitle}</span>
                      </span>
                      {m.badge ? <span className="shrink-0 text-xs text-muted-foreground">{m.badge}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState icon={SearchX} title={`No customer or serial matches “${q}”`} description="Try the phone number on the enquiry, or the serial printed on the inverter label." />
              </div>
            )
          ) : null}
        </Section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <WarrantyCard
              state={preview.decision.state}
              basis={preview.decision.basis}
              endsAt={preview.decision.endsAt}
              daysLeft={preview.decision.info.daysLeft}
              serial={preview.decision.serial}
              productName={preview.decision.productName}
            />
            <Section title="Raise the ticket">
              <CreateTicketForm serial={serial} customerId={serial ? undefined : customerId} defaultCategory={(unit && CATEGORY_FOR[unit.category]) || "no_power"} />
            </Section>
          </div>

          <aside className="space-y-6">
            {preview.customer ? (
              <Section title="Customer">
                <div className="space-y-3 text-sm">
                  <p className="font-medium">{preview.customer.name}</p>
                  <p className="text-muted-foreground">{[preview.customer.address.line1, preview.customer.address.city].filter(Boolean).join(", ")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline">
                      <a href={telLink(preview.customer.phone)}>
                        <Phone aria-hidden="true" />
                        Call
                      </a>
                    </Button>
                    <Button asChild variant="outline">
                      <a href={waLink(preview.customer.phone)} target="_blank" rel="noreferrer">
                        <MessageCircle aria-hidden="true" />
                        WhatsApp
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatPhone(preview.customer.phone)}</p>
                </div>
              </Section>
            ) : null}

            <Section title="Installed units" description="Pick the faulty one to check its own warranty." contentClassName="p-0">
              {preview.units.length ? (
                <ul className="divide-y divide-border">
                  {preview.units.map((u) => (
                    <li key={u.serial}>
                      <Link
                        href={`/service/new?serial=${u.serial}`}
                        aria-current={u.serial === preview.decision.serial ? "true" : undefined}
                        className={cn("block px-5 py-2.5 hover:bg-secondary/50", u.serial === preview.decision.serial && "bg-primary/6")}
                      >
                        <span className="block font-mono text-xs">{u.serial}</span>
                        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{PRODUCT_CATEGORY_LABELS[u.category]}</span>
                          <span className={u.info.state === "out_of_warranty" ? "text-danger-foreground" : ""}>{u.warrantyEndAt ? `to ${formatDate(u.warrantyEndAt)}` : "not started"}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-muted-foreground">No units installed yet.</p>
              )}
              {preview.customer && preview.decision.serial ? (
                <Link href={`/service/new?customerId=${preview.customer.id}`} className="block border-t border-border px-5 py-2.5 text-sm text-primary hover:underline">
                  Fault without a serial (wiring, earthing, roof)?
                </Link>
              ) : null}
            </Section>

            {preview.openTickets.length ? (
              <Section title="Already open">
                <ul className="space-y-2 text-sm">
                  {preview.openTickets.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <Link href={`/service/${t.id}`} className="font-mono text-xs text-primary hover:underline">
                        {t.number}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">{TICKET_CATEGORY_LABELS[t.category]}</span>
                      <StatusBadge kind="ticket" status={t.status} />
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
