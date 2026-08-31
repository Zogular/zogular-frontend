"use client";

import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetTrigger } from "@/components/ui/sheet";
import type { AdminIdentity } from "@/services/admin/session";
import type { AdminShellRouteContext } from "../lib/admin-shell-model";
import { AdminProfilePopover } from "./AdminProfilePopover";

export function AdminHeader({
  identity,
  routeContext,
  mobileMenuOpen,
  onCommandOpen,
}: {
  identity: AdminIdentity;
  routeContext: AdminShellRouteContext | null;
  mobileMenuOpen: boolean;
  onCommandOpen: () => void;
}) {
  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-[color:rgba(184,135,70,0.32)] bg-[var(--admin-surface-cream)] px-3 pt-safe shadow-[inset_0_-1px_0_rgba(255,248,236,0.75)] sm:gap-3 sm:px-5 lg:px-6 xl:px-8">
      <div className="flex min-w-0 items-center gap-2.5">
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-[var(--admin-canopy-deep)] hover:bg-[var(--admin-surface-mist)] lg:hidden"
            aria-label="Open admin menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-mobile-navigation"
            data-testid="admin-menu-button"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <div className="min-w-0">
          <p className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.11em] text-[var(--admin-canopy)]">
            {routeContext?.groupLabel ?? "Admin"}
          </p>
          <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">
            {routeContext?.capabilityLabel ?? "Workspace"}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCommandOpen}
          aria-haspopup="dialog"
          aria-label="Navigate admin"
          className="h-11 min-w-11 gap-2 rounded-xl border border-[color:rgba(184,135,70,0.28)] bg-[var(--admin-surface-mist)] px-3 text-[var(--admin-ink-soft)] hover:border-[color:rgba(184,135,70,0.48)] hover:bg-[var(--admin-canvas-warm)] hover:text-[var(--admin-ink)]"
          data-testid="admin-command-trigger"
        >
          <Search />
          <span className="hidden text-sm sm:inline">Navigate</span>
          <kbd className="hidden rounded border border-[color:rgba(184,135,70,0.35)] bg-[var(--admin-surface-cream)] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[var(--admin-ink-soft)] lg:inline">
            Ctrl K
          </kbd>
        </Button>
        <AdminProfilePopover identity={identity} />
      </div>
    </header>
  );
}
