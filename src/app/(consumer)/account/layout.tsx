"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { AlertCircle, User, Package, Heart, MapPin, Settings, LogOut, ChevronRight, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { signOutAccount } from "@/services/account";
import { appendNextPath } from "@/services/auth-intent";
import { useAuthSession } from "@/hooks/use-auth-session";

type SidebarLink = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SIDEBAR_LINKS: SidebarLink[] = [
  { label: "Account Overview", href: "/account", icon: User },
  { label: "My Orders", href: "/account/orders", icon: Package },
  { label: "Saved Items", href: "/account/saved", icon: Heart },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Settings", href: "/account/settings", icon: Settings },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/account") {
    return pathname === "/account";
  }
  return pathname.startsWith(href);
}

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuthSession();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  React.useEffect(() => {
    if (auth.status === "guest" && !isSigningOut) {
      const loginPath = auth.reason === "expired" ? "/auth/login?reason=signin-again" : "/auth/login";
      router.replace(appendNextPath(loginPath, pathname));
    }
  }, [auth, isSigningOut, pathname, router]);

  const handleSignOut = React.useCallback(async () => {
    setIsSigningOut(true);
    await signOutAccount();
    router.replace("/auth/login");
  }, [router]);

  if (auth.status === "unavailable") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#f4fbf6] px-4" aria-live="polite">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-lg font-black text-zinc-950">Account could not load</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
            Zogular could not check your account right now. Try again, or sign in when the service is available.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={auth.retry} className="border-red-200 text-red-700 hover:bg-red-50">
              Retry
            </Button>
            <Button asChild className="bg-zinc-900 text-white hover:bg-zinc-800">
              <Link href={appendNextPath("/auth/login", pathname)}>Sign in</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (auth.status !== "authenticated" || isSigningOut) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#f4fbf6] px-4" aria-live="polite">
        <div className="flex items-center gap-3 text-sm font-semibold text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin text-[#009E49] motion-reduce:animate-none" aria-hidden="true" />
          {isSigningOut ? "Signing out…" : auth.status === "guest" ? "Opening sign in…" : "Checking your account…"}
        </div>
      </main>
    );
  }

  const user = {
    name: `${auth.user.firstName} ${auth.user.lastName ?? ""}`.trim() || auth.user.email,
    email: auth.user.email,
  };

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-6 md:pb-12">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-zinc-500">
          <Link href="/" className="hover:text-[#009E49]">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900">My Account</span>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">

          {/* MOBILE NAV (Horizontal Scroll) */}
          <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:hidden">
            {SIDEBAR_LINKS.map(({ label, href, icon: Icon }) => {
              const active = isActiveRoute(pathname, href);

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                    active
                      ? "bg-[#009E49] text-white shadow-md shadow-[#009E49]/20"
                      : "border border-zinc-200 bg-white text-zinc-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* DESKTOP SIDEBAR */}
          <aside className="hidden w-64 shrink-0 flex-col gap-1 md:flex">

            {/* USER CARD */}
            <div className="mb-4 rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <div className="mb-1 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#009E49]/10 text-xl font-black text-[#009E49]">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h2 className="truncate text-sm font-black text-zinc-900">
                      {user.name}
                    </h2>
                    <p className="truncate text-xs font-medium text-zinc-500">
                      {user.email}
                    </p>
                  </div>
              </div>
            </div>

            {/* NAV LINKS */}
            <nav className="flex flex-col gap-1 rounded-3xl border border-zinc-200/60 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              {SIDEBAR_LINKS.map(({ label, href, icon: Icon }) => {
                const active = isActiveRoute(pathname, href);

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                      active
                        ? "bg-[#009E49]/10 text-[#009E49]"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        active ? "text-[#009E49]" : "text-zinc-400"
                      }`}
                    />
                    {label}
                  </Link>
                );
              })}

              <Separator className="my-2 bg-zinc-100" />

              {/* SIGN OUT */}
              <Button
                type="button"
                variant="ghost"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="justify-start rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-600 transition-all hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : null}
                {isSigningOut ? "Signing Out..." : "Sign Out"}
              </Button>
            </nav>
          </aside>

          {/* PAGE CONTENT (Children render here) */}
          <div key={auth.user.id} className="flex-1 min-w-0">{children}</div>
          
        </div>
      </div>
    </main>
  );
}
