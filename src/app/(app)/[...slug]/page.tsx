/**
 * Upcoming-module screen.
 *
 * During the phased build every sidebar link should open a real page instead
 * of a 404. This catch-all renders a short "what's coming" card for modules
 * that haven't shipped yet. As soon as a module adds its own route (e.g.
 * src/app/(app)/leads/page.tsx) that route takes precedence automatically.
 * Unknown paths still return 404.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { NAV_SECTIONS, roleHome } from "@/lib/navigation";
import { requireUser } from "@/server/auth/session";

const UPCOMING: Record<string, { phase: string; summary: string }> = {
  "/dashboard": {
    phase: "Phase 3",
    summary: "Today / week / month KPIs, profit per job, open repairs and unfinished work, with read-only share links.",
  },
  "/customers": {
    phase: "Phase 3",
    summary: "Customer 360: installed systems, every serial number with its warranty status, tickets and invoices.",
  },
  "/service": {
    phase: "Phase 3",
    summary: "Service tickets with instant warranty lookup — free when covered, billed automatically when not.",
  },
  "/invoices": {
    phase: "Phase 3",
    summary: "GST tax invoices with the CGST/SGST split and payment tracking.",
  },
  "/subsidy": {
    phase: "Phase 3",
    summary: "PM Surya Ghar subsidy tracker from application to disbursement.",
  },
  "/team": {
    phase: "Phase 3",
    summary: "Technician hours, utilisation and monthly payouts.",
  },
};

export default async function UpcomingModulePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const href = `/${slug[0]}`;
  const item = NAV_SECTIONS.flatMap((section) => section.items).find((navItem) => navItem.href === href);
  const upcoming = UPCOMING[href];
  // Sub-routes of an upcoming module (e.g. /quotes/new) show the same card.
  if (!item || !upcoming) notFound();
  await requireUser(item.roles);

  return (
    <>
      <PageHeader title={item.label} description={upcoming.summary} />
      <EmptyState
        icon={Hammer}
        title={`${item.label} ships in ${upcoming.phase}`}
        description="This module is on the build plan. Its screens appear here automatically as soon as it is merged."
        action={
          <Button asChild variant="outline">
            <Link href={roleHome(user.role)}>Back to my home</Link>
          </Button>
        }
      />
    </>
  );
}
