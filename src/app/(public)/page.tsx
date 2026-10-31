/**
 * Public home page (Phase 0 version).
 *
 * Introduces SunPower and routes staff to sign in. The full landing page —
 * live installation stats, package pricing and the subsidy calculator backed
 * by the database — replaces this with the Sales module in Phase 1.
 */
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROMISES = [
  {
    icon: ClipboardCheck,
    title: "Free site survey",
    body: "A technician measures roof direction, tilt and shading before you get a quote.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Subsidy handled for you",
    body: "We track your PM Surya Ghar application from submission to disbursement.",
  },
  {
    icon: ShieldCheck,
    title: "Warranty by serial number",
    body: "Every panel, inverter and battery is registered to your home the day it is delivered.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="text-center">
        <p className="text-sm font-medium text-brand">SunPower Solutions · Telangana</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Rooftop solar, done right.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          From your first enquiry to a 20-year warranty — one team, one connected platform.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login">
              Staff sign in <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Online enquiries and warranty checks open in the next release.</p>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3" aria-label="Why SunPower">
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
