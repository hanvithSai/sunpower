/**
 * Public "Get a free quote" page. The form reads query params, so it streams
 * inside <Suspense> while the heading prerenders into the static shell.
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeIndianRupee, PhoneCall, ShieldCheck } from "lucide-react";
import { EnquiryForm } from "@/components/modules/public/enquiry-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Get a free solar quote",
  description: "Tell us about your home or business. SunPower calls within 2 working hours and books a free roof survey.",
};

const POINTS = [
  { icon: PhoneCall, text: "Call back within 2 working hours" },
  { icon: BadgeIndianRupee, text: "PM Surya Ghar subsidy paperwork handled" },
  { icon: ShieldCheck, text: "Up to 25-year panel warranty, tracked by serial number" },
];

export default function EnquiryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium text-brand-foreground">Free roof survey · No obligation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Get a free solar quote</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Tell us a little about your home or business. A SunPower expert will call you, survey your roof and send a clear quote.
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-2">
              <Icon className="size-4 text-primary" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </header>
      <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-2xl" />}>
        <EnquiryForm />
      </Suspense>
    </div>
  );
}
