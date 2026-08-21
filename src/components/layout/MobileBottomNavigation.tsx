"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Grid2X2, Heart, Home, Package, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/use-auth-session";

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

export function MobileBottomNavigation() {
  const pathname = usePathname() || "/";
  const auth = useAuthSession();

  if (!isVisiblePath(pathname)) return null;

  const authSnapshot = auth.status === "authenticated" ? auth.user : null;
  const isLoggedIn = Boolean(authSnapshot);
  const destinations: MobileDestination[] = [
    { label: "Home", href: "/", icon: Home, active: (path) => path === "/" },
    { label: "Categories", href: "/categories", icon: Grid2X2, active: (path) => path === "/categories" || path.startsWith("/category/") },
  ];

  if (isLoggedIn) {
    destinations.push(
      {
        label: "Saved",
        href: "/account/saved",
        icon: Heart,
        active: (path) => path.startsWith("/account/saved"),
      },
      {
        label: "Orders",
        href: "/account/orders",
        icon: Package,
        active: (path) => path.startsWith("/account/orders"),
      },
      {
        label: "Account",
        href: "/account",
        icon: User,
        active: (path) =>
          path === "/account"
          || (path.startsWith("/account/")
            && !path.startsWith("/account/saved")
            && !path.startsWith("/account/orders")),
      },
    );
  } else {
    destinations.push({
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
      active: (path) => path === "/cart",
    });
  }

  return (
    <>
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" data-testid="mobile-bottom-nav-clearance" />
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl md:hidden"
        data-testid="mobile-bottom-navigation"
      >
        <div className={cn("mx-auto grid h-16 max-w-lg px-1", isLoggedIn ? "grid-cols-5" : "grid-cols-3")}>
          {destinations.map(({ label, href, icon: Icon, active }) => {
            const isActive = active(pathname);
            return (
              <Link
                key={label}
                href={href}
                prefetch={false}
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
