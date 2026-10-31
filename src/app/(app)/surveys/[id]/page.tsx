/**
 * One site survey. The assigned technician fills the measurement form on the
 * roof; sales reviews completed surveys (approve → quote unlocked); everyone
 * else sees the read-only result with photos.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { SurveyForm } from "@/components/modules/surveys/survey-form";
import { SurveyReview } from "@/components/modules/surveys/survey-review";
import { DetailList } from "@/components/shared/detail-list";
import { MediaGallery } from "@/components/shared/media-gallery";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  REQUESTED_SYSTEM_TYPE_LABELS,
  ROOF_DIRECTION_LABELS,
  ROOF_TYPE_LABELS,
  SYSTEM_TYPE_LABELS,
  type SystemType,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone, formatRelative, telLink } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getSurveyDetail } from "@/server/services/surveys";

export const metadata: Metadata = { title: "Site survey" };

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "technician"]);
  const { id } = await params;
  const now = new Date();

  const detail = await getSurveyDetail(id);
  if (!detail) notFound();
  const { survey, lead, customer, technician } = detail;

  const isAssigned = survey.technicianId === user.id;
  if (user.role === "technician" && !isAssigned) notFound();
  const canSubmit = survey.status === "scheduled" && (isAssigned || user.role === "admin");
  const canReview = survey.status === "completed" && (user.role === "sales" || user.role === "admin");

  const address = customer ? [customer.address.line1, customer.address.city, customer.address.pincode].filter(Boolean).join(", ") : "";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const requested = lead?.requirement;
  const requestedType: SystemType = requested?.systemType === "off_grid" || requested?.systemType === "panel_set" ? requested.systemType : "on_grid";
  const m = survey.measurements;

  return (
    <>
      <PageHeader
        title={`${customer?.name ?? "Customer"} · roof survey`}
        breadcrumbs={[{ label: "Surveys", href: "/surveys" }, { label: survey.number }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge kind="survey" status={survey.status} />
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatDateTime(survey.scheduledFor)} ({formatRelative(survey.scheduledFor, now)})
            </span>
            {technician ? <span>Technician: {technician.name}</span> : null}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canSubmit ? (
            <Section title="Measurements" description="Fill this in on the roof. Photos upload as you take them.">
              <SurveyForm
                surveyId={survey.id}
                defaults={{
                  roofType: lead?.qualification?.roofType,
                  usableAreaSqft: lead?.qualification?.shadowFreeAreaSqft,
                  recommendedKw: requested?.capacityKw ?? 3,
                  recommendedSystemType: requestedType,
                }}
              />
            </Section>
          ) : survey.status === "scheduled" ? (
            <Section title="Waiting for the site visit">
              <p className="text-sm text-muted-foreground">
                {technician?.name ?? "The technician"} will submit measurements from the roof on {formatDateTime(survey.scheduledFor)}.
              </p>
            </Section>
          ) : null}

          {m ? (
            <Section title="Measurements" description={survey.completedAt ? `Submitted ${formatDateTime(survey.completedAt)}` : undefined}>
              <div className="space-y-5">
                <DetailList
                  columns={3}
                  items={[
                    { label: "Roof faces", value: ROOF_DIRECTION_LABELS[m.roofDirection] },
                    { label: "Tilt", value: `${m.tiltDeg}°` },
                    { label: "Roof type", value: ROOF_TYPE_LABELS[m.roofType] },
                    { label: "Usable area", value: `${m.usableAreaSqft.toLocaleString("en-IN")} sq ft` },
                    { label: "Shading", value: `${m.shadingPct}%` },
                    { label: "Cable to meter", value: `${m.cableDistanceM} m` },
                    { label: "Floors", value: String(m.floors) },
                    { label: "Earthing", value: m.earthingPossible ? "Space available" : "Needs a solution" },
                    { label: "Recommends", value: `${m.recommendedKw} kW ${SYSTEM_TYPE_LABELS[m.recommendedSystemType]}` },
                  ]}
                />
                {survey.notes ? <p className="text-sm text-muted-foreground">Notes: {survey.notes}</p> : null}
                <Suspense fallback={<p className="text-sm text-muted-foreground">Loading photos…</p>}>
                  <MediaGallery ids={survey.photos} emptyText="No photos were attached." />
                </Suspense>
              </div>
            </Section>
          ) : null}

          {canReview ? (
            <Section title="Review" description="Approving the survey unlocks the quote for this lead.">
              <SurveyReview surveyId={survey.id} />
            </Section>
          ) : null}

          {survey.reviewedAt ? (
            <Section title="Review outcome">
              <p className="text-sm">
                <StatusBadge kind="survey" status={survey.status} /> on {formatDate(survey.reviewedAt)}
                {survey.reviewedByName ? ` by ${survey.reviewedByName}` : ""}
              </p>
              {survey.reviewNote ? <p className="mt-2 text-sm text-muted-foreground">{survey.reviewNote}</p> : null}
            </Section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Section title="Site">
            <div className="space-y-3 text-sm">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  {address || "—"}
                  {customer?.discom ? <span className="block text-muted-foreground">{customer.discom}</span> : null}
                </span>
              </p>
              {customer ? (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                  {formatPhone(customer.phone)}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button asChild variant="outline">
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    <Navigation aria-hidden="true" />
                    Navigate
                  </a>
                </Button>
                {customer ? (
                  <Button asChild variant="outline">
                    <a href={telLink(customer.phone)}>
                      <Phone aria-hidden="true" />
                      Call
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </Section>

          {lead ? (
            <Section title="Customer asked for">
              <DetailList
                columns={1}
                items={[
                  {
                    label: "System",
                    value: requested ? `${requested.capacityKw} kW · ${REQUESTED_SYSTEM_TYPE_LABELS[requested.systemType]}` : "—",
                  },
                  { label: "Monthly bill", value: requested?.monthlyBillRs ? formatINR(requested.monthlyBillRs * 100) : "—" },
                  ...(lead.qualification
                    ? [{ label: "Shadow-free roof (call)", value: `${lead.qualification.shadowFreeAreaSqft.toLocaleString("en-IN")} sq ft` }]
                    : []),
                  {
                    label: "Lead",
                    value:
                      user.role === "technician" ? (
                        lead.number
                      ) : (
                        <Link href={`/leads/${lead.id}`} className="text-primary hover:underline">
                          {lead.number}
                        </Link>
                      ),
                  },
                ]}
              />
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
