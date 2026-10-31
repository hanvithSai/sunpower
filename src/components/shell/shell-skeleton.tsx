/**
 * ShellSkeleton — the static placeholder for the whole app frame, shown while the
 * session is read (the Suspense fallback in src/app/(app)/layout.tsx). It mirrors the
 * real AppShell geometry so nothing jumps when the signed-in shell streams in.
 * Static and server-safe, so it is part of the prerendered shell.
 */
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSkeleton } from "@/components/shared/skeletons";

const NAV_GROUPS = [
  { id: "overview", items: 1 },
  { id: "acquisition", items: 2 },
  { id: "sales", items: 3 },
  { id: "operations", items: 5 },
];

/** Placeholder bars on the forest sidebar. */
const bar = "rounded-sm bg-white/10";

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh">
      <aside
        data-app-sidebar
        aria-hidden="true"
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-forest lg:flex"
      >
        <div className="flex h-14 shrink-0 items-center px-5">
          <Logo size="sm" className="text-white" />
        </div>
        <div className="flex-1 space-y-6 px-5 pt-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="space-y-2.5">
              <div className={`h-2.5 w-20 ${bar}`} />
              {Array.from({ length: group.items }, (_, index) => (
                <div key={index} className="flex items-center gap-3 py-1">
                  <div className={`size-4.5 ${bar}`} />
                  <div className={`h-3 w-24 ${bar}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 p-5">
          <div className="size-9 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className={`h-3 w-28 ${bar}`} />
            <div className={`h-2.5 w-16 ${bar}`} />
          </div>
        </div>
      </aside>

      <div data-app-frame className="flex min-h-dvh flex-col lg:pl-64">
        <div
          data-app-topbar
          aria-hidden="true"
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6"
        >
          <Skeleton className="size-9 rounded-lg lg:hidden" />
          <Skeleton className="h-9 min-w-0 flex-1 rounded-lg sm:max-w-md" />
          <Skeleton className="ml-auto size-8 shrink-0 rounded-full" />
        </div>
        <div data-app-main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
