/**
 * Minimal centred frame for authentication screens (sign in). No app chrome — just the
 * page content on the sage canvas with a faint sunlight wash, and a way back to the public website.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_50%_0%,rgb(242_180_65/0.16),transparent)]"
      />
      {children}
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to SunPower website
      </Link>
    </div>
  );
}
