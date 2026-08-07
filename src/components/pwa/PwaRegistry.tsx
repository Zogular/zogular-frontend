"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const INSTALL_DISMISSED_KEY = "zogular:pwa-install-dismissed-at";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const SERVICE_WORKER_URL = "/sw.js";

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration> | null = null;

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

function registerServiceWorker() {
  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { updateViaCache: "none" })
      .catch((error: unknown) => {
        serviceWorkerRegistrationPromise = null;
        throw error;
      });
  }

  return serviceWorkerRegistrationPromise;
}

export function PwaRegistry() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const updatePromiseRef = useRef<Promise<void> | null>(null);
  const dismissedWorkerRef = useRef<ServiceWorker | null>(null);
  const reloadRequestedRef = useRef(false);
  const reloadTriggeredRef = useRef(false);
  const skipWaitingRequestedRef = useRef(false);
  const updateFailureLoggedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let isActive = true;
    let updateFoundHandler: (() => void) | null = null;
    const workerStateHandlers = new Map<ServiceWorker, () => void>();

    const presentWaitingWorker = (worker: ServiceWorker | null) => {
      if (!isActive || !worker || !navigator.serviceWorker.controller || dismissedWorkerRef.current === worker) return;
      setWaitingWorker((currentWorker) => currentWorker === worker ? currentWorker : worker);
    };

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker || workerStateHandlers.has(worker)) return;

      const handleStateChange = () => {
        if (worker.state === "installed") presentWaitingWorker(worker);
      };

      workerStateHandlers.set(worker, handleStateChange);
      worker.addEventListener("statechange", handleStateChange);
      handleStateChange();
    };

    const checkForUpdate = () => {
      const registration = registrationRef.current;
      if (!registration || !navigator.onLine || updatePromiseRef.current) return updatePromiseRef.current;

      const updatePromise = registration
        .update()
        .then((updatedRegistration) => {
          if (!isActive) return;
          updateFailureLoggedRef.current = false;
          presentWaitingWorker(updatedRegistration.waiting);
          watchInstallingWorker(updatedRegistration.installing);
        })
        .catch((error: unknown) => {
          if (!navigator.onLine || updateFailureLoggedRef.current) return;
          updateFailureLoggedRef.current = true;
          console.warn("Service worker update check failed.", error);
        })
        .finally(() => {
          if (updatePromiseRef.current === updatePromise) updatePromiseRef.current = null;
        });

      updatePromiseRef.current = updatePromise;
      return updatePromise;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    const handleOnline = () => void checkForUpdate();
    const handleControllerChange = () => {
      if (!reloadRequestedRef.current || reloadTriggeredRef.current) return;
      reloadTriggeredRef.current = true;
      window.location.reload();
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandalone() && !wasRecentlyDismissed()) setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    const intervalId = window.setInterval(() => void checkForUpdate(), UPDATE_INTERVAL_MS);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !isStandalone() && !wasRecentlyDismissed()) queueMicrotask(() => isActive && setShowIosGuide(true));

    void registerServiceWorker()
      .then((registration) => {
        if (!isActive) return;
        registrationRef.current = registration;
        presentWaitingWorker(registration.waiting);
        watchInstallingWorker(registration.installing);
        updateFoundHandler = () => watchInstallingWorker(registration.installing);
        registration.addEventListener("updatefound", updateFoundHandler);
        void checkForUpdate();
      })
      .catch((error: unknown) => {
        if (isActive) console.error("Service worker registration failed.", error);
      });

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);

      const registration = registrationRef.current;
      if (registration && updateFoundHandler) registration.removeEventListener("updatefound", updateFoundHandler);
      workerStateHandlers.forEach((handler, worker) => worker.removeEventListener("statechange", handler));
      workerStateHandlers.clear();
      registrationRef.current = null;
    };
  }, []);

  const dismissInstall = () => {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    setInstallPrompt(null);
    setShowIosGuide(false);
  };

  const dismissUpdate = () => {
    dismissedWorkerRef.current = waitingWorker;
    setWaitingWorker(null);
  };

  const install = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "dismissed") dismissInstall();
      setInstallPrompt(null);
    } catch (error) {
      console.error("PWA install prompt failed.", error);
    }
  };

  const applyUpdate = () => {
    if (!waitingWorker || skipWaitingRequestedRef.current) return;
    skipWaitingRequestedRef.current = true;
    reloadRequestedRef.current = true;

    try {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      skipWaitingRequestedRef.current = false;
      reloadRequestedRef.current = false;
      console.error("Unable to activate the waiting service worker.", error);
    }
  };

  if (waitingWorker) {
    return (
      <PwaNotice title="Zogular update ready" description="Reload when you are ready to use the latest version." dismissLabel="Dismiss update notice" onDismiss={dismissUpdate}>
        <Button onClick={applyUpdate} size="sm" className="min-h-11 min-w-25 shrink-0 rounded-xl bg-[#009E49] px-3 font-bold text-white hover:bg-[#00853d]"><RefreshCw className="mr-2 h-4 w-4" /><span>Reload</span></Button>
      </PwaNotice>
    );
  }

  if (installPrompt) {
    return (
      <PwaNotice title="Install Zogular" description="Add the marketplace to this device for faster access." dismissLabel="Dismiss install message" onDismiss={dismissInstall}>
        <Button onClick={install} size="sm" className="min-h-11 rounded-xl bg-[#009E49] px-3 font-bold text-white hover:bg-[#00853d]"><Download className="mr-2 h-4 w-4" />Install</Button>
      </PwaNotice>
    );
  }

  if (showIosGuide) {
    return (
      <PwaNotice title="Add Zogular to your Home Screen" description="In Safari, tap Share, then choose Add to Home Screen." dismissLabel="Dismiss install message" onDismiss={dismissInstall}>
        <Share className="h-5 w-5 shrink-0 text-[#009E49]" aria-hidden="true" />
      </PwaNotice>
    );
  }

  return null;
}

function PwaNotice({ title, description, dismissLabel, onDismiss, children }: { title: string; description: string; dismissLabel: string; onDismiss: () => void; children: React.ReactNode }) {
  return (
    <aside className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl md:bottom-[calc(1rem+env(safe-area-inset-bottom))]" aria-live="polite">
      <div className="min-w-0 flex-1"><p className="text-sm font-black text-zinc-950">{title}</p><p className="mt-0.5 text-xs font-medium leading-5 text-zinc-600">{description}</p></div>
      <div className="flex shrink-0 items-center gap-1">
        {children}
        <button type="button" onClick={onDismiss} aria-label={dismissLabel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2"><X className="h-4 w-4" /></button>
      </div>
    </aside>
  );
}
