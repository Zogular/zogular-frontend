import { useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSellerSafeErrorMessage } from "@/lib/seller-error";
import { ApiError } from "@/services/api";
import { getAuthSessionSnapshot } from "@/services/auth-session";
import { sellerOrderQueryKeys } from "@/services/seller-orders";

export function orderErrorMessage(error: unknown, operation: "read" | "update") {
  if (error instanceof ApiError && [401, 403, 404, 408, 422, 429].includes(error.status)) {
    return getSellerSafeErrorMessage(error, "workspace");
  }
  return operation === "read" ? "Order information is unavailable right now. Try again."
    : "The update could not be confirmed. Refresh the order before trying again.";
}

/** Keep a rejected decision closed. Only an explicit, successful current read unlocks it. */
export function useOrderConflictRecovery(sellerId: string) {
  const client = useQueryClient();
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [phase, setPhase] = useState<"conflict" | "loading" | "failed" | null>(null);
  const capture = () => {
    const identity = getAuthSessionSnapshot();
    const sameSession = () => identity === getAuthSessionSnapshot();
    return { sameSession, visible: () => mounted.current && sameSession() };
  };
  const rejectConflict = (error: unknown, orderId: string, current: boolean) => {
    if (!(error instanceof ApiError) || error.status !== 409) return false;
    if (current) setPhase("conflict");
    // A late conflict still invalidates this seller's decisions after navigation, never another seller's.
    for (const key of [sellerOrderQueryKeys.lists(), sellerOrderQueryKeys.detail(orderId)]) {
      const filters = { queryKey: key, predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey.at(-1) === sellerId };
      void client.cancelQueries(filters);
      void client.invalidateQueries({ ...filters, refetchType: "none" });
    }
    return true;
  };
  const refresh = async (read: () => Promise<{ isSuccess: boolean; fetchStatus: string }>) => {
    if (phase === "loading") return;
    const current = capture();
    setPhase("loading");
    try {
      const result = await read();
      if (current.visible()) setPhase(result.isSuccess && result.fetchStatus === "idle" ? null : "failed");
    } catch {
      if (current.visible()) setPhase("failed");
    }
  };
  return {
    capture, rejectConflict,
    notice: phase && {
      title: phase === "failed" ? "Order refresh failed" : "Order changed",
      description: phase === "failed" ? "The latest order information could not be loaded. Refresh before making another change."
        : phase === "loading" ? "Loading the latest order information." : "Refresh to see the current status before making another change.",
      action: (read: Parameters<typeof refresh>[0]) => phase === "loading" ? undefined : { label: "Refresh order", onClick: () => void refresh(read) },
    },
  };
}
