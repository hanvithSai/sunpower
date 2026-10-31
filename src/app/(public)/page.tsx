/**
 * Public home page: what SunPower does, for homeowners first and staff second.
 *
 * Hero: the interactive energy-flow diagram (the one memorable element).
 * Then the facts that are true in the system today (subsidy rule, warranty
 * terms), the eight-step journey every installation follows, the subsidy
 * estimator (same rule as the quote builder), which system fits, the serial
 * warranty, the platform behind it all, and answers to common questions.
 * Static: no database reads, so it prerenders and loads instantly.
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  BadgeIndianRupee,
  Boxes,
  ClipboardCheck,
  FileText,
  Headset,
  LayoutDashboard,
  PhoneCall,
  Ruler,
  ScanBarcode,
  ShieldCheck,
  Truck,
  UserRoundSearch,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { EnergyFlow } from "@/components/modules/public/energy-flow";
import { SubsidyEstimator } from "@/components/modules/public/subsidy-estimator";
import { CountUp } from "@/components/shared/count-up";
import { buttonVariants } from "@/components/ui/button";
import { cta } from "@/lib/analytics";
import { formatINR } from "@/lib/money";
import { SUBSIDY_RULES } from "@/lib/subsidy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "SunPower — rooftop solar, from first enquiry to every unit delivered" },
  description:
    "Rooftop solar for homes and businesses in Telangana. Free roof survey, PM Surya Ghar subsidy handled for you, and every panel tracked by serial number for 20 years.",
};

const onForestPrimary = "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-sun px-6 text-[15px] font-semibold text-forest transition-colors hover:bg-brand-light";
const onForestSecondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-[15px] font-medium text-forest-foreground ring-1 ring-white/25 transition-colors hover:bg-white/8 hover:text-white";

/** Counted up when the strip scrolls into view. The subsidy cap comes from the same rule the quote builder uses. */
const FACTS = [
  { to: SUBSIDY_RULES.capRs, prefix: "₹", suffix: "", label: "maximum PM Surya Ghar subsidy for a home, and we file it for you" },
  { to: 20, prefix: "", suffix: " years", label: "panel warranty, registered to your home by serial number" },
  { to: 5, prefix: "", suffix: " years", label: "workmanship warranty on every installation we commission" },
  { to: 5, prefix: "1–", suffix: " kW", label: "On-Grid and Off-Grid systems, plus hardware-only Panel Sets" },
];

const JOURNEY: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: PhoneCall, title: "Enquiry", body: "Tell us about your roof and your bill. We call back within 2 working hours." },
  { icon: Ruler, title: "Roof survey", body: "A technician measures direction, tilt, shading and cable runs — free." },
  { icon: FileText, title: "Design & quote", body: "The right kit for your roof, every part listed, GST and subsidy worked out." },
  { icon: BadgeIndianRupee, title: "Order", body: "Your first payment confirms it. We open your subsidy file the same day." },
  { icon: ScanBarcode, title: "Verified dispatch", body: "Every panel and inverter is scanned by serial before it leaves the warehouse." },
  { icon: Wrench, title: "Installation", body: "Our crew installs, tests generation and takes photos. You sign on site." },
  { icon: BadgeCheck, title: "Commissioned", body: "You get a certificate listing every serial and its warranty, on WhatsApp." },
  { icon: ShieldCheck, title: "Warranty & service", body: "Raise a fault any time; covered repairs cost you nothing." },
];

const SYSTEMS = [
  {
    name: "On-Grid",
    fit: "Homes and businesses with a reliable grid supply who want the lowest bills.",
    has: "Panels, grid-tie inverter, net meter, protection and earthing.",
    note: "Eligible for PM Surya Ghar on homes. Switches off in a power cut.",
    href: "/enquiry?type=on_grid",
    cta: "systems_on_grid" as const,
  },
  {
    name: "Off-Grid",
    fit: "Farms, remote sites and places where the grid is weak or absent.",
    has: "Panels, charge controller, battery bank, inverter, protection and earthing.",
    note: "Runs through power cuts. Not covered by the subsidy.",
    href: "/enquiry?type=off_grid",
    cta: "systems_off_grid" as const,
  },
  {
    name: "Panel Set",
    fit: "Installers and owners who only need the hardware.",
    has: "Panels with connectors and cable, delivered. Installation is optional.",
    note: "Serial-tracked warranty from the delivery date.",
    href: "/enquiry",
    cta: "systems_panel_set" as const,
  },
];

