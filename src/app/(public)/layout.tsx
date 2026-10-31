/**
 * Chrome for the public pages (landing, enquiry form, warranty check, privacy, share links):
 * a deep-forest header and footer that carry the brand around light content.
 * Static on purpose so these pages prerender and load instantly for homeowners on mobile data.
 * On phones the header keeps the two customer actions; the section links and "Staff login"
 * move to the footer.
 */
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { COMPANY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { cta } from "@/lib/analytics";
import { CookieSettingsButton } from "@/components/shared/consent-banner";
import { PageTransition } from "@/components/shared/page-transition";

const navLink =
  "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-forest-foreground/80 transition-colors duration-150 hover:bg-white/8 hover:text-white pointer-coarse:h-11";
const footLink = "rounded-sm transition-colors hover:text-white";

const SECTIONS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#subsidy", label: "Subsidy" },
  { href: "/#systems", label: "Systems" },
];

export default function PublicLayout({ children }: LayoutProps<"/">) {
  const telHref = `tel:${COMPANY.phone.replace(/\s+/g, "")}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header data-print-hide className="sticky top-0 z-30 border-b border-white/10 bg-forest/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0 rounded-lg" aria-label="SunPower home">
            {/* Compact logo on phones keeps both customer actions on one line at 360px. */}
            <Logo size="sm" className="text-white sm:hidden" />
            <Logo className="hidden text-white sm:inline-flex" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {SECTIONS.map((s) => (
              <Link key={s.href} href={s.href} className={cn(navLink, "hidden lg:inline-flex")}>
                {s.label}
              </Link>
            ))}
            <Link href="/#warranty" className={navLink} {...cta("nav_warranty")}>
              <span className="sm:hidden">Warranty</span>
              <span className="hidden sm:inline">Warranty check</span>
            </Link>
            <Link href="/login" className={cn(navLink, "hidden sm:inline-flex")} {...cta("nav_staff_login")}>
              Staff login
            </Link>
            <Link
              href="/enquiry"
              className="ml-1 inline-flex h-9 items-center rounded-md bg-sun px-4 text-sm font-semibold text-forest transition-colors hover:bg-brand-light pointer-coarse:h-11"
              {...cta("nav_get_quote")}
            >
              <span className="sm:hidden">Free quote</span>
              <span className="hidden sm:inline">Get a free quote</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>

      <footer data-print-hide className="bg-forest text-forest-muted">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div className="space-y-4">
            <Logo className="text-white" />
            <p className="max-w-xs text-sm leading-relaxed">
              Rooftop solar for homes and businesses across {COMPANY.state}, from a free roof survey and subsidy paperwork to 20 years of warranty support.
            </p>
          </div>

          <div>
            <h2 className="font-sans text-[13px] font-semibold tracking-normal text-white">Explore</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className={footLink}>
                    {s.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/#faq" className={footLink}>
                  Questions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-sans text-[13px] font-semibold tracking-normal text-white">Customers & staff</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <Link href="/enquiry" className={footLink} {...cta("footer_get_quote")}>
                  Get a free quote
                </Link>
              </li>
              <li>
                <Link href="/warranty" className={footLink} {...cta("footer_warranty")}>
                  Warranty check
                </Link>
              </li>
              <li>
                <Link href="/login" className={footLink} {...cta("footer_staff_login")}>
                  Staff login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-sans text-[13px] font-semibold tracking-normal text-white">Get in touch</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{COMPANY.address}</span>
              </li>
              <li>
                <a href={telHref} className={cn(footLink, "flex items-center gap-2.5")} {...cta("footer_call")}>
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {COMPANY.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${COMPANY.email}`} className={cn(footLink, "flex items-center gap-2.5")}>
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  {COMPANY.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>© {COMPANY.name}. All rights reserved.</p>
            <p className="flex gap-4">
              <Link href="/privacy" className={footLink}>
                Privacy & cookies
              </Link>
              <CookieSettingsButton className={footLink} />
            </p>
            <p className="tabular-nums">GSTIN {COMPANY.gstin}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
