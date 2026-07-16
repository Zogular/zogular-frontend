"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const INSTALL_DISMISSED_KEY = "zogular:pwa-install-dismissed-at";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function wasRecentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(INSTALL_DISMISSED_KEY));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

export function PwaRegistry() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const reloadForUpdateRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const inspectRegistration = (nextRegistration: ServiceWorkerRegistration) => {
      if (nextRegistration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(nextRegistration.waiting);
      }

      nextRegistration.addEventListener("updatefound", () => {
        const installingWorker = nextRegistration.installing;
        installingWorker?.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(installingWorker);
          }
        });
      });
    };

    const register = () => {
      navigator.serviceWorker.register("/sw.js").then(inspectRegistration).catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
    };
    const handleControllerChange = () => {
      if (reloadForUpdateRef.current) window.location.reload();
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandalone() && !wasRecentlyDismissed()) {
        setInstallPrompt(event as BeforeInstallPromptEvent);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", register, { once: true });
    } else {
      register();
    }
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !isStandalone() && !wasRecentlyDismissed()) {
      queueMicrotask(() => setShowIosGuide(true));
    }

    return () => {
      document.removeEventListener("DOMContentLoaded", register);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const dismissInstall = () => {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    setInstallPrompt(null);
    setShowIosGuide(false);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "dismissed") dismissInstall();
    setInstallPrompt(null);
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    reloadForUpdateRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  if (waitingWorker) {
    return (
      <PwaNotice title="Zogular update ready" description="Reload when you are ready to use the latest version." onDismiss={() => setWaitingWorker(null)}>
        <Button onClick={applyUpdate} size="sm" className="rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]"><RefreshCw className="mr-2 h-4 w-4" />Reload</Button>
      </PwaNotice>
    );
  }

  if (installPrompt) {
    return (
      <PwaNotice title="Install Zogular" description="Add the marketplace to this device for faster access." onDismiss={dismissInstall}>
        <Button onClick={install} size="sm" className="rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]"><Download className="mr-2 h-4 w-4" />Install</Button>
      </PwaNotice>
    );
  }

  if (showIosGuide) {
    return (
      <PwaNotice title="Add Zogular to your Home Screen" description="In Safari, tap Share, then choose Add to Home Screen." onDismiss={dismissInstall}>
        <Share className="h-5 w-5 text-[#009E49]" aria-hidden="true" />
      </PwaNotice>
    );
  }

  return null;
}

function PwaNotice({ title, description, onDismiss, children }: { title: string; description: string; onDismiss: () => void; children: React.ReactNode }) {
  return (
    <aside className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl" aria-live="polite">
      <div className="min-w-0 flex-1"><p className="text-sm font-black text-zinc-950">{title}</p><p className="mt-0.5 text-xs font-medium leading-5 text-zinc-600">{description}</p></div>
      {children}
      <button type="button" onClick={onDismiss} aria-label="Dismiss install message" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
    </aside>
  );
}
