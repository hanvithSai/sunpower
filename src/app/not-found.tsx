/**
 * App-wide 404: unmatched URLs and notFound() calls without a closer not-found file.
 * Static, friendly, and points people somewhere useful.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <Link href="/" className="rounded-lg" aria-label="SunPower home">
        <Logo size="md" />
      </Link>
      <div className="mt-12 grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Compass className="size-7" aria-hidden="true" />
      </div>
      <p className="mt-5 text-sm font-medium text-brand-foreground">Error 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        We couldn’t find that page
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The link may be broken, or the page may have moved. Check the address, or head back to the start.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Staff login</Link>
        </Button>
      </div>
    </div>
  );
}
