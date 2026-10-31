"use client";

/**
 * Account menu at the right of the top bar: who is signed in, their role, quick links
 * and "Sign out". Sign-out submits a hidden form to the `logoutAction` Server Action
 * (requestSubmit keeps it working even as the menu closes and unmounts).
 */
import { useRef } from "react";
import Link from "next/link";
import { ChevronDown, Globe, House, LogOut, ShieldCheck } from "lucide-react";

import { resetAnalytics } from "@/lib/analytics-client";
import { ROLE_LABELS } from "@/lib/constants";
import { roleHome } from "@/lib/navigation";
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

export function UserMenu({ user }: { user: SessionUser }) {
  const logoutForm = useRef<HTMLFormElement>(null);
  const displayName = user.name || user.email;
  const firstName = displayName.split(/\s+/)[0];

  return (
    <>
      <form ref={logoutForm} action={logoutAction} onSubmit={resetAnalytics} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full p-0.5 pr-1 transition-colors hover:bg-accent data-[state=open]:bg-accent md:pr-2.5 pointer-coarse:p-1.5"
            aria-label={`Account menu for ${displayName}`}
          >
            <Avatar name={displayName} size="sm" />
            <span className="hidden max-w-32 truncate text-sm font-medium text-foreground md:inline">{firstName}</span>
            <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="px-2.5 py-2 font-normal">
            <div className="flex items-center gap-3">
              <Avatar name={displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Badge variant="brand" className="mt-2.5">
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={roleHome(user.role)}>
                <House aria-hidden="true" />
                My home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/warranty">
                <ShieldCheck aria-hidden="true" />
                Warranty check
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/">
                <Globe aria-hidden="true" />
                Public website
              </Link>
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
