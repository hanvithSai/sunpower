/**
 * Public warranty check (F20). Homeowners see each unit's cover and the
 * workmanship warranty without calling support. The heading prerenders; the
 * form is a client component that posts to a rate-limited Server Action.
 */
import type { Metadata } from "next";
import { CalendarClock, ShieldCheck, Wrench } from "lucide-react";
import { WarrantyLookup } from "@/components/modules/public/warranty-lookup";

export const metadata: Metadata = {
  title: "Check your warranty",
  description: "Check the warranty on your SunPower panels, inverter and battery with the serial number on the label.",
};

const POINTS = [
  { icon: ShieldCheck, text: "Panels 20 years · inverters and batteries 2 years" },
  { icon: CalendarClock, text: "Starts automatically on the day of delivery" },
  { icon: Wrench, text: "5-year workmanship warranty on the installation" },
];

export default function WarrantyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium text-brand-foreground">No login needed</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Check your warranty</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Every panel, inverter and battery we install is tracked by its serial number, so you can see exactly what is covered and until when.
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
      <WarrantyLookup />
    </div>
  );
}
