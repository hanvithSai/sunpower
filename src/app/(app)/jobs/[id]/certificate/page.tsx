/**
 * Printable installation & commissioning certificate (staff view). The same
 * certificate goes to the customer as a read-only link from the job page.
 * "Print → Save as PDF" gives a clean A4.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CertificateView } from "@/components/modules/jobs/certificate-view";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { getJobDetail } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Installation certificate" };

export default async function JobCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "technician", "warehouse", "support"]);
  const { id } = await params;
  const detail = await getJobDetail(id);
  if (!detail || detail.job.status !== "completed") notFound();
  if (user.role === "technician" && !detail.job.technicianIds.includes(user.id)) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between" data-print-hide>
        <Button asChild variant="ghost">
          <Link href={`/jobs/${detail.job.id}`}>
            <ArrowLeft aria-hidden="true" />
            Back to job
          </Link>
        </Button>
        <PrintButton label="Print / Save as PDF" />
      </div>
      <CertificateView detail={detail} />
    </div>
  );
}
