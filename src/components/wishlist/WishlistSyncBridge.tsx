"use client";

import * as React from "react";
import { useAuthSession } from "@/hooks/use-auth-session";
import { removePersistedWishlistData, useWishlist } from "@/hooks/use-wishlist";
import { getStoredAuthUser, subscribeToAuthSession } from "@/services/auth-session";

export function WishlistSyncBridge() {
  const auth = useAuthSession();
  const reconcileIdentity = useWishlist((state) => state.reconcileIdentity);
  const syncBackend = useWishlist((state) => state.syncBackend);

  React.useEffect(() => subscribeToAuthSession(() => {
    removePersistedWishlistData();
    reconcileIdentity(getStoredAuthUser()?.id ?? null);
  }), [reconcileIdentity]);

  React.useEffect(() => {
    removePersistedWishlistData();
    const ownerId = auth.status === "authenticated" ? auth.user.id : null;
    reconcileIdentity(ownerId);
    if (ownerId) void syncBackend();
  }, [auth, reconcileIdentity, syncBackend]);

  return null;
}
