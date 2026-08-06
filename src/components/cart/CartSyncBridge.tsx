"use client";

import * as React from "react";
import { useCart } from "@/hooks/use-cart";
import {
  AUTH_SESSION_CHANGED_EVENT,
  getAuthSessionSnapshot,
} from "@/services/auth-session";

function subscribeToAuthSession(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith("zogular_") || event.key.startsWith("zamoyo_")) {
      onStoreChange();
    }
  };

  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", onStoreChange);

  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", onStoreChange);
  };
}

export function CartSyncBridge() {
  const authSnapshot = React.useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    () => "",
  );
  const hasHydrated = useCart((state) => state.hasHydrated);
  const syncWithBackend = useCart((state) => state.syncWithBackend);

  React.useEffect(() => {
    if (!hasHydrated) return;
    void syncWithBackend();
  }, [authSnapshot, hasHydrated, syncWithBackend]);

  return null;
}
