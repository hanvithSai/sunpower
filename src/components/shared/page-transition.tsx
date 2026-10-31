"use client";

/**
 * Smooth page-to-page navigation: the old page fades out quickly and the new
 * one fades in while rising 8 px (React's <ViewTransition> on the browser's
 * View Transitions API; the animations are in src/app/globals.css, "Page transitions").
 *
 * Layouts persist across navigations, so the transition is keyed by the
 * pathname: each route change is an exit/enter pair sharing the name "page".
 * Browsers without the API swap pages instantly, as before. Reduced motion
 * keeps a plain crossfade.
 */
import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} name="page" share="page" enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
