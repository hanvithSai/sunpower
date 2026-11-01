/**
 * Public warranty check (F20). Homeowners see each unit's cover and the
 * workmanship warranty without calling support. The heading and the form
 * prerender; the form posts to a rate-limited Server Action. The example serial
 * in the hint is a real one from the database, streamed in at request time.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarClock, ShieldCheck, Wrench } from "lucide-react";
import { WarrantyLookup } from "@/components/modules/public/warranty-lookup";
import { warrantyExampleSerial } from "@/server/services/warranty";

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
      <WarrantyLookup
        example={
          <Suspense fallback={null}>
            <ExampleSerial />
          </Suspense>
        }
      />
    </div>
  );
}

/** ", e.g. GRW3K-H2504-0001": an installed, in-warranty inverter, so the example really works. */
async function ExampleSerial() {
  await connection();
  const serial = await warrantyExampleSerial(new Date()).catch(() => null);
  return serial ? (
    <>
      , e.g. <span className="font-mono">{serial}</span>
    </>
  ) : null;
}
