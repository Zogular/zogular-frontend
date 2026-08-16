"use client";

import * as React from "react";
import {
  getAuthSessionSnapshot,
  getStoredAuthUser,
  subscribeToAuthSession,
} from "@/services/auth-session";
import type { AuthUser } from "@/types/auth";

export type ClientAuthState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authenticated"; user: AuthUser };

export function useAuthSession(): ClientAuthState {
  const snapshot = React.useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    () => "",
  );
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  return React.useMemo(() => {
    if (!hasMounted) return { status: "loading", user: null };
    const user = snapshot ? getStoredAuthUser() : null;
    return user
      ? { status: "authenticated", user }
      : { status: "guest", user: null };
  }, [hasMounted, snapshot]);
}
