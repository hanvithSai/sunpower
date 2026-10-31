/**
 * One installation job. For the crew on a phone: who, where, the kit and its
 * serials, Start (once delivered) and the completion form with photos and the
 * customer's signature. For the office: reschedule / change crew. Once
 * completed it shows the proof, the printable certificate and the customer's
 * certificate link to send on WhatsApp.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, CalendarClock, MapPin, MessageCircle, Phone, Play, Users } from "lucide-react";
import { CompleteJobForm } from "@/components/modules/jobs/complete-job-form";
import { RescheduleJobDialog } from "@/components/modules/jobs/reschedule-job-dialog";
import { mapsLink } from "@/components/modules/jobs/work-card";
import { ActionButton } from "@/components/shared/action-button";
import { CopyButton } from "@/components/shared/copy-button";
import { DetailList } from "@/components/shared/detail-list";
import { MediaGallery } from "@/components/shared/media-gallery";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone, telLink, toDateInputValue, toDateTimeInputValue, waLink } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { listActivity } from "@/server/services/core/activity";
import { activeCertificateLink } from "@/server/services/finance";
import { getJobDetail } from "@/server/services/jobs";
import { listStaff } from "@/server/services/users";
import { revokeShareLinkAction } from "@/server/actions/finance";
import { certificateLinkAction, startJobAction } from "@/server/actions/jobs";

export const metadata: Metadata = { title: "Installation" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "technician", "warehouse", "support"]);
  const { id } = await params;
  const now = new Date();
  const detail = await getJobDetail(id);
  if (!detail) notFound();
  const { job, customer, order, serials, extraProducts } = detail;
  // Service visits are worked from their ticket.
  if (job.type === "service" && job.ticketId) redirect(`/service/${job.ticketId}`);

  const onCrew = job.technicianIds.includes(user.id);
  if (user.role === "technician" && !onCrew) notFound();
  const crewCanAct = onCrew || user.role === "admin";
  const canReschedule = (user.role === "sales" || user.role === "admin") && job.status === "scheduled";
  const delivered = !order || order.status === "delivered";
  const [activity, technicians, certLink, requestHeaders] = await Promise.all([
    listActivity("job", job.id),
    canReschedule ? listStaff({ roles: ["technician"] }) : Promise.resolve([]),
    job.status === "completed" ? activeCertificateLink(job.id, now) : Promise.resolve(null),
    headers(),
  ]);
  // The link must open on the host the customer can reach (production domain, preview or local).
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const certUrl = certLink && host ? `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${host}/share/${certLink.token}` : null;
  const address = [job.siteAddress.line1, job.siteAddress.city, job.siteAddress.pincode].filter(Boolean).join(", ");
  const extrasPaise = job.materialsUsed.reduce((s, m) => s + m.costPaise, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${job.number} · ${customer?.name ?? ""}`}
        breadcrumbs={[{ label: user.role === "technician" ? "My work" : "Installations", href: user.role === "technician" ? "/my-work" : "/jobs" }, { label: job.number }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge kind="job" status={job.status} />
            <span>{job.title}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-4" aria-hidden="true" />
              {formatDateTime(job.scheduledFor)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canReschedule ? (
              <RescheduleJobDialog
                jobId={job.id}
                scheduledFor={toDateTimeInputValue(job.scheduledFor)}
                minDate={`${toDateInputValue(now)}T00:00`}
                crewIds={job.technicianIds}
                leadId={job.crew.find((c) => c.lead)?.id}
                technicians={technicians}
              />
            ) : null}
            {job.status === "completed" ? (
              <Button asChild>
                <Link href={`/jobs/${job.id}/certificate`}>
                  <Award aria-hidden="true" />
                  Certificate
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {job.status === "scheduled" && order?.feasibilityPending ? (
            <p role="status" className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
              PM Surya Ghar: the DISCOM hasn&apos;t approved feasibility for this site yet. Installing first can cost the customer the subsidy, so check with sales before going.
            </p>
          ) : null}
          {job.status === "scheduled" && crewCanAct ? (
            <Section title="On site">
              {delivered ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Tap Start when the crew reaches the roof. The clock starts and the order moves to Installing.</p>
                  <ActionButton action={startJobAction} hiddenFields={{ jobId: job.id }} size="lg" className="w-full sm:w-auto">
                    <Play aria-hidden="true" />
                    Start installation
                  </ActionButton>
                </div>
              ) : (
                <p className="rounded-xl bg-warning/12 px-3 py-2.5 text-sm font-medium text-warning-foreground">
                  Start unlocks when the kit is delivered to site (order is {order ? order.status.replace(/_/g, " ") : "—"}).
                </p>
              )}
            </Section>
          ) : null}

          {job.status === "in_progress" && crewCanAct ? (
            <Section title="Complete the installation" description="Everything below is the customer's proof of the job.">
              <CompleteJobForm
                jobId={job.id}
                orderKw={order?.capacityKw ?? null}
                customerName={customer?.name ?? ""}
                startedAt={toDateTimeInputValue(job.startedAt ?? now)}
                now={toDateTimeInputValue(now)}
                extraProducts={extraProducts}
              />
            </Section>
          ) : null}

          {job.status === "completed" ? (
            <>
              <Section title="Proof of installation">
                <DetailList
                  items={[
                    { label: "On site", value: `${formatDateTime(job.startedAt)} – ${formatDateTime(job.finishedAt)}` },
                    { label: "Installed", value: `${job.confirmedKw} kW${job.kwChangeReason ? ` (${job.kwChangeReason})` : ""}` },
                    { label: "Generation at handover", value: job.generationReadingKw !== undefined ? `${job.generationReadingKw} kW` : "Tested" },
                    { label: "Kit", value: job.kitCheck?.complete ? "Complete" : `Missing: ${job.kitCheck?.missing ?? "—"}` },
                    { label: "Accepted by", value: job.signature ? `${job.signature.signedBy}, ${formatDateTime(job.signature.signedAt)}` : "—" },
                    ...(job.customerRemarks ? [{ label: "Customer remarks", value: job.customerRemarks }] : []),
                  ]}
                />
                {job.signature ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL captured on the tablet
                  <img src={job.signature.dataUrl} alt={`Signature of ${job.signature.signedBy}`} className="mt-4 h-24 w-auto rounded-lg border border-border bg-white p-1" />
                ) : null}
              </Section>
              <Section title="Photos">
                <MediaGallery ids={job.photos} emptyText="No photos" />
              </Section>
              <Section title="Labour and extras" contentClassName="space-y-3">
                <ul className="divide-y divide-border text-sm">
                  {job.timeLogs.map((t) => (
                    <li key={t.technicianId} className="flex justify-between py-2">
                      <span>{t.technicianName}</span>
                      <span className="tabular-nums">{t.hours} h</span>
                    </li>
                  ))}
                  {job.materialsUsed.map((m) => (
                    <li key={m.sku} className="flex justify-between py-2">
                      <span>
                        Extra {m.qty} {m.unit} {m.name}
                      </span>
                      <span className="tabular-nums">{formatINR(m.costPaise)}</span>
                    </li>
                  ))}
                </ul>
                {extrasPaise ? <p className="text-xs text-muted-foreground">Extra material at cost is charged to the order&apos;s profit.</p> : null}
              </Section>
            </>
          ) : null}

          <Section title="Kit for this job" description={order ? `${order.number} · ${order.capacityKw} kW ${order.systemLabel}` : undefined} contentClassName="p-0">
            {serials.length ? (
              <ul className="divide-y divide-border">
                {serials.map((s) => (
                  <li key={s.serial} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs">{s.serial}</span>
                      <span className="block text-xs text-muted-foreground">
                        {PRODUCT_CATEGORY_LABELS[s.category]} · {s.productName}
                      </span>
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      <StatusBadge kind="serial" status={s.status} />
                      {s.warrantyEndAt ? <span className="block">Warranty to {formatDate(s.warrantyEndAt)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">Serials appear once the warehouse scans the kit.</p>
            )}
            {order ? (
              <details className="border-t border-border px-5 py-3 text-sm">
                <summary className="cursor-pointer text-primary">All {order.lines.length} items on the pick list</summary>
                <ul className="mt-2 space-y-1">
                  {order.lines.map((l) => (
                    <li key={l.sku} className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{l.name}</span>
                      <span className="tabular-nums">
                        {l.qty} {l.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Section>

          <Section title="Activity">
            <Timeline items={activity.map((a) => ({ id: a.id, title: a.title, at: a.at, actor: a.actor }))} />
          </Section>
        </div>

        <aside className="space-y-6">
          {customer && job.status === "completed" && job.type === "installation" && user.role !== "warehouse" ? (
            <Section title="Customer's certificate" description="A read-only link with every serial and warranty date. No login needed.">
              {certLink && certUrl ? (
                <div className="space-y-3 text-sm">
                  <Button asChild className="w-full">
                    <a
                      href={waLink(
                        customer.phone,
                        `Namaste ${customer.name.split(" ")[0]} garu, thank you for choosing SunPower. Your installation certificate with every serial number and warranty date: ${certUrl}`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle aria-hidden="true" />
                      Send on WhatsApp
                    </a>
                  </Button>
                  <div className="flex items-center gap-2">
                    <CopyButton value={certUrl} label="Copy link" />
                    {user.role === "admin" ? (
                      <ActionButton action={revokeShareLinkAction} hiddenFields={{ shareLinkId: certLink.id }} variant="ghost" size="sm">
                        Turn off link
                      </ActionButton>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Works until {formatDate(certLink.expiresAt)} · opened {certLink.viewCount} time{certLink.viewCount === 1 ? "" : "s"}
                  </p>
                </div>
              ) : (
                <ActionButton action={certificateLinkAction} hiddenFields={{ jobId: job.id }} variant="outline" className="w-full">
                  <Award aria-hidden="true" />
                  Create customer link
                </ActionButton>
              )}
            </Section>
          ) : null}

          {customer ? (
            <Section title="Customer">
              <div className="space-y-3 text-sm">
                <p className="font-medium">{customer.name}</p>
                <a href={mapsLink(address)} target="_blank" rel="noreferrer" className="ph-no-capture flex items-start gap-1.5 text-primary hover:underline">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {address}
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <a href={telLink(customer.phone)}>
                      <Phone aria-hidden="true" />
                      Call
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={waLink(customer.phone)} target="_blank" rel="noreferrer">
                      <MessageCircle aria-hidden="true" />
                      WhatsApp
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPhone(customer.phone)}
                  {customer.discom ? ` · ${customer.discom}` : ""}
                </p>
              </div>
            </Section>
          ) : null}

          <Section title="Crew">
            <ul className="space-y-2 text-sm">
              {job.crew.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                    {c.name}
                    {c.lead ? <span className="text-xs text-muted-foreground">(lead)</span> : null}
                  </span>
                  {c.phone ? (
                    <a href={telLink(c.phone)} className="text-xs text-primary hover:underline">
                      {formatPhone(c.phone)}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Estimated {job.estimatedHours} h on site.</p>
          </Section>

          {order ? (
            <Section title="Order">
              <DetailList
                columns={1}
                items={[
                  { label: "Order", value: user.role === "technician" ? order.number : <Link className="text-primary hover:underline" href={`/orders/${order.id}`}>{order.number}</Link> },
                  { label: "Status", value: <StatusBadge kind="order" status={order.status} /> },
                  ...(order.deliveredAt ? [{ label: "Kit delivered", value: formatDateTime(order.deliveredAt) }] : []),
                  ...(order.commissionedAt ? [{ label: "Commissioned", value: formatDateTime(order.commissionedAt) }] : []),
                ]}
              />
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
