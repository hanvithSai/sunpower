/**
 * Printable installation & commissioning certificate: the customer's proof of
 * exactly what was installed — every serial with its warranty dates, the
 * workmanship warranty, the generation test, the crew, photos and the
 * customer's on-screen signature. "Print → Save as PDF" gives a clean A4.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { COMPANY, PRODUCT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { addMonths } from "@/lib/warranty";
import { requireUser } from "@/server/auth/session";
import { getJobDetail } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Installation certificate" };

function years(months: number): string {
  return months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} months`;
}

export default async function JobCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "technician", "warehouse", "support"]);
  const { id } = await params;
  const detail = await getJobDetail(id);
  if (!detail || detail.job.status !== "completed") notFound();
  const { job, customer, order, serials } = detail;
  if (user.role === "technician" && !job.technicianIds.includes(user.id)) notFound();

  const commissionedAt = order?.commissionedAt ?? job.finishedAt!;
  const workmanship = order?.workmanshipMonths ?? 0;
  const address = [job.siteAddress.line1, job.siteAddress.line2, job.siteAddress.city, `${job.siteAddress.state} ${job.siteAddress.pincode}`].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between" data-print-hide>
        <Button asChild variant="ghost">
          <Link href={`/jobs/${job.id}`}>
            <ArrowLeft aria-hidden="true" />
            Back to job
          </Link>
        </Button>
        <PrintButton label="Print / Save as PDF" />
      </div>

      <article className="rounded-2xl border border-border bg-white p-8 text-[13px] text-foreground shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              {COMPANY.name}
              <br />
              {COMPANY.address}
              <br />
              GSTIN {COMPANY.gstin} · {COMPANY.phone}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-semibold tracking-tight">Installation &amp; Commissioning Certificate</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{job.number}</p>
            <p className="mt-2 text-xs text-muted-foreground">Commissioned {formatDate(commissionedAt)}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer and site</h2>
            <p className="font-medium">{customer?.name}</p>
            <p className="text-muted-foreground">{address}</p>
            {customer ? <p className="text-muted-foreground">{formatPhone(customer.phone)}</p> : null}
            {customer?.discom ? (
              <p className="text-muted-foreground">
                {customer.discom}
                {customer.consumerNumber ? ` · Service no. ${customer.consumerNumber}` : ""}
              </p>
            ) : null}
          </div>
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">System</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Installed size</dt>
              <dd className="font-medium">
                {job.confirmedKw} kW {order ? order.systemLabel : ""}
              </dd>
              {order ? (
                <>
                  <dt className="text-muted-foreground">Order</dt>
                  <dd>{order.number}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Kit delivered</dt>
              <dd>{order?.deliveredAt ? formatDate(order.deliveredAt) : "—"}</dd>
              <dt className="text-muted-foreground">Work on site</dt>
              <dd>
                {formatDateTime(job.startedAt)} – {formatDateTime(job.finishedAt)}
              </dd>
              <dt className="text-muted-foreground">Generation test</dt>
              <dd>{job.generationReadingKw !== undefined ? `Passed · ${job.generationReadingKw} kW at handover` : "Passed"}</dd>
            </dl>
          </div>
        </section>

        <section className="border-b border-border py-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equipment installed and warranty</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">Item</th>
                <th className="py-1.5 font-medium">Serial number</th>
                <th className="py-1.5 text-right font-medium">Warranty</th>
              </tr>
            </thead>
            <tbody>
              {serials.map((s) => (
                <tr key={s.serial} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5">
                    {s.productName}
                    <span className="block text-xs text-muted-foreground">{PRODUCT_CATEGORY_LABELS[s.category]}</span>
                  </td>
                  <td className="py-1.5 font-mono text-xs">{s.serial}</td>
                  <td className="py-1.5 text-right text-xs">
                    {s.warrantyStartAt && s.warrantyEndAt ? `${formatDate(s.warrantyStartAt)} – ${formatDate(s.warrantyEndAt)}` : "—"}
                  </td>
                </tr>
              ))}
              {workmanship > 0 ? (
                <tr>
                  <td className="py-1.5" colSpan={2}>
                    Workmanship: wiring, earthing, structure and installation by {COMPANY.shortName}
                    <span className="block text-xs text-muted-foreground">{years(workmanship)} from commissioning</span>
                  </td>
                  <td className="py-1.5 text-right text-xs">
                    {formatDate(commissionedAt)} – {formatDate(addMonths(commissionedAt, workmanship))}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Warranties started automatically on delivery. For service, call {COMPANY.phone} with any serial number above — the repair is free while it is in warranty.
          </p>
        </section>

        {job.photos.length ? (
          <section className="border-b border-border py-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Finished installation</h2>
            <div className="grid grid-cols-3 gap-3">
              {job.photos.slice(0, 3).map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element -- session-protected GridFS file; next/image can't forward the cookie
                <img key={photo} src={`/api/v1/files/${photo}`} alt="Finished roof installation" className="aspect-[4/3] w-full rounded-lg object-cover" />
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 pt-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Installed by</h2>
            <p>{job.crew.map((c) => `${c.name}${c.lead ? " (lead)" : ""}`).join(", ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">for {COMPANY.name}</p>
          </div>
          <div className="sm:text-right">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accepted by the customer</h2>
            {job.signature ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- signature PNG captured on the tablet */}
                <img src={job.signature.dataUrl} alt={`Signature of ${job.signature.signedBy}`} className="ml-auto h-20 w-auto sm:ml-auto" />
                <p className="font-medium">{job.signature.signedBy}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(job.signature.signedAt)}</p>
              </>
            ) : null}
            {job.customerRemarks ? <p className="mt-2 text-xs italic text-muted-foreground">“{job.customerRemarks}”</p> : null}
          </div>
        </section>
      </article>
    </div>
  );
}
