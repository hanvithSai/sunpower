/**
 * Staff sign-in. A split card: the brand story on the left (desktop) and the form on the
 * right. The form reads ?callbackUrl= with useSearchParams(), so it sits inside <Suspense>
 * and the rest of the page prerenders as a static shell. Signed-in visitors are bounced to
 * their home by the request proxy before this page renders.
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Calculator, ScanBarcode, ShieldCheck, type LucideIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Staff sign-in for SunPower OS.",
};

const VALUE_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Calculator,
    title: "Quotes in minutes",
    body: "Pick a 3 kW On-Grid kit and the full bill of materials, GST and PM Surya Ghar subsidy are filled in for you.",
  },
  {
    icon: ScanBarcode,
    title: "Every panel tracked",
    body: "Serial numbers follow each unit from goods receipt to the rooftop, so warranty checks take seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Service that closes the loop",
    body: "Tickets stay open until the customer confirms the fix; out-of-warranty work is billed automatically.",
  },
];

export default function LoginPage() {
  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:grid-cols-[1.05fr_1fr]">
      <section
        aria-label="About SunPower OS"
        className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-linear-to-br from-[#fff3e0] via-[#fff8ef] to-white p-10 lg:flex"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_159_10/0.35),transparent_70%)]"
        />
        <Logo size="lg" className="relative" />
        <div className="relative space-y-8">
          <p className="max-w-sm text-[28px] leading-tight font-semibold tracking-tight text-balance text-foreground">
            From first enquiry to 20-year warranty — one platform.
          </p>
          <ul className="space-y-5">
            {VALUE_POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-brand-foreground shadow-sm ring-1 ring-brand/15">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">SunPower Solutions · Hyderabad, Telangana</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">
        <Logo className="mb-8 lg:hidden" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use your SunPower staff account. Customers can{" "}
          <Link href="/warranty" className="font-medium text-primary hover:underline">
            check a warranty
          </Link>{" "}
          without signing in.
        </p>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </section>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="mt-8 space-y-5" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
