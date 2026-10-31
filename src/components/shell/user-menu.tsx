"use client";

/**
 * The signed-in user, shown once: at the foot of the forest sidebar (and of the
 * mobile navigation sheet). The card is the account menu's trigger — who is
 * signed in, their email and role, quick links, cookie settings and "Sign out".
 * Collapsed, only the avatar shows and the menu opens to the right.
 *
 * Sign-out submits a hidden form to the `logoutAction` Server Action
 * (requestSubmit keeps it working even as the menu closes and unmounts).
 */
import { useRef } from "react";
import Link from "next/link";
import { ChevronsUpDown, Cookie, Globe, House, LogOut, ShieldCheck } from "lucide-react";

import { resetAnalytics } from "@/lib/analytics-client";
import { openConsentSettings } from "@/lib/consent";
import { ROLE_LABELS } from "@/lib/constants";
import { roleHome } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/auth/session";

export function AccountMenu({
  user,
  collapsed = false,
  onNavigate,
}: {
  user: SessionUser;
  collapsed?: boolean;
  /** Called after a link is chosen (the mobile sheet closes itself with this). */
  onNavigate?: () => void;
}) {
  const logoutForm = useRef<HTMLFormElement>(null);
  const displayName = user.name || user.email;
  const role = ROLE_LABELS[user.role] ?? user.role;

  return (
    <>
      <form ref={logoutForm} action={logoutAction} onSubmit={resetAnalytics} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Account menu for ${displayName}`}
            title={collapsed ? `${displayName}, ${role}` : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-white/6 data-[state=open]:bg-white/10",
              collapsed && "justify-center",
            )}
          >
            {/* Sunlight on forest (7.8:1) instead of the light-surface avatar tints. */}
            <Avatar name={displayName} className="bg-sun text-forest" />
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-medium text-white">{displayName}</span>
                  <span className="block truncate text-xs leading-4 text-forest-muted">{role}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-forest-muted" aria-hidden="true" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} sideOffset={8} className="w-64">
          <DropdownMenuLabel className="px-2.5 py-2 font-normal">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <Badge variant="brand" className="mt-2">
              {role}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={roleHome(user.role)} onClick={onNavigate}>
                <House aria-hidden="true" />
                My home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/warranty" onClick={onNavigate}>
                <ShieldCheck aria-hidden="true" />
                Warranty check
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/" onClick={onNavigate}>
                <Globe aria-hidden="true" />
                Public website
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onNavigate?.();
                openConsentSettings();
              }}
            >
              <Cookie aria-hidden="true" />
              Cookie settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => logoutForm.current?.requestSubmit()}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
