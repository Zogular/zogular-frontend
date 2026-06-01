"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell, CircleHelp, LayoutDashboard, LogOut, Package,
  Plus, Settings, ShoppingCart, Store, TrendingUp, Wallet, Boxes, PanelLeftClose, PanelLeftOpen, MoreHorizontal, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";
import { readLocalStorageValue } from "@/lib/persisted-storage";
import { SellerApplicationContext } from "@/components/seller/SellerApplicationContext";
import { SellerStatusNotice } from "@/components/seller/SellerStatusNotice";
import { getStoredAuthSession, logout } from "@/services/auth";
import { ApiError } from "@/services/api";
import {
  getMyVendorApplication,
  hasSellerCapability,
  isSellerBlockedStatus,
} from "@/services/vendor-application";
import type { SellerApplicationStatus, VendorApplication } from "@/types/seller";

// --- TYPES & NAV DATA ---
type SellerNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  match?: "exact" | "startsWith";
};

const SELLER_NAV_ITEMS: SellerNavItem[] = [
  { label: "Dashboard", href: "/seller", icon: LayoutDashboard, match: "exact" },
  { label: "Products", href: "/seller/products", icon: Package, match: "startsWith" },
  { label: "Inventory", href: "/seller/inventory", icon: Boxes, match: "startsWith" },
  { label: "Orders", href: "/seller/orders", icon: ShoppingCart, match: "startsWith" },
  { label: "Analytics", href: "/seller/analytics", icon: TrendingUp, match: "startsWith" },
  { label: "Payouts", href: "/seller/payouts", icon: Wallet, match: "startsWith" },
  { label: "Notifications", href: "/seller/notifications", icon: Bell, match: "startsWith" },
  { label: "Support", href: "/seller/support", icon: CircleHelp, match: "startsWith" },
  { label: "Settings", href: "/seller/settings", icon: Settings, match: "startsWith" },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/seller", icon: LayoutDashboard, match: "exact" as const },
  { label: "Products", href: "/seller/products", icon: Package, match: "startsWith" as const },
  { label: "Orders", href: "/seller/orders", icon: ShoppingCart, match: "startsWith" as const },
  { label: "Payouts", href: "/seller/payouts", icon: Wallet, match: "startsWith" as const },
];

const MOBILE_MORE_ITEMS = [
  { label: "Inventory", href: "/seller/inventory", icon: Boxes, match: "startsWith" as const },
  { label: "Analytics", href: "/seller/analytics", icon: TrendingUp, match: "startsWith" as const },
  { label: "Notifications", href: "/seller/notifications", icon: Bell, match: "startsWith" as const },
  { label: "Support", href: "/seller/support", icon: CircleHelp, match: "startsWith" as const },
  { label: "Settings", href: "/seller/settings", icon: Settings, match: "startsWith" as const },
];

// --- LOGIC HELPERS ---
function isRouteActive(pathname: string, href: string, match: "exact" | "startsWith" = "startsWith") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string) {
  const matched = [...SELLER_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isRouteActive(pathname, item.href, item.match));

  if (!matched) return "Seller Hub";

  if (pathname !== matched.href && pathname.startsWith(`${matched.href}/`)) {
    if (matched.href === "/seller/products") return "Product Details";
    if (matched.href === "/seller/orders") return "Order Management";
    if (matched.href === "/seller/inventory") return "Inventory Details";
  }

  return matched.label;
}

type NavLinkProps = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  collapsed?: boolean;
};

