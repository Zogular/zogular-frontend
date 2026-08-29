"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderTree,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logoutAdmin } from "@/services/admin/auth";
import {
  adminIdentityHasPermission,
  getAdminInitials,
  type AdminIdentity,
} from "@/services/admin/session";
import type { Permission } from "@/services/rbac";
import theme from "@/components/admin/admin-theme.module.css";

export const AdminIdentityContext = createContext<AdminIdentity | null>(null);

export function useAdminIdentity() {
  return useContext(AdminIdentityContext);
}

export interface AdminNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { name: "Overview", href: "/admin/dashboard", icon: LayoutDashboard, permission: "view_dashboard" },
  { name: "Seller Management", href: "/admin/sellers", icon: Store, permission: "view_sellers" },
  { name: "Customer Management", href: "/admin/buyers", icon: Users, permission: "view_buyers" },
  { name: "Products & Review", href: "/admin/products", icon: Package, permission: "view_products" },
  { name: "Orders", href: "/admin/orders", icon: Truck, permission: "view_orders" },
  { name: "Categories", href: "/admin/categories", icon: FolderTree, permission: "manage_content" },
  { name: "Support", href: "/admin/support", icon: LifeBuoy, permission: "view_support_tickets" },
  { name: "Admins & Roles", href: "/admin/access", icon: ShieldCheck, permission: "manage_admins" },
];

const ADMIN_DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

function getAdminPageTitle(pathname: string) {
  return [...ADMIN_NAV_ITEMS]
    .sort((left, right) => right.href.length - left.href.length)
    .find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.name ?? "Admin";
}

function formatRole(role: string) {
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AdminNavigation({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly AdminNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canopy-deep)] motion-reduce:transition-none",
                  active
                    ? theme.navActive
                    : theme.navItem,
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    active
                      ? "text-[var(--admin-ember)]"
                      : "text-[color:rgba(255,248,236,0.46)]",
                  )}
                />
                <span className="min-w-0 flex-1">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AdminAccount({ identity }: { identity: AdminIdentity }) {
  return (
    <div className="border-t border-[color:rgba(255,248,236,0.12)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:rgba(255,248,236,0.2)] bg-[var(--admin-copper-muted)] text-sm font-bold text-[var(--admin-ink)] shadow-[inset_0_1px_0_rgba(255,248,236,0.45)]">
          {getAdminInitials(identity.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--admin-surface-cream)]">{identity.name}</p>
          <p className="truncate text-xs text-[color:rgba(255,248,236,0.62)]">{formatRole(identity.claims.role)}</p>
        </div>
      </div>
    </div>
  );
}

function AdminSidebarContent({
  identity,
  items,
  pathname,
  onNavigate,
  mobile,
}: {
  identity: AdminIdentity;
  items: readonly AdminNavItem[];
  pathname: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)]">
      <div className="relative flex min-h-16 shrink-0 items-center justify-between border-b border-[color:rgba(255,248,236,0.12)] px-4 before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-r-full before:bg-[var(--admin-ember)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo variant="dark" imageClassName="h-7 w-auto" priority />
          <span className="rounded-md border border-[color:rgba(184,135,70,0.55)] bg-[color:rgba(184,135,70,0.13)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-surface-cream)]">
            Admin
          </span>
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
      <AdminNavigation items={items} pathname={pathname} onNavigate={onNavigate} />
      <AdminAccount identity={identity} />
    </div>
  );
}

export default function AdminShell({
  children,
  identity,
}: {
  children: React.ReactNode;
  identity: AdminIdentity;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const desktopViewport = window.matchMedia(ADMIN_DESKTOP_MEDIA_QUERY);
    const closeMobileMenuAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileMenuOpen(false);
    };

    desktopViewport.addEventListener("change", closeMobileMenuAtDesktop);
    return () => desktopViewport.removeEventListener("change", closeMobileMenuAtDesktop);
  }, []);

  const authorizedNavItems = ADMIN_NAV_ITEMS.filter((item) =>
    adminIdentityHasPermission(identity, item.permission),
  );
  const pageTitle = getAdminPageTitle(pathname);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const session = await logoutAdmin();
      toast.success(session.message);
      router.replace(session.nextPath);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sign out. Try again.";
      toast.error(message);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <AdminIdentityContext.Provider value={identity}>
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <div
          className={cn(theme.adminScope, "flex h-dvh min-w-0 overflow-hidden bg-[var(--admin-canvas-warm)]")}
          data-testid="admin-shell-root"
        >
          <aside
            className="hidden h-dvh w-64 shrink-0 border-r border-[color:rgba(184,135,70,0.3)] lg:block"
            data-testid="admin-desktop-sidebar"
          >
            <AdminSidebarContent
              identity={identity}
              items={authorizedNavItems}
              pathname={pathname}
            />
          </aside>

          <SheetContent
            side="left"
            showCloseButton={false}
            className={cn(theme.adminScope, theme.mobileDrawer, "gap-0 border-r border-[color:rgba(184,135,70,0.3)] bg-[var(--admin-canopy-deep)] p-0 motion-reduce:transition-none")}
            style={{ width: "min(19rem, calc(100vw - 2rem))", maxWidth: "none" }}
            data-testid="admin-mobile-drawer"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Admin navigation</SheetTitle>
              <SheetDescription>Open an admin workspace page.</SheetDescription>
            </SheetHeader>
            <AdminSidebarContent
              identity={identity}
              items={authorizedNavItems}
              pathname={pathname}
              onNavigate={() => setIsMobileMenuOpen(false)}
              mobile
            />
          </SheetContent>

          <main className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[color:rgba(184,135,70,0.32)] bg-[var(--admin-surface-cream)] px-3 pt-safe shadow-[inset_0_-1px_0_rgba(255,248,236,0.75)] sm:px-5 lg:px-8">
              <div className="flex min-w-0 items-center gap-2.5">
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 text-[var(--admin-canopy-deep)] hover:bg-[var(--admin-surface-mist)] lg:hidden"
                    aria-label="Open admin menu"
                    data-testid="admin-menu-button"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">{pageTitle}</p>
                  <p className="truncate text-xs text-[var(--admin-ink-soft)]">Admin workspace</p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="h-11 shrink-0 px-3 text-sm font-medium text-[var(--admin-ink-soft)] hover:bg-[color:rgba(184,59,50,0.08)] hover:text-[var(--admin-escalation)]"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut />
                <span className="hidden sm:inline">{isSigningOut ? "Signing out" : "Sign out"}</span>
                <span className="sr-only sm:hidden">{isSigningOut ? "Signing out" : "Sign out"}</span>
              </Button>
            </header>

            <div
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[var(--admin-canvas-warm)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
              data-testid="admin-main-scroll"
            >
              {children}
            </div>
          </main>
        </div>
      </Sheet>
    </AdminIdentityContext.Provider>
  );
}
