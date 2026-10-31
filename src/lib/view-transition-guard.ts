/**
 * Page transitions (src/components/shared/page-transition.tsx) use the
 * browser's View Transitions API. Chrome refuses one while the tab is in the
 * background and React reports that as an error ("Transition was aborted
 * because of invalid state. Document hidden"), for example when someone clicks
 * a link and switches tabs before the page arrives.
 *
 * While the document is hidden there is nothing to animate anyway, so this
 * runs the update straight away and hands React a transition object whose
 * promises all settle once the update is done. There are no pseudo-elements,
 * so React finds nothing to animate and carries on.
 */
type Update = (() => unknown) | undefined;
type StartArg = (() => unknown) | { update?: () => unknown; types?: string[] } | undefined;

function skipped(update: Update) {
  const updateCallbackDone = Promise.resolve().then(() => update?.());
  const done = updateCallbackDone.then(
    () => undefined,
    () => undefined,
  );
  return {
    updateCallbackDone,
    ready: done,
    finished: done,
    skipTransition: () => {},
    types: new Set<string>(),
  };
}

export function guardViewTransitions(): void {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") return;
  const original = document.startViewTransition.bind(document);
  const guarded = (arg?: StartArg) => {
    if (document.visibilityState !== "hidden") return original(arg as Parameters<typeof original>[0]);
    const update = typeof arg === "function" ? arg : arg?.update;
    return skipped(update) as unknown as ViewTransition;
  };
  document.startViewTransition = guarded as typeof document.startViewTransition;
}
