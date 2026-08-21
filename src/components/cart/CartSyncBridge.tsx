"use client";

import * as React from "react";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCart } from "@/hooks/use-cart";

export function CartSyncBridge() {
  const auth = useAuthSession();
  const hasHydrated = useCart((state) => state.hasHydrated);
  const suspendIdentity = useCart((state) => state.suspendIdentity);
  const reconcileIdentity = useCart((state) => state.reconcileIdentity);
  const syncWithBackend = useCart((state) => state.syncWithBackend);
  const ownerId = auth.status === "authenticated" ? auth.user.id : null;

  React.useLayoutEffect(() => {
    if (auth.status === "authenticated" && ownerId) {
      reconcileIdentity(ownerId);
      return;
    }
    if (auth.status === "guest") {
      reconcileIdentity(null);
      return;
    }
    suspendIdentity();
  }, [auth.status, ownerId, reconcileIdentity, suspendIdentity]);

  React.useEffect(() => {
    if (!hasHydrated || auth.status !== "authenticated") return;
    void syncWithBackend();
  }, [auth.status, hasHydrated, ownerId, syncWithBackend]);

  return null;
}