// --- EXTRACTED NAV COMPONENTS ---
function NavLink({ href, label, Icon, isActive, collapsed = false }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex h-10 items-center rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1A10]",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        isActive
          ? "bg-[#009E49] text-white shadow-[0_4px_15px_rgba(0,158,73,0.3)]"
          : "text-[#80b898] hover:bg-[#112E1C] hover:text-white",
      )}
    >
      <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-[#5e9676]"}`} />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-all duration-300",
          collapsed ? "w-0 opacity-0" : "w-36 opacity-100",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function MobileNavLink({ href, label, Icon, isActive }: NavLinkProps) {
  return (
    <Link href={href} className="flex h-14 flex-1 flex-col items-center justify-center">
      <div className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${isActive ? "bg-[#009E49]/10" : ""}`}>
        <Icon className={`h-5 w-5 ${isActive ? "text-[#009E49]" : "text-zinc-400"}`} />
      </div>
      <span className={`text-[9px] font-bold ${isActive ? "text-[#009E49]" : "text-zinc-500"}`}>{label}</span>
    </Link>
  );
}

// --- MAIN LAYOUT COMPONENT ---
const SELLER_SIDEBAR_COLLAPSED_KEY = "zogular_seller_sidebar_collapsed";

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return readLocalStorageValue(SELLER_SIDEBAR_COLLAPSED_KEY, ["zamoyo_seller_sidebar_collapsed"]) === "true";
}

export default function SellerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [application, setApplication] = useState<VendorApplication | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(true);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const pageTitle = getPageTitle(pathname);
  const isOnboardingRoute = pathname.startsWith("/seller/onboarding");
  const isStatusRoute = pathname.startsWith("/seller/status");
  const isVerifyPhoneRoute = pathname.startsWith("/seller/verify-phone");
  const sellerStatus: SellerApplicationStatus | null = application?.status ?? null;
  const canCreateDraftProduct = hasSellerCapability(sellerStatus, "canCreateDraftProduct");
  const addProductHref = !application
    ? "/seller/onboarding?start=1"
    : canCreateDraftProduct
      ? "/seller/products/new"
      : application.status === "DRAFT" || application.status === "NEEDS_INFO"
        ? "/seller/onboarding"
        : "/seller/status";

  const refreshApplication = useCallback(async () => {
    const existingSession = getStoredAuthSession();
    if (!existingSession) {
      setApplication(null);
      setApplicationLoading(false);
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    try {
      setApplicationLoading(true);
      setApplicationError(null);
      const nextApplication = await getMyVendorApplication();
      setApplication(nextApplication);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setApplication(null);
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        setApplication(null);
        router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setApplicationError(error instanceof Error ? error.message : "Failed to load seller access state.");
    } finally {
      setApplicationLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    void refreshApplication();
  }, [refreshApplication]);

  useEffect(() => {
    if (applicationLoading) return;

    if (!application) {
      if (!isOnboardingRoute && !isStatusRoute && !isVerifyPhoneRoute) {
        router.replace("/seller/onboarding");
      }
      return;
    }

    if (isSellerBlockedStatus(application.status) && !isStatusRoute && !isVerifyPhoneRoute) {
      router.replace("/seller/status");
    }
  }, [application, applicationLoading, isOnboardingRoute, isStatusRoute, isVerifyPhoneRoute, router]);

  const handleSidebarToggle = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SELLER_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    const result = await logout();
    router.push(result.nextPath ?? "/auth/login");
  };

  const contextValue = useMemo(
    () => ({
      application,
      loading: applicationLoading,
      error: applicationError,
      refresh: refreshApplication,
      setApplication,
      status: sellerStatus,
    }),
    [application, applicationError, applicationLoading, refreshApplication, sellerStatus],
  );

  if (applicationLoading && !application && !isOnboardingRoute && !isStatusRoute && !isVerifyPhoneRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4fbf6] p-6">
        <div className="rounded-3xl border border-zinc-200 bg-white/90 px-6 py-5 text-sm font-semibold text-zinc-600 shadow-sm">
          Loading seller workspace...
        </div>
      </div>
    );
  }

  return (
    <SellerApplicationContext.Provider value={contextValue}>
    <div className="flex min-h-screen w-full flex-col bg-[#f4fbf6] md:flex-row">
      
      {/* =========================================
          1. MOBILE HEADER (Sticky Top)
          ========================================= */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#143320] bg-[#0A1A10] p-4 text-white shadow-sm md:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo mode="icon" variant="dark" imageClassName="h-9 w-9 rounded-lg shadow-[0_0_15px_rgba(0,158,73,0.4)]" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black tracking-tight text-white">Zogular Store</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#009E49]">{pageTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={addProductHref}>
            <Button aria-label="Add product" size="icon" className="h-8 w-8 rounded-full bg-[#009E49] text-white hover:bg-[#00853d] shadow-sm">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/seller/notifications" aria-label="Open notifications" className="relative flex h-8 w-8 items-center justify-center rounded-full text-[#80b898] transition-colors hover:bg-white/5 hover:text-white">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-[#FF6B00] border-2 border-[#0A1A10]" />
          </Link>
        </div>
      </header>

      {/* =========================================
          2. DESKTOP SIDEBAR
          ========================================= */}
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-screen flex-col border-r border-[#143320] bg-[#0A1A10] shadow-[10px_0_30px_rgba(0,0,0,0.1)] transition-[width] duration-300 ease-out md:flex",
          sidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        
        {/* Brand Area */}
        <div className={cn("flex h-18 items-center border-b border-[#143320] transition-all duration-300", sidebarCollapsed ? "justify-center px-3" : "px-5")}>
          <Link
            href="/seller"
            aria-label="Zogular Seller Hub"
            title={sidebarCollapsed ? "Zogular Seller Hub" : undefined}
            className={cn("flex min-w-0 items-center rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1A10]", sidebarCollapsed ? "justify-center" : "gap-3")}
          >
            <BrandLogo mode="icon" variant="dark" imageClassName="h-8 w-8 rounded-xl shadow-[0_0_15px_rgba(0,158,73,0.5)]" />
            <div className={cn("flex min-w-0 flex-col overflow-hidden transition-all duration-300", sidebarCollapsed ? "w-0 opacity-0" : "w-36 opacity-100")}>
              <span className="leading-none text-lg font-black tracking-tight text-white">Zogular</span>
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#009E49]">Seller Hub</span>
            </div>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className={cn("flex-1 overflow-y-auto py-6 custom-scrollbar", sidebarCollapsed ? "px-3" : "px-4")}>
          <p className={cn("mb-3 overflow-hidden px-2 text-[10px] font-bold uppercase tracking-widest text-[#457a5b] transition-all duration-300", sidebarCollapsed ? "h-0 opacity-0" : "h-4 opacity-100")}>Menu</p>
          <div className="flex flex-col gap-1">
            {SELLER_NAV_ITEMS.map((item) => (
              <NavLink 
                key={item.href} 
                href={item.href}
                label={item.label}
                Icon={item.icon}
                isActive={isRouteActive(pathname, item.href, item.match)} 
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>
        </nav>

        {/* Footer Actions */}
        <div className={cn("space-y-2 border-t border-[#143320] p-4", sidebarCollapsed && "px-3")}>
          <Link
            href="/"
            aria-label="View public store"
            title={sidebarCollapsed ? "View Public Store" : undefined}
            className={cn(
              "flex h-10 w-full items-center justify-center rounded-xl bg-[#112E1C] text-xs font-bold text-[#80b898] transition-colors hover:bg-[#183d26] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1A10]",
              sidebarCollapsed ? "gap-0 px-0" : "gap-2 px-3",
            )}
          >
            <Store className="h-4 w-4" />
            <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-300", sidebarCollapsed ? "w-0 opacity-0" : "w-28 opacity-100")}>View Public Store</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title={sidebarCollapsed ? "Sign Out" : undefined}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-center rounded-xl text-xs font-bold text-[#ff8a8a] transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1A10] active:scale-[0.98]",
              sidebarCollapsed ? "gap-0 px-0" : "gap-2 px-3",
            )}
          >
            <LogOut className="h-4 w-4" />
            <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-300", sidebarCollapsed ? "w-0 opacity-0" : "w-16 opacity-100")}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* =========================================
          3. MAIN CONTENT & DESKTOP HEADER
          ========================================= */}
      <div className="flex flex-1 flex-col min-w-0 pb-20 md:pb-0">
        
        {/* Desktop Header (Glassmorphism) */}
        <header className="sticky top-0 z-30 hidden h-18 items-center justify-between border-b border-zinc-200/80 bg-white/80 px-8 backdrop-blur-md md:flex">
          
          <div className="flex min-w-0 items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={sidebarCollapsed ? "Expand seller sidebar" : "Collapse seller sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={handleSidebarToggle}
              className="h-10 w-10 rounded-2xl border border-zinc-200/80 bg-white text-zinc-600 shadow-sm hover:border-[#009E49]/20 hover:bg-[#009E49]/8 hover:text-[#009E49]"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <h1 className="truncate text-2xl font-black tracking-tight text-zinc-900">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <Link href={addProductHref}>
              <Button className="h-10 rounded-xl bg-[#009E49] px-5 font-bold text-white shadow-[0_4px_15px_rgba(0,158,73,0.2)] transition-all hover:scale-105 hover:bg-[#00853d]">
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </Link>

            <div className="h-6 w-px bg-zinc-200"></div>

            <Link href="/seller/notifications" aria-label="Open notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 shadow-sm">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#FF6B00]" />
            </Link>

            {/* Seller Identity Dropdown Trigger */}
            <Link href="/seller/settings" className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-1.5 pr-4 shadow-sm cursor-pointer hover:bg-zinc-50 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-zinc-800 to-zinc-900 text-white font-bold text-xs shadow-inner">
                ZS
              </div>
              <div className="leading-none">
                <p className="text-sm font-bold text-zinc-900">Zogular Store</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5">Admin</p>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content Injection */}
        <main className="flex-1 p-4 md:p-6 w-full">
          {application && !isOnboardingRoute && !isStatusRoute && application.status !== "APPROVED" ? (
            <div className="mx-auto mb-5 max-w-350">
              <SellerStatusNotice application={application} compact />
            </div>
          ) : null}
          {applicationError && !application ? (
            <div className="mx-auto mb-5 max-w-350 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-sm">
              {applicationError}
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {/* =========================================
          4. MOBILE BOTTOM NAV
          ========================================= */}
      {mobileMoreOpen ? (
        <div className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-sm md:hidden" onClick={() => setMobileMoreOpen(false)}>
          <div
            className="absolute inset-x-3 bottom-24 rounded-3xl border border-zinc-200 bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Seller Tools</p>
              <button
                type="button"
                aria-label="Close seller tools"
                onClick={() => setMobileMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(pathname, item.href, item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 text-sm font-bold transition-colors",
                      active ? "border-[#009E49]/20 bg-[#009E49]/10 text-[#009E49]" : "border-zinc-100 bg-zinc-50 text-zinc-700",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      <div className="fixed bottom-0 left-0 z-40 flex w-full justify-between border-t border-zinc-200 bg-white px-2 pt-2 pb-6 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] md:hidden">
        {MOBILE_NAV_ITEMS.map((item) => (
          <MobileNavLink 
            key={item.href} 
            href={item.href}
            label={item.label}
            Icon={item.icon}
            isActive={isRouteActive(pathname, item.href, item.match)} 
          />
        ))}
        <button
          type="button"
          aria-label="Open more seller tools"
          onClick={() => setMobileMoreOpen((open) => !open)}
          className="flex h-14 flex-1 flex-col items-center justify-center"
        >
          <div className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${mobileMoreOpen ? "bg-[#009E49]/10" : ""}`}>
            <MoreHorizontal className={`h-5 w-5 ${mobileMoreOpen ? "text-[#009E49]" : "text-zinc-400"}`} />
          </div>
          <span className={`text-[9px] font-bold ${mobileMoreOpen ? "text-[#009E49]" : "text-zinc-500"}`}>More</span>
        </button>
      </div>

    </div>
    </SellerApplicationContext.Provider>
  );
}
