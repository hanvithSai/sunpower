"use client";

/**
 * The role-filtered navigation list and the signed-in user card. Shared by the
 * desktop sidebar and the mobile navigation sheet so both always match.
 * Icons come from @/lib/navigation inside this client component (icon components
 * can't be passed from the server as props).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { ROLE_LABELS, type Role } from "@/lib/constants";
import { navForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/shared/submit-button";
import { resetAnalytics } from "@/lib/analytics-client";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/auth/session";

/** A nav item is active on its own page and any page below it (/leads → /leads/42). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href.includes("#")) return false; // in-page anchors (e.g. /dashboard#reports) never steal the highlight
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  role,
  onNavigate,
  className,
}: {
  role: Role;
  /** Called after a link is clicked (the mobile sheet closes itself with this). */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const sections = navForRole(role);

  return (
    <nav aria-label="Main" className={cn("flex flex-col gap-5", className)}>
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground/80 uppercase">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isNavItemActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                      "pointer-coarse:h-11",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4.5 shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
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

export function SidebarUserCard({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <Avatar name={user.name || user.email} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-5 font-medium text-foreground">{user.name || user.email}</p>
        <p className="truncate text-xs leading-4 text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
      </div>
      <form action={logoutAction} onSubmit={resetAnalytics}>
        <SubmitButton
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
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
