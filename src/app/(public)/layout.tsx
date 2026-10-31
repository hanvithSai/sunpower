/**
 * Marketing chrome for the public pages (landing, enquiry form, warranty check, share links).
 * Static on purpose so these pages prerender and load instantly for homeowners on mobile data.
 * On phones the header keeps the two customer actions; "Staff login" moves to the footer.
 */
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { COMPANY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const navLink =
  "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground/80 transition-colors duration-150 hover:bg-accent hover:text-foreground pointer-coarse:h-11";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  const telHref = `tel:${COMPANY.phone.replace(/\s+/g, "")}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        data-print-hide
        className="sticky top-0 z-30 border-b border-border/70 bg-white/70 backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0 rounded-lg" aria-label="SunPower OS home">
            {/* Compact logo on phones keeps both customer actions on one line at 360px. */}
            <Logo size="sm" className="sm:hidden" />
            <Logo className="hidden sm:inline-flex" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link href="/warranty" className={navLink}>
              <span className="sm:hidden">Warranty</span>
              <span className="hidden sm:inline">Warranty check</span>
            </Link>
            <Link href="/login" className={cn(navLink, "hidden sm:inline-flex")}>
              Staff login
            </Link>
            <Button asChild size="sm" className="ml-1 rounded-full px-4">
              <Link href="/enquiry">
                <span className="sm:hidden">Free quote</span>
                <span className="hidden sm:inline">Get a free quote</span>
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer data-print-hide className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-sm text-sm text-muted-foreground">
              Rooftop solar for homes and businesses across {COMPANY.state} — from a free site survey and PM Surya
              Ghar subsidy paperwork to installation and 20-year warranty support.
            </p>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold text-foreground">Get in touch</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{COMPANY.address}</span>
              </li>
              <li>
                <a href={telHref} className="flex items-center gap-2.5 rounded-sm transition-colors hover:text-foreground">
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {COMPANY.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="flex items-center gap-2.5 rounded-sm transition-colors hover:text-foreground"
                >
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  {COMPANY.email}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold text-foreground">Customers & staff</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/enquiry" className="rounded-sm transition-colors hover:text-foreground">
                  Get a free quote
                </Link>
              </li>
              <li>
                <Link href="/warranty" className="rounded-sm transition-colors hover:text-foreground">
                  Warranty check
                </Link>
              </li>
              <li>
                <Link href="/login" className="rounded-sm transition-colors hover:text-foreground">
                  Staff login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>© {COMPANY.name}. All rights reserved.</p>
            <p className="tabular-nums">GSTIN {COMPANY.gstin}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
