/**
 * New quote for a lead. Enforces the survey gate on the server: without an
 * approved site survey the builder never renders, only an explanation.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Lock } from "lucide-react";
import { QuoteBuilder } from "@/components/modules/quotes/quote-builder";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { getQuoteBuilderContext } from "@/server/services/quotes";

export const metadata: Metadata = { title: "New quote" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["sales"]);
  const sp = await searchParams;
  const leadId = first(sp.leadId);
  const ctx = leadId ? await getQuoteBuilderContext(leadId, first(sp.from)) : null;

  if (!ctx) {
    return (
      <>
        <PageHeader title="New quote" breadcrumbs={[{ label: "Quotes", href: "/quotes" }, { label: "New" }]} />
        <EmptyState
          icon={FileText}
          title="Start a quote from a lead"
          description="Open a lead whose site survey is approved and choose “Create quote”."
          action={
            <Button asChild>
              <Link href="/leads?view=table&status=survey_approved">Leads ready to quote</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={ctx.from ? `Revise quote ${ctx.from.number}` : `Quote for ${ctx.lead.name}`}
        description={
          ctx.survey
            ? `Survey ${ctx.survey.number} recommends ${ctx.survey.recommendedKw} kW ${ctx.survey.recommendedSystemType === "on_grid" ? "On-Grid" : "Off-Grid"} (${ctx.survey.shadingPct}% shading).`
            : undefined
        }
        breadcrumbs={[
          { label: "Leads", href: "/leads" },
          { label: ctx.lead.number, href: `/leads/${ctx.lead.id}` },
          { label: "New quote" },
        ]}
      />
      {ctx.blockedReason ? (
        <EmptyState
          icon={Lock}
          title="This lead can't be quoted yet"
          description={ctx.blockedReason}
          action={
            <Button asChild variant="outline">
              <Link href={`/leads/${ctx.lead.id}`}>Back to the lead</Link>
            </Button>
          }
        />
      ) : (
        <QuoteBuilder
          lead={{ id: ctx.lead.id, number: ctx.lead.number, name: ctx.lead.name, wantsSubsidy: ctx.lead.wantsSubsidy }}
          customerType={ctx.customerType}
          catalog={ctx.catalog}
          defaultPackageId={ctx.defaultPackageId}
          from={ctx.from}
        />
      )}
    </>
  );
}
