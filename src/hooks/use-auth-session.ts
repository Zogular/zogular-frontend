"use client";

import * as React from "react";
import { ApiError } from "@/services/api";
import { getCurrentUser, isLocalLogoutPending } from "@/services/auth";
import {
  getAuthSessionSnapshot,
  storeAuthSession,
  subscribeToAuthSession,
} from "@/services/auth-session";
import type { AuthUser } from "@/types/auth";

export type ClientAuthState =
  | { status: "loading"; user: null }
  | { status: "verifying"; user: null; hadStoredSession: boolean }
  | { status: "guest"; user: null; reason: "fresh" | "expired" }
  | { status: "unavailable"; user: null; hadStoredSession: boolean; retry: () => void }
  | { status: "authenticated"; user: AuthUser };

type ResolvedAuthState =
  | Extract<ClientAuthState, { status: "guest" | "authenticated" }>
  | { status: "unavailable"; user: null; hadStoredSession: boolean };

type VerificationResult =
  | { kind: "resolved"; snapshot: string; state: ResolvedAuthState }
  | { kind: "stale" };

let cachedVerification: { snapshot: string; result: ResolvedAuthState } | null = null;
let pendingVerification: { snapshot: string; promise: Promise<VerificationResult> } | null = null;
const AUTH_GATE_TIMEOUT_MS = 6_000;

function verifySnapshot(snapshot: string): Promise<VerificationResult> {
  if (!snapshot && isLocalLogoutPending()) {
    const state: ResolvedAuthState = { status: "guest", user: null, reason: "fresh" };
    cachedVerification = { snapshot, result: state };
    return Promise.resolve({ kind: "resolved", snapshot, state });
  }
  if (cachedVerification?.snapshot === snapshot) {
    return Promise.resolve({ kind: "resolved", snapshot, state: cachedVerification.result });
  }
  if (pendingVerification?.snapshot === snapshot) return pendingVerification.promise;
  if (!snapshot && pendingVerification?.snapshot) {
    return pendingVerification.promise.then((result) => {
      if (result.kind === "resolved" && result.snapshot === snapshot) return result;
      return verifySnapshot(snapshot);
    });
  }

  const hadStoredSession = snapshot.length > 0;
  // The HttpOnly refresh cookie is authoritative. The local snapshot is only
  // used to distinguish first-time guests from previously known identities.
  const promise = getCurrentUser({ persist: false, timeout: AUTH_GATE_TIMEOUT_MS })
    .then((user): VerificationResult => {
      if (getAuthSessionSnapshot() !== snapshot) return { kind: "stale" };
      storeAuthSession({ user });
      const verifiedSnapshot = getAuthSessionSnapshot();
      const state: ResolvedAuthState = { status: "authenticated", user };
      cachedVerification = { snapshot: verifiedSnapshot, result: state };
      return { kind: "resolved", snapshot: verifiedSnapshot, state };
    })
    .catch((error: unknown): VerificationResult => {
      const currentSnapshot = getAuthSessionSnapshot();
      if (error instanceof ApiError && error.status === 401) {
        if (currentSnapshot !== snapshot && currentSnapshot !== "") return { kind: "stale" };
        const state: ResolvedAuthState = {
          status: "guest",
          user: null,
          reason: hadStoredSession ? "expired" : "fresh",
        };
        cachedVerification = { snapshot: currentSnapshot, result: state };
        return { kind: "resolved", snapshot: currentSnapshot, state };
      }
      if (currentSnapshot !== snapshot) return { kind: "stale" };
      const state: ResolvedAuthState = { status: "unavailable", user: null, hadStoredSession };
      cachedVerification = { snapshot, result: state };
      return { kind: "resolved", snapshot, state };
    })
    .finally(() => {
      if (pendingVerification?.promise === promise) pendingVerification = null;
    });

  pendingVerification = { snapshot, promise };
  return promise;
}

export function useAuthSession(): ClientAuthState {
  const snapshot = React.useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    () => "",
  );
  const [hasMounted, setHasMounted] = React.useState(false);
  const [retryVersion, setRetryVersion] = React.useState(0);
  const [resolution, setResolution] = React.useState<{
    snapshot: string | null;
    state: ResolvedAuthState | null;
  }>({ snapshot: null, state: null });

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  React.useEffect(() => {
    if (!hasMounted) return;
    let active = true;
    void verifySnapshot(snapshot).then((result) => {
      if (!active || result.kind === "stale") return;
      setResolution({ snapshot: result.snapshot, state: result.state });
    });
    return () => {
      active = false;
    };
  }, [hasMounted, retryVersion, snapshot]);

  const retry = React.useCallback(() => {
    if (cachedVerification?.snapshot === snapshot) cachedVerification = null;
    setResolution({ snapshot: null, state: null });
    setRetryVersion((version) => version + 1);
  }, [snapshot]);

  if (!hasMounted) return { status: "loading", user: null };
  if (resolution.snapshot !== snapshot || !resolution.state) {
    return { status: "verifying", user: null, hadStoredSession: snapshot.length > 0 };
  }
  if (resolution.state.status === "unavailable") return { ...resolution.state, retry };
  return resolution.state;
}
