"use client";

/**
 * AppShell — the frame around every signed-in page.
 *
 * - Desktop (lg+): fixed white sidebar (logo, role-filtered navigation, user card with sign-out).
 * - Sticky translucent top bar: search trigger ("⌘K"/"Ctrl K" hint) and the account menu;
 *   below lg it also gets the hamburger that opens the navigation sheet.
 * - Main column: max-w-7xl, 16px padding on phones and 24px from `sm`.
 * - One global command palette (⌘K / Ctrl+K).
 * - Analytics: identifies the signed-in user by id and role only, which also starts session replay.
 * The data-app-* attributes let print styles hide the chrome for quotes and invoices.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { identifyStaff } from "@/lib/analytics-client";
import { roleHome } from "@/lib/navigation";
import { Logo } from "@/components/brand/logo";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SidebarNav, SidebarUserCard } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import type { SessionUser } from "@/server/auth/session";

export type AppShellProps = {
  user: SessionUser;
  children: ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const home = roleHome(user.role);

  useEffect(() => identifyStaff(user.id, user.role), [user.id, user.role]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        data-skip-link
        className="sr-only z-60 rounded-lg bg-card px-4 py-2 text-sm font-medium text-primary shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside
        data-app-sidebar
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex"
      >
        <div className="flex h-14 shrink-0 items-center px-5">
          <Link href={home} className="rounded-lg" aria-label="SunPower OS home">
            <Logo size="sm" />
          </Link>
        </div>
        <SidebarNav role={user.role} className="flex-1 overflow-y-auto px-3 pt-3 pb-6" />
        <div className="shrink-0 border-t border-border p-3">
          <SidebarUserCard user={user} />
        </div>
      </aside>

      <div data-app-frame className="flex min-h-dvh flex-col lg:pl-64">
        <header
          data-app-topbar
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-white/70 px-4 backdrop-blur-xl backdrop-saturate-150 sm:gap-3 sm:px-6"
        >
          <MobileNav user={user} />
          <Link href={home} className="shrink-0 rounded-lg lg:hidden" aria-label="SunPower OS home">
            <Logo size="sm" showWordmark={false} />
          </Link>
          <SearchTrigger onOpen={() => setPaletteOpen(true)} />
          <div className="ml-auto flex shrink-0 items-center">
            <UserMenu user={user} />
          </div>
        </header>

        <main id="main-content" data-app-main tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6">
          {children}
        </main>
      </div>

      <CommandPalette role={user.role} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search trigger                                                       */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. The server render assumes ⌘ and corrects on hydrate. */
function useShortcutLabel(): string {
  const isApple = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent),
    () => true,
  );
  return isApple ? "⌘K" : "Ctrl K";
}

function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const shortcut = useShortcutLabel();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-black/3 px-3 text-left text-sm text-muted-foreground transition-colors duration-150 hover:border-input hover:bg-card hover:text-foreground sm:max-w-md pointer-coarse:h-11"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">Search customers, serials, orders…</span>
      <kbd className="hidden h-5 shrink-0 items-center rounded-[5px] border border-border bg-card px-1.5 font-sans text-[11px] font-medium text-muted-foreground sm:inline-flex">
        {shortcut}
      </kbd>
    </button>
  );
}
