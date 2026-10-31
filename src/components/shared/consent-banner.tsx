"use client";

/**
 * Cookie banner (product/Analytics.md §3). Shown once to every visitor —
 * public and staff — while no choice has been made, and again from any
 * "Cookie settings" link. Accept and Reject are the same size and style (no
 * nudging), nothing is pre-ticked, and the page stays usable behind it.
 * Not shown at all without an analytics key, or when the browser's Global
 * Privacy Control / Do Not Track already said no.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  onConsentChange,
  onConsentSettingsOpen,
  openConsentSettings,
  readConsent,
  saveConsent,
  type ConsentChoice,
  type ConsentStatus,
} from "@/lib/consent";

const ENABLED = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

const subscribe = (callback: () => void) => onConsentChange(callback);

export function ConsentBanner() {
  const status = useSyncExternalStore<ConsentStatus | null>(subscribe, readConsent, () => null);
  const [reopened, setReopened] = useState(false);

  useEffect(() => onConsentSettingsOpen(() => setReopened(true)), []);

  if (!ENABLED || status === null || (status !== "pending" && !reopened)) return null;

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setReopened(false);
  };

  return (
    <section
      aria-labelledby="consent-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-border bg-card p-4 shadow-[0_8px_30px_rgba(0,0,0,.08)] sm:p-5 print:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="consent-title" className="text-[15px] font-semibold text-foreground">
            Cookies on SunPower
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We use essential cookies to keep you signed in and remember this choice. With your OK, we also use analytics cookies (PostHog) to see how
            the site is used and fix what gets in the way — for signed-in staff, that includes screen recordings with personal details hidden. No ads,
            and we never sell your data.{" "}
            <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
              Privacy & cookies
            </Link>
          </p>
          {status !== "pending" ? (
            <p className="mt-2 text-sm text-foreground" role="status">
              Analytics cookies are currently <strong>{status === "granted" ? "on" : "off"}</strong>.
            </p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => choose("denied")}>
              Reject analytics
            </Button>
            <Button variant="outline" onClick={() => choose("granted")}>
              Accept analytics
            </Button>
          </div>
        </div>
        {status !== "pending" ? (
          <Button variant="ghost" size="icon" className="-mr-1 -mt-1" aria-label="Close cookie settings" onClick={() => setReopened(false)}>
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** "Cookie settings" link for footers and menus: reopens the banner. */
export function CookieSettingsButton({ className, children = "Cookie settings" }: { className?: string; children?: ReactNode }) {
  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      {children}
    </button>
  );
}
