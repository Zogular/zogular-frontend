"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/services/api";
import { getCurrentUser } from "@/services/auth";
import type { AuthUser } from "@/types/auth";

type VerificationLoadState = "loading" | "ready" | "unauthenticated" | "unavailable";

export function useAccountVerification() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadState, setLoadState] = useState<VerificationLoadState>("loading");

  const refresh = useCallback(async () => {
    setLoadState("loading");

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setLoadState("ready");
      return currentUser;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setLoadState("unauthenticated");
        return null;
      }

      setLoadState("unavailable");
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;

        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          setLoadState("unauthenticated");
          return;
        }

        setLoadState("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  return useMemo(
    () => ({
      user,
      loadState,
      emailVerified: Boolean(user?.emailVerifiedAt) || user?.emailVerified === true,
      phoneVerified: Boolean(user?.phoneVerifiedAt),
      refresh,
    }),
    [loadState, refresh, user],
  );
}
