/**
 * One lead, end to end: contact actions, the qualification call checklist,
 * the site survey (reviewed right here once the technician submits it), the
 * quote gate (locked until the survey is approved), and the full activity
 * timeline.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, FileText, Lock, Mail, MapPin, MessageCircle, Phone, PhoneCall, RotateCcw } from "lucide-react";
import { AssignOwnerForm, MarkLostDialog, QualifyForm, ScheduleSurveyForm } from "@/components/modules/leads/lead-forms";
import { LeadProgress } from "@/components/modules/leads/lead-progress";
import { SlaBadge, SourceLabel } from "@/components/modules/leads/lead-badges";
import { SurveyReview } from "@/components/modules/surveys/survey-review";
import { ActionButton } from "@/components/shared/action-button";
import { DetailList } from "@/components/shared/detail-list";
import { MediaGallery } from "@/components/shared/media-gallery";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_TYPE_LABELS,
  REQUESTED_SYSTEM_TYPE_LABELS,
  ROOF_DIRECTION_LABELS,
  ROOF_TYPE_LABELS,
  SYSTEM_TYPE_LABELS,
} from "@/lib/constants";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { formatDate, formatDateTime, formatPhone, formatRelative, telLink, toDateTimeInputValue, waLink } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { markContactedAction, reopenLeadAction } from "@/server/actions/leads";
import { listActivity } from "@/server/services/core/activity";
import { getLeadDetail } from "@/server/services/leads";
import { listStaff } from "@/server/services/users";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "support"]);
  const { id } = await params;
  const now = new Date();

  const detail = await getLeadDetail(id, now);
  if (!detail) notFound();
  const { lead, customer, surveys, quotes, order, canQuote } = detail;

  const canEdit = user.role === "sales" || user.role === "admin";
  const [technicians, owners, activity] = await Promise.all([
    canEdit ? listStaff({ roles: ["technician"], skill: "survey" }) : Promise.resolve([]),
    canEdit ? listStaff({ roles: ["sales", "admin"] }) : Promise.resolve([]),
    listActivity("lead", lead.id),
  ]);

  const firstName = lead.name.split(" ")[0];
  const greeting = `Namaste ${firstName} garu! This is ${user.name} from SunPower Solutions about your rooftop solar enquiry ${lead.number}. When is a good time to talk?`;
  const latestSurvey = surveys[0];
  const surveyDefaultWhen = toDateTimeInputValue(addHours(addDays(startOfDayIST(now), 1), 10));
  const open = lead.status !== "won" && lead.status !== "lost";

  return (
    <>
      <PageHeader
        title={lead.name}
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: lead.number }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge kind="lead" status={lead.status} />
            <SlaBadge waitingHours={lead.waitingHours} />
            <SourceLabel source={lead.source} />
            <span>Received {formatRelative(lead.createdAt, now)}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {lead.status === "new" ? (
              <ActionButton action={markContactedAction} hiddenFields={{ leadId: lead.id }} variant="outline">
                <PhoneCall aria-hidden="true" />
                Mark contacted
              </ActionButton>
            ) : null}
            {canQuote && canEdit ? (
              <Button asChild>
                <Link href={`/quotes/new?leadId=${lead.id}`}>
                  <FileText aria-hidden="true" />
                  Create quote
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6">
        <LeadProgress status={lead.status} lostReason={lead.lostReason} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-2">
          <Section title="What they asked for">
            <DetailList
              columns={3}
              items={[
                { label: "System", value: `${lead.requirement.capacityKw} kW · ${REQUESTED_SYSTEM_TYPE_LABELS[lead.requirement.systemType]}` },
                { label: "Subsidy help", value: lead.requirement.wantsSubsidy ? "Yes — PM Surya Ghar" : "No" },
                {
                  label: "Monthly bill",
                  value: lead.requirement.monthlyBillRs ? formatINR(lead.requirement.monthlyBillRs * 100) : "—",
                },
                ...(lead.requirement.message ? [{ label: "Message", value: lead.requirement.message }] : []),
              ]}
            />
          </Section>

          <Section
            title="Qualification call"
            description="Shadow-free roof space, electricity bill and grid suitability decide whether a survey is worth a visit."
          >
            {lead.qualification ? (
              <DetailList
                columns={3}
                items={[
                  { label: "Roof area", value: `${lead.qualification.roofAreaSqft.toLocaleString("en-IN")} sq ft` },
                  { label: "Shadow-free", value: `${lead.qualification.shadowFreeAreaSqft.toLocaleString("en-IN")} sq ft` },
                  { label: "Monthly bill", value: formatINR(lead.qualification.monthlyBillRs * 100) },
                  { label: "Sanctioned load", value: lead.qualification.sanctionedLoadKw ? `${lead.qualification.sanctionedLoadKw} kW` : "—" },
                  { label: "Roof", value: ROOF_TYPE_LABELS[lead.qualification.roofType] },
                  { label: "Grid", value: lead.qualification.gridSuitable ? "Suitable for net metering" : "Not suitable" },
                  ...(lead.qualification.notes ? [{ label: "Notes", value: lead.qualification.notes }] : []),
                  {
                    label: "Qualified",
                    value: `${formatDate(lead.qualification.qualifiedAt)}${lead.qualification.qualifiedByName ? ` by ${lead.qualification.qualifiedByName}` : ""}`,
                  },
                ]}
              />
            ) : canEdit && (lead.status === "new" || lead.status === "contacted") ? (
              <QualifyForm leadId={lead.id} requestedKw={lead.capacityKw} monthlyBillRs={lead.requirement.monthlyBillRs} />
            ) : (
              <p className="text-sm text-muted-foreground">Not qualified yet.</p>
            )}
          </Section>

          <Section title="Site survey" description="A technician measures roof direction, tilt, shading and cable distance on site.">
            <div className="space-y-5">
              {lead.status === "qualified" && canEdit ? (
                technicians.length > 0 ? (
                  <ScheduleSurveyForm leadId={lead.id} technicians={technicians} defaultWhen={surveyDefaultWhen} />
                ) : (
                  <p className="text-sm text-muted-foreground">No technician with survey skills is available.</p>
                )
              ) : null}
              {surveys.length === 0 && lead.status !== "qualified" ? (
                <p className="text-sm text-muted-foreground">Book a survey once the lead is qualified.</p>
              ) : null}
              {surveys.map((survey) => (
                <div key={survey.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {survey.number} · {survey.technicianName}
                      </p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(survey.scheduledFor)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge kind="survey" status={survey.status} />
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/surveys/${survey.id}`}>
                          Open
                          <ExternalLink aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {survey.measurements ? (
                    <div className="mt-4 space-y-4">
                      <DetailList
                        columns={3}
                        items={[
                          { label: "Faces", value: ROOF_DIRECTION_LABELS[survey.measurements.roofDirection] },
                          { label: "Tilt", value: `${survey.measurements.tiltDeg}°` },
                          { label: "Shading", value: `${survey.measurements.shadingPct}%` },
                          { label: "Usable area", value: `${survey.measurements.usableAreaSqft.toLocaleString("en-IN")} sq ft` },
                          { label: "Cable run", value: `${survey.measurements.cableDistanceM} m` },
                          {
                            label: "Recommends",
                            value: `${survey.measurements.recommendedKw} kW ${SYSTEM_TYPE_LABELS[survey.measurements.recommendedSystemType]}`,
                          },
                        ]}
                      />
                      {survey.id === latestSurvey?.id && survey.photos.length > 0 ? (
                        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading photos…</p>}>
                          <MediaGallery ids={survey.photos} />
                        </Suspense>
                      ) : null}
                    </div>
                  ) : null}
                  {survey.reviewNote ? <p className="mt-3 text-sm text-muted-foreground">Review note: {survey.reviewNote}</p> : null}
                  {survey.status === "completed" && canEdit ? (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="mb-3 text-sm font-medium text-foreground">Review this survey</p>
                      <SurveyReview surveyId={survey.id} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Quote" description="Built from ready-made package templates with the full bill of materials.">
            {canQuote ? (
              <div className="space-y-3">
                {quotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">The survey is approved. Create the quote from a package template.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {quotes.map((q) => (
                      <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <Link href={`/quotes/${q.id}`} className="font-medium text-foreground hover:text-primary">
                          {q.number} <span className="text-muted-foreground">v{q.version}</span>
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          {q.capacityKw} kW {SYSTEM_TYPE_LABELS[q.systemType]} · {formatINR(q.totalPaise)}
                        </span>
                        <StatusBadge kind="quote" status={q.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
                <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">Quotes unlock after the site survey is approved</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Pricing is based on real roof measurements, so the kit is right and there are no surprises on installation day.
                  </p>
                </div>
              </div>
            )}
            {order ? (
              <p className="mt-4 text-sm">
                Won →{" "}
                <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                  Order {order.number}
                </Link>{" "}
                <StatusBadge kind="order" status={order.status} />
              </p>
            ) : null}
          </Section>

          <Section title="Activity">
            <Timeline
              items={activity.map((a) => ({ id: a.id, title: a.title, at: a.at, actor: a.actor }))}
              emptyText="No activity yet."
            />
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Contact">
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                {formatPhone(lead.phone)}
              </p>
              {lead.email ? (
                <p className="flex items-center gap-2 break-all">
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {lead.email}
                </p>
              ) : null}
              {customer ? (
                <p className="ph-no-capture flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    {[customer.address.line1, customer.address.city, customer.address.pincode].filter(Boolean).join(", ")}
                    <span className="block text-muted-foreground">
                      {CUSTOMER_TYPE_LABELS[customer.type]}
                      {customer.discom ? ` · ${customer.discom}` : ""}
                    </span>
                  </span>
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button asChild variant="outline">
                  <a href={telLink(lead.phone)}>
                    <Phone aria-hidden="true" />
                    Call
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={waLink(lead.phone, greeting)} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden="true" />
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </Section>

          {canEdit ? (
            <Section title="Ownership">
              <AssignOwnerForm leadId={lead.id} owners={owners} currentId={lead.assignedToId} />
            </Section>
          ) : null}

          {canEdit ? (
            <Section title="Close or reopen">
              {open ? (
                <MarkLostDialog leadId={lead.id} />
              ) : lead.status === "lost" ? (
                <ActionButton action={reopenLeadAction} hiddenFields={{ leadId: lead.id }} variant="outline" className="w-full">
                  <RotateCcw aria-hidden="true" />
                  Reopen lead
                </ActionButton>
              ) : (
                <p className="text-sm text-muted-foreground">This lead is won.</p>
              )}
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
