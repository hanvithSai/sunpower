"use client";

/**
 * Smooth page-to-page navigation: the old page fades out quickly and the new
 * one fades in while rising 8 px (React's <ViewTransition> on the browser's
 * View Transitions API; the animations are in src/app/globals.css, "Page transitions").
 *
 * It is rendered by the route groups' template.tsx files: Next.js gives a
 * template a new key whenever its segment changes (/leads → /orders), so each
 * such navigation is an exit/enter pair sharing the name "page". Reading the
 * pathname here instead would break prerendering of dynamic public routes
 * (/share/[token]) under Cache Components.
 * Browsers without the API swap pages instantly, as before. Reduced motion
 * keeps a plain crossfade.
 *
 * Browsers refuse to start a view transition while the tab is in the
 * background ("Transition was aborted because of invalid state. Document
 * hidden"), so when the page is hidden the animation classes switch to "none"
 * and React swaps the page without asking for a transition.
 */
import { ViewTransition, useSyncExternalStore, type ReactNode } from "react";

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

export function PageTransition({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );
  const cls = hidden ? "none" : "page";
  return (
    <ViewTransition name="page" share={cls} enter={cls} exit={cls} default="none">
      {children}
    </ViewTransition>
  );
}
