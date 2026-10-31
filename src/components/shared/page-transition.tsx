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
 *
 * Browsers refuse to start a view transition while the tab is in the
 * background ("Transition was aborted because of invalid state. Document
 * hidden"), so when the page is hidden the animation classes switch to "none"
 * and React swaps the page without asking for a transition.
 */
import { ViewTransition, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );
  const cls = hidden ? "none" : "page";
  return (
    <ViewTransition key={pathname} name="page" share={cls} enter={cls} exit={cls} default="none">
      {children}
    </ViewTransition>
  );
}
