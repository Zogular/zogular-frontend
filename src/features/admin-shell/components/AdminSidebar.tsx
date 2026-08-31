"use client";

import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AdminNavigation } from "./AdminNavigation";
import type { AdminShellNavigationGroup } from "../lib/admin-shell-model";
import type { AdminSidebarMode } from "../lib/admin-shell-preference";

export function AdminSidebar({
  groups,
  pathname,
  mode,
  mobile = false,
  onModeChange,
  onNavigate,
}: {
  groups: readonly AdminShellNavigationGroup[];
  pathname: string;
  mode: AdminSidebarMode;
  mobile?: boolean;
  onModeChange?: () => void;
  onNavigate?: () => void;
}) {
  const collapsed = !mobile && mode === "collapsed";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)]">
      <div
        className={cn(
          "relative flex min-h-16 shrink-0 items-center border-b border-[color:rgba(255,248,236,0.12)] before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-r-full before:bg-[var(--admin-ember)]",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <div className={cn("flex min-w-0 items-center", collapsed ? "justify-center" : "gap-2.5")}>
          <BrandLogo
            variant="dark"
            mode={collapsed ? "icon" : "wordmark"}
            imageClassName={collapsed ? "size-8" : "h-7 w-auto"}
            priority
          />
          {collapsed ? null : (
            <span className="rounded-md border border-[color:rgba(184,135,70,0.55)] bg-[color:rgba(184,135,70,0.13)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-surface-cream)]">
              Admin
            </span>
          )}
        </div>
        {mobile ? (
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 text-[color:rgba(255,248,236,0.75)] hover:bg-[color:rgba(255,248,236,0.1)] hover:text-[var(--admin-surface-cream)]"
              aria-label="Close admin menu"
            >
              <X />
            </Button>
          </SheetClose>
        ) : null}
      </div>

      <AdminNavigation
        groups={groups}
        pathname={pathname}
        collapsed={collapsed}
        navigationId={mobile ? undefined : "admin-desktop-navigation"}
        onNavigate={onNavigate}
      />

      {mobile ? null : (
        <div className={cn("border-t border-[color:rgba(255,248,236,0.12)]", collapsed ? "p-2" : "p-3")}>
          <Button
            type="button"
            variant="ghost"
            onClick={onModeChange}
            aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
            aria-expanded={!collapsed}
            aria-controls="admin-desktop-navigation"
            className={cn(
              "min-h-11 text-[color:rgba(255,248,236,0.72)] hover:bg-[color:rgba(255,248,236,0.1)] hover:text-[var(--admin-surface-cream)]",
              collapsed ? "w-full px-0" : "w-full justify-start gap-3 px-3",
            )}
            data-testid="admin-sidebar-toggle"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {collapsed ? null : <span>Collapse sidebar</span>}
          </Button>
        </div>
      )}
    </div>
  );
}
