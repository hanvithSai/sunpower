"use client";

/**
 * The role-filtered navigation and the signed-in user card, on the deep-forest
 * sidebar. Shared by the desktop sidebar (expanded or collapsed to icons) and
 * the mobile navigation sheet so both always match.
 *
 * Sections follow a solar project's life (src/lib/navigation.ts). Each item's
 * one-line purpose shows as its tooltip; collapsed, the label moves into the
 * tooltip too. The current page gets a sunlight-amber marker.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { ROLE_LABELS, type Role } from "@/lib/constants";
import { activeNavItem, navForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/shared/submit-button";
import { resetAnalytics } from "@/lib/analytics-client";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/auth/session";

export function SidebarNav({
  role,
  onNavigate,
  collapsed = false,
  className,
}: {
  role: Role;
  /** Called after a link is clicked (the mobile sheet closes itself with this). */
  onNavigate?: () => void;
  /** Icons only (desktop). Labels move into the tooltip. */
  collapsed?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const sections = navForRole(role);
  const active = activeNavItem(pathname, sections);

  return (
    <nav aria-label="Main" className={cn("flex flex-col gap-5", className)}>
      {sections.map((section) => (
        <div key={section.title}>
          {collapsed ? (
            <div aria-hidden="true" className="mx-3 mb-2 h-px bg-white/10" />
          ) : (
            <p className="px-3 pb-1.5 text-[12px] font-medium text-forest-muted">{section.title}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, hint, icon: Icon }) => {
              const isActive = active?.item.href === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={collapsed ? label : undefined}
                    title={collapsed ? `${label}: ${hint}` : hint}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11",
                      collapsed && "justify-center px-0",
                      isActive ? "bg-white/10 text-white" : "text-forest-foreground/80 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    {isActive ? <span aria-hidden="true" className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-sun" /> : null}
                    <Icon
                      className={cn("size-4.5 shrink-0 transition-colors", isActive ? "text-sun" : "text-forest-muted group-hover:text-forest-foreground")}
                      aria-hidden="true"
                    />
                    {collapsed ? null : <span className="truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarUserCard({ user, collapsed = false }: { user: SessionUser; collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", collapsed && "flex-col gap-2 px-0")}>
      {/* Sunlight on forest (7.8:1) instead of the light-surface avatar tints. */}
      <Avatar name={user.name || user.email} className="bg-sun text-forest" />
      {collapsed ? null : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-5 font-medium text-white">{user.name || user.email}</p>
          <p className="truncate text-xs leading-4 text-forest-muted">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
      )}
      <form action={logoutAction} onSubmit={resetAnalytics}>
        <SubmitButton
          variant="ghost"
          size="icon"
          className="size-8 text-forest-muted hover:bg-white/8 hover:text-white"
          aria-label="Sign out"
          title="Sign out"
          pendingText={<span className="sr-only">Signing out…</span>}
        >
          <LogOut aria-hidden="true" />
        </SubmitButton>
      </form>
    </div>
  );
}
