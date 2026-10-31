"use client";

/**
 * AppShell — the frame around every signed-in page.
 *
 * - Desktop (lg+): a deep-forest sidebar organised by the project lifecycle (logo, role-filtered
 *   navigation, user card with sign-out). It collapses to icons; the choice is remembered on
 *   this device (`sunpower:sidebar`, listed on /privacy).
 * - Sticky top bar: where you are ("Operations / Dispatch"), search ("⌘K"/"Ctrl K"), a "New"
 *   menu with the role's quick actions (the same list as ⌘K), and the account menu. Below lg
 *   it also gets the hamburger that opens the navigation sheet.
 * - Main column: max-w-7xl, 16px padding on phones and 24px from `sm`.
 * - One global command palette (⌘K / Ctrl+K).
 * - Analytics: identifies the signed-in user by id and role only (only after cookie consent).
 * The data-app-* attributes let print styles hide the chrome for quotes and invoices.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";

import { identifyStaff } from "@/lib/analytics-client";
import { QUICK_ACTIONS, activeNavItem, canAccess, navForRole, roleHome } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SidebarNav, SidebarUserCard } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import type { SessionUser } from "@/server/auth/session";

export type AppShellProps = {
  user: SessionUser;
  children: ReactNode;
};

const SIDEBAR_KEY = "sunpower:sidebar";
const SIDEBAR_EVENT = "sunpower:sidebar-change";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function subscribeCollapsed(callback: () => void) {
  window.addEventListener(SIDEBAR_EVENT, callback);
  return () => window.removeEventListener(SIDEBAR_EVENT, callback);
}

function setCollapsed(collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(SIDEBAR_KEY, "collapsed");
    else window.localStorage.removeItem(SIDEBAR_KEY);
  } catch {
    // Private mode: the toggle still works for this page.
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

export function AppShell({ user, children }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
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
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-forest transition-[width] duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center", collapsed ? "justify-center" : "px-5")}>
          <Link href={home} className="rounded-lg" aria-label="SunPower home">
            <Logo size="sm" showWordmark={!collapsed} className="text-white" />
          </Link>
        </div>
        <SidebarNav role={user.role} collapsed={collapsed} className={cn("flex-1 overflow-y-auto pt-3 pb-4", collapsed ? "px-2" : "px-3")} />
        <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-8 w-full items-center gap-3 rounded-md px-3 text-[13px] text-forest-muted transition-colors hover:bg-white/6 hover:text-white",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
            {collapsed ? null : "Collapse"}
          </button>
          <SidebarUserCard user={user} collapsed={collapsed} />
        </div>
      </aside>

      <div data-app-frame className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-64")}>
        <header
          data-app-topbar
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:gap-3 sm:px-6"
        >
          <MobileNav user={user} />
          <Link href={home} className="shrink-0 rounded-lg lg:hidden" aria-label="SunPower home">
            <Logo size="sm" showWordmark={false} />
          </Link>
          <WhereAmI role={user.role} />
          <SearchTrigger onOpen={() => setPaletteOpen(true)} />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <NewMenu role={user.role} />
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
/* Where am I: the lifecycle section and the page                       */
/* ------------------------------------------------------------------ */

function WhereAmI({ role }: { role: SessionUser["role"] }) {
  const pathname = usePathname();
  const here = activeNavItem(pathname, navForRole(role));
  if (!here) return null;
  return (
    <p className="hidden shrink-0 items-center gap-1.5 text-sm xl:flex">
      <span className="text-muted-foreground">{here.section.title}</span>
      <span aria-hidden="true" className="text-border">
        /
      </span>
      <span className="font-medium text-foreground">{here.item.label}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* New: start a workflow                                                */
/* ------------------------------------------------------------------ */

function NewMenu({ role }: { role: SessionUser["role"] }) {
  const actions = QUICK_ACTIONS.filter((a) => canAccess(role, a.roles) && a.href !== "/warranty");
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5" aria-label="Start something new">
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">New</span>
          <ChevronDown className="hidden size-3.5 opacity-80 sm:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Start a workflow</DropdownMenuLabel>
        {actions.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon aria-hidden="true" />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
      className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-border bg-card px-3 text-left text-sm text-muted-foreground transition-colors duration-150 hover:border-input hover:text-foreground sm:max-w-md pointer-coarse:h-11 xl:ml-4"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">Search customers, serials, orders…</span>
      <kbd className="hidden h-5 shrink-0 items-center rounded-[4px] border border-border bg-background px-1.5 font-sans text-[11px] font-medium text-muted-foreground sm:inline-flex">
        {shortcut}
      </kbd>
    </button>
  );
}
