"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AdminCommandMenu,
  AdminHeader,
  AdminSidebar,
  buildAdminShellNavigation,
  parseAdminSidebarMode,
  resolveAdminShellRouteContext,
  serializeAdminSidebarMode,
  type AdminSidebarMode,
} from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import type { AdminIdentity } from "@/services/admin/session";
import theme from "@/components/admin/admin-theme.module.css";

export const AdminIdentityContext = createContext<AdminIdentity | null>(null);

export function useAdminIdentity() {
  return useContext(AdminIdentityContext);
}

const ADMIN_DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

export default function AdminShell({
  children,
  identity,
  initialSidebarMode = "expanded",
}: {
  children: React.ReactNode;
  identity: AdminIdentity;
  initialSidebarMode?: AdminSidebarMode;
}) {
  const pathname = usePathname();
  const [sidebarMode, setSidebarMode] = useState(() =>
    parseAdminSidebarMode(initialSidebarMode),
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const navigationGroups = useMemo(
    () => buildAdminShellNavigation(identity),
    [identity],
  );
  const routeContext = useMemo(
    () => resolveAdminShellRouteContext(navigationGroups, pathname),
    [navigationGroups, pathname],
  );

  useEffect(() => {
    const desktopViewport = window.matchMedia(ADMIN_DESKTOP_MEDIA_QUERY);
    const closeMobileMenuAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileMenuOpen(false);
    };

    desktopViewport.addEventListener("change", closeMobileMenuAtDesktop);
    return () => desktopViewport.removeEventListener("change", closeMobileMenuAtDesktop);
  }, []);

  const toggleSidebar = () => {
    setSidebarMode((currentMode) => {
      const nextMode: AdminSidebarMode = currentMode === "expanded" ? "collapsed" : "expanded";
      document.cookie = serializeAdminSidebarMode(nextMode);
      return nextMode;
    });
  };

  return (
    <AdminIdentityContext.Provider value={identity}>
      <TooltipProvider>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <div
            className={cn(
              theme.adminScope,
              theme.shellRoot,
              "h-dvh min-w-0 overflow-hidden bg-[var(--admin-canvas-warm)]",
            )}
            data-sidebar-mode={sidebarMode}
            data-testid="admin-shell-root"
          >
            <aside
              id="admin-desktop-sidebar"
              className={theme.desktopSidebar}
              data-testid="admin-desktop-sidebar"
            >
              <AdminSidebar
                groups={navigationGroups}
                pathname={pathname}
                mode={sidebarMode}
                onModeChange={toggleSidebar}
              />
            </aside>

            <SheetContent
              id="admin-mobile-navigation"
              side="left"
              showCloseButton={false}
              className={cn(
                theme.adminScope,
                theme.mobileDrawer,
                "gap-0 border-r border-[color:rgba(184,135,70,0.3)] bg-[var(--admin-canopy-deep)] p-0 motion-reduce:transition-none",
              )}
              style={{ width: "min(19rem, calc(100vw - 1rem))", maxWidth: "none" }}
              data-testid="admin-mobile-drawer"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Admin navigation</SheetTitle>
                <SheetDescription>Open an admin workspace page.</SheetDescription>
              </SheetHeader>
              <AdminSidebar
                groups={navigationGroups}
                pathname={pathname}
                mode="expanded"
                onNavigate={() => setIsMobileMenuOpen(false)}
                mobile
              />
            </SheetContent>

            <main className="flex h-dvh min-w-0 flex-col overflow-hidden">
              <AdminHeader
                identity={identity}
                routeContext={routeContext}
                mobileMenuOpen={isMobileMenuOpen}
                onCommandOpen={() => setIsCommandOpen(true)}
              />
              <div
                className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[var(--admin-canvas-warm)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
                data-testid="admin-main-scroll"
              >
                {children}
              </div>
            </main>
          </div>
        </Sheet>

        <AdminCommandMenu
          groups={navigationGroups}
          open={isCommandOpen}
          onOpenChange={setIsCommandOpen}
        />
      </TooltipProvider>
    </AdminIdentityContext.Provider>
  );
}
