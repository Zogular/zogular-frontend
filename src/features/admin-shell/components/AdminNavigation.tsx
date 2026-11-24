"use client";

import { createElement } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAdminShellIcon } from "../config/admin-shell-icons";
import {
  isAdminDestinationActive,
  type AdminShellDestination,
  type AdminShellNavigationGroup,
} from "../lib/admin-shell-model";
import theme from "@/components/admin/admin-theme.module.css";

function AdminDestinationLink({
  destination,
  pathname,
  collapsed,
  onNavigate,
}: {
  destination: AdminShellDestination;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isAdminDestinationActive(pathname, destination.href);
  const icon = getAdminShellIcon(destination.id);
  const link = (
    <Link
      href={destination.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? destination.label : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center rounded-xl py-2 text-sm font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canopy-deep)] motion-reduce:transition-none",
        collapsed ? "justify-center px-2" : "gap-3 px-3",
        active ? theme.navActive : theme.navItem,
      )}
    >
      {createElement(icon, {
        "aria-hidden": true,
        className: cn(
          "size-[1.125rem] shrink-0",
          active
            ? "text-[var(--admin-ember)]"
            : "text-[color:rgba(255,248,236,0.5)]",
        ),
      })}
      {collapsed ? null : <span className="min-w-0 flex-1">{destination.label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{destination.label}</TooltipContent>
    </Tooltip>
  );
}

export function AdminNavigation({
  groups,
  pathname,
  collapsed = false,
  navigationId,
  onNavigate,
}: {
  groups: readonly AdminShellNavigationGroup[];
  pathname: string;
  collapsed?: boolean;
  navigationId?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav
      id={navigationId}
      aria-label="Admin navigation"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto py-4",
        collapsed ? "px-2" : "px-3",
      )}
    >
      <ul className="space-y-5">
        {groups.map((group) => (
          <li key={group.id}>
            {collapsed ? (
              <span className="sr-only">{group.label}</span>
            ) : (
              <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-[color:rgba(255,248,236,0.42)]">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.destinations.map((destination) => (
                <li key={destination.id}>
                  <AdminDestinationLink
                    destination={destination}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