const PLATFORM: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: UserRoundSearch, title: "Leads", body: "Every enquiry in one pipeline, with a 2-hour call-back clock." },
  { icon: ClipboardCheck, title: "Surveys", body: "The technician's on-roof form; quoting unlocks only after approval." },
  { icon: FileText, title: "Quotes & orders", body: "Packages expand into the full parts list with GST and subsidy." },
  { icon: Boxes, title: "Inventory", body: "Stock and every serial number, from goods receipt onwards." },
  { icon: Truck, title: "Dispatch", body: "A packing bench that won't release an order until every serial is scanned." },
  { icon: Wrench, title: "Installations", body: "Crew calendar and a phone-first job form with photos and signature." },
  { icon: Headset, title: "Service desk", body: "Warranty decided on the spot from the serial; closed only when the customer confirms." },
  { icon: LayoutDashboard, title: "Dashboard", body: "Profit per job from actual costs, unfinished steps, subsidy and payroll." },
];

const FAQ = [
  {
    q: "Am I eligible for the PM Surya Ghar subsidy?",
    a: `Homes with a grid-connected (On-Grid) system are. Businesses and off-grid systems aren't. The subsidy is ${formatINR(SUBSIDY_RULES.perKwFirstTwoRs * 100)} per kW for the first 2 kW and ${formatINR(SUBSIDY_RULES.thirdKwRs * 100)} for the 3rd, up to ${formatINR(SUBSIDY_RULES.capRs * 100)}, credited to your bank account after the DISCOM inspects the installation. We prepare and track the application for you.`,
  },
  {
    q: "Will my solar system work during a power cut?",
    a: "An On-Grid system switches off during a power cut, even in sunshine, so that no power flows back into the lines while they're being repaired. If you need backup, an Off-Grid system with a battery keeps running.",
  },
  {
    q: "How do I check my warranty?",
    a: "Enter the serial number from the label on your panel or inverter on our warranty page, or your mobile number with the last 4 characters of any serial. You'll see every unit's cover and the workmanship warranty — no login needed.",
  },
  {
    q: "What does the workmanship warranty cover?",
    a: "Faults in the installation itself, such as wiring, earthing or the mounting structure, for 5 years from commissioning. Panels, inverters and batteries are covered by their own warranties, tracked by serial number.",
  },
  {
    q: "What happens after I send an enquiry?",
    a: "Our sales team calls you within 2 working hours, a technician surveys your roof for free, and you receive a quote that lists every part, the GST and your estimated subsidy.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-forest text-forest-foreground">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(242_180_65/0.18),transparent_65%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pt-20 lg:pb-24">
          <div>
            <p className="text-[15px] text-forest-muted">Rooftop solar for homes and businesses in Telangana</p>
            <h1 className="mt-4 font-display text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.25rem]">
              From the first ray of sunlight to every unit delivered.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-forest-foreground/85">
              We survey your roof, design the right system, file your PM Surya Ghar subsidy and track every panel by its serial number for the next 20
              years.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/enquiry" className={onForestPrimary} {...cta("hero_get_quote")}>
                Get a free quote
              </Link>
              <Link href="#warranty" className={onForestSecondary} {...cta("hero_check_warranty")}>
                Check your warranty
              </Link>
            </div>
          </div>
          <EnergyFlow />
        </div>
      </section>

      {/* Facts that are true in the system today */}
      <section aria-label="SunPower at a glance" className="border-b border-border bg-card">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-border px-4 sm:px-6 lg:grid-cols-4 lg:divide-x">
          {FACTS.map((f) => (
            <div key={f.label} className="py-7 pr-4 lg:px-6 lg:first:pl-0">
              <dt className="sr-only">{f.label}</dt>
              <dd>
                <CountUp
                  to={f.to}
                  prefix={f.prefix}
                  suffix={f.suffix}
                  className="block font-display text-3xl font-semibold tracking-tight text-forest tabular-nums sm:text-4xl"
                />
                <span className="mt-1.5 block text-sm leading-snug text-muted-foreground">{f.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The journey */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold text-forest sm:text-5xl">One connected journey, eight steps</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every installation follows the same path, and every step is recorded — so nothing is lost between the first call and the last service visit.
            </p>
          </div>
          {/* Each step is a solar panel: aluminium frame, cell grid, a sheen that catches the light on hover. */}
          <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="group relative overflow-hidden rounded-lg bg-[#123528] p-5 text-forest-foreground ring-4 ring-[#c8d3cb] transition-transform duration-300 ease-out [background-image:linear-gradient(rgb(220_233_223/0.09)_1px,transparent_1px),linear-gradient(90deg,rgb(220_233_223/0.09)_1px,transparent_1px)] [background-size:25%_33.34%] hover:-translate-y-1 hover:[transform:perspective(900px)_rotateX(5deg)_translateY(-4px)]"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.10)_45%,transparent_60%)] bg-[length:250%_100%] bg-[position:100%_0] transition-[background-position] duration-700 ease-out group-hover:bg-[position:0%_0]"
                />
                <div className="relative flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-full bg-sun text-[13px] font-bold text-forest tabular-nums">{i + 1}</span>
                  <Icon className="size-5 text-volt" aria-hidden="true" />
                </div>
                <h3 className="relative mt-6 text-[17px] font-semibold text-white">{title}</h3>
                <p className="relative mt-1.5 min-h-[3.75rem] text-sm leading-relaxed text-forest-foreground/85">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Subsidy estimator */}
      <section id="subsidy" className="scroll-mt-20 border-y border-border bg-sage/45">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold text-forest sm:text-5xl">What will the government pay?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The same PM Surya Ghar rule we use on every quote. Pick a size and see your estimated subsidy.
            </p>
          </div>
          <div className="mt-10">
            <SubsidyEstimator />
          </div>
        </div>
      </section>

      {/* Which system fits */}
      <section id="systems" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <h2 className="max-w-2xl text-4xl font-semibold text-forest sm:text-5xl">Which system fits your roof?</h2>
          <div className="mt-12 grid border-t border-forest/80 md:grid-cols-3 md:divide-x md:divide-border">
            {SYSTEMS.map((s) => (
              <article key={s.name} className="flex flex-col border-b border-border py-8 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0">
                <h3 className="font-display text-2xl font-semibold text-forest">{s.name}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-foreground">{s.fit}</p>
                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="font-medium text-foreground">What you get</dt>
                    <dd className="mt-1 text-muted-foreground">{s.has}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Good to know</dt>
                    <dd className="mt-1 text-muted-foreground">{s.note}</dd>
                  </div>
                </dl>
                <Link href={s.href} className={cn(buttonVariants({ variant: "outline" }), "mt-8 self-start")} {...cta(s.cta)}>
                  Ask about {s.name}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Serial warranty */}
      <section id="warranty" className="scroll-mt-16 bg-forest text-forest-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <h2 className="text-4xl font-semibold text-white sm:text-5xl">Every panel has a serial. Every serial has a warranty.</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-forest-foreground/85">
              The day your system is delivered, each unit’s warranty starts against your home. Years later, one serial number is enough to see what’s
              covered — for you and for our support team.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/warranty" className={onForestPrimary} {...cta("band_check_warranty")}>
                Check a warranty
              </Link>
            </div>
          </div>
          <figure className="justify-self-center lg:justify-self-end">
            <div className="w-[min(100%,22rem)] rotate-[-2deg] rounded-xl bg-[#f7f9f5] p-5 text-forest shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold">SunPower</span>
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Inverter · Growatt MIN 3000TL-X</p>
              <p className="mt-1 text-xl font-semibold tracking-wide tabular-nums">GRW3K-H2504-0001</p>
              <div aria-hidden="true" className="mt-3 flex h-10 items-end gap-[3px]">
                {[3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1].map((w, i) => (
                  <span key={i} className="h-full bg-forest" style={{ width: w }} />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Warranty</span>
                <span className="rounded-full bg-success/12 px-2 py-0.5 text-[13px] font-medium text-success-foreground">In warranty</span>
              </div>
            </div>
            <figcaption className="mt-4 text-center text-xs text-forest-muted lg:text-right">An example label</figcaption>
          </figure>
        </div>
      </section>

      {/* The platform */}
      <section id="platform" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <h2 className="text-4xl font-semibold text-forest sm:text-5xl">The platform behind every installation</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Sales, the warehouse, crews on the roof, support and the director work in one system. Each step unlocks the next, so no project skips a
                check.
              </p>
            </div>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "self-start lg:self-auto")} {...cta("platform_staff_sign_in")}>
              Staff sign in
            </Link>
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM.map(({ icon: Icon, title, body }) => (
              <li key={title} className="bg-card p-6">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-[15px] font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <ScanBarcode className="size-4 text-primary" aria-hidden="true" />
            Built for phones on the roof and the warehouse floor: camera scanning, job forms that keep a draft on the phone, and large touch targets.
          </p>
        </div>
      </section>

      {/* Questions */}
      <section id="faq" className="scroll-mt-20 border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:py-24">
          <h2 className="text-4xl font-semibold text-forest sm:text-5xl">Questions homeowners ask us</h2>
          <div className="divide-y divide-border border-y border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[17px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-input text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call */}
      <section className="bg-sun">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center">
          <h2 className="max-w-2xl text-3xl font-semibold text-forest sm:text-4xl">Your roof is already collecting sunlight. Let’s put it to work.</h2>
          <Link
            href="/enquiry"
            className="inline-flex h-12 shrink-0 items-center rounded-lg bg-forest px-6 text-[15px] font-semibold text-white transition-colors hover:bg-forest-2"
            {...cta("closing_get_quote")}
          >
            Book a free roof survey
          </Link>
        </div>
      </section>
    </>
  );
}
