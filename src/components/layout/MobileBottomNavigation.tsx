"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ComponentType } from "react";
import { Grid2X2, Heart, Home, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredAuthSession } from "@/services/auth";
import { appendNextPath } from "@/services/auth-intent";
import { AUTH_SESSION_CHANGED_EVENT, getAuthSessionSnapshot } from "@/services/auth-session";

type MobileDestination = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active: (pathname: string) => boolean;
};

const VISIBLE_PATHS = ["/categories", "/category/", "/products", "/search", "/new-arrivals", "/account"] as const;

function isVisiblePath(pathname: string) {
  return pathname === "/" || VISIBLE_PATHS.some((path) => pathname === path || pathname.startsWith(path));
}

function subscribeToAuthSession(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith("zogular_") || event.key.startsWith("zamoyo_")) onStoreChange();
  };
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function MobileBottomNavigation() {
  const pathname = usePathname() || "/";
  const authSnapshot = useSyncExternalStore(subscribeToAuthSession, getAuthSessionSnapshot, () => "");
  void authSnapshot;

  if (!isVisiblePath(pathname)) return null;

  const isLoggedIn = Boolean(getStoredAuthSession()?.user);
  const destinations: MobileDestination[] = [
    { label: "Home", href: "/", icon: Home, active: (path) => path === "/" },
    { label: "Categories", href: "/categories", icon: Grid2X2, active: (path) => path === "/categories" || path.startsWith("/category/") },
    { label: "Wishlist", href: "/account/saved", icon: Heart, active: (path) => path.startsWith("/account/saved") },
    {
      label: "Orders",
      href: isLoggedIn ? "/account/orders" : appendNextPath("/auth/login", "/account/orders"),
      icon: Package,
      active: (path) => path.startsWith("/account/orders"),
    },
    {
      label: "Account",
      href: isLoggedIn ? "/account" : appendNextPath("/auth/login", "/account"),
      icon: User,
      active: (path) => path === "/account" || (path.startsWith("/account/") && !path.startsWith("/account/saved") && !path.startsWith("/account/orders")),
    },
  ];

  return (
    <>
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" data-testid="mobile-bottom-nav-clearance" />
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl md:hidden"
        data-testid="mobile-bottom-navigation"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
          {destinations.map(({ label, href, icon: Icon, active }) => {
            const isActive = active(pathname);
            return (
              <Link
                key={label}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-bold leading-none text-zinc-500 outline-none transition-colors hover:text-[#007d3a] focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-inset motion-reduce:transition-none",
                  isActive && "text-[#007d3a]",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden={true} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
