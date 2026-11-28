"use client";

import * as React from "react";
import type { ClientAuthState } from "@/hooks/use-auth-session";
import { ApiError, isCsrfError } from "@/services/api";
import { getAuthSessionSnapshot, subscribeToAuthSession } from "@/services/auth-session";
import { cancelBuyerOrder, getInvoiceById } from "@/services/orders";
import type { Invoice } from "@/types/order";

export type BuyerOrderCancelFeedback =
  | { kind: "confirmed"; message: string }
  | { kind: "csrf-expired"; message: string }
  | { kind: "stale-or-conflict"; message: string }
  | { kind: "uncertain"; message: string }
  | { kind: "auth-required"; message: string };

export function useBuyerOrderCancellation(orderId: string, auth: ClientAuthState) {
  const authSnapshot = React.useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    () => "",
  );
  const authenticatedUser = auth.status === "authenticated" ? auth.user : null;
  const scopeKey = `${orderId}:${auth.status}:${authenticatedUser?.id ?? ""}:${authSnapshot}`;

  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<unknown>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = React.useState(false);
  const [retransmissionLocked, setRetransmissionLocked] = React.useState(false);
  const [feedback, setFeedback] = React.useState<BuyerOrderCancelFeedback | null>(null);

  const scopeGenerationRef = React.useRef(0);
  const activeScopeKeyRef = React.useRef(scopeKey);
  const readAbortRef = React.useRef<AbortController | null>(null);
  const cancelInFlightRef = React.useRef(false);

  const loadInvoice = React.useCallback(async () => {
    if (!authenticatedUser) return;
    readAbortRef.current?.abort();
    const controller = new AbortController();
    readAbortRef.current = controller;
    const generation = scopeGenerationRef.current;

    setLoading(true);
    setLoadError(null);
    try {
      const data = await getInvoiceById(orderId, authenticatedUser, controller.signal);
      if (controller.signal.aborted || scopeGenerationRef.current !== generation) return;
      setInvoice(data);
    } catch (error) {
      if (controller.signal.aborted || scopeGenerationRef.current !== generation) return;
      setLoadError(error);
    } finally {
      if (!controller.signal.aborted && scopeGenerationRef.current === generation) {
        setLoading(false);
      }
      if (readAbortRef.current === controller) {
        readAbortRef.current = null;
      }
    }
  }, [authenticatedUser, orderId]);

  React.useEffect(() => {
    scopeGenerationRef.current += 1;
    activeScopeKeyRef.current = scopeKey;
    readAbortRef.current?.abort();
    readAbortRef.current = null;
    cancelInFlightRef.current = false;

    setDialogOpen(false);
    setIsSubmitting(false);
    setIsCheckingStatus(false);
    setRetransmissionLocked(false);
    setFeedback(null);
    setInvoice(null);
    setLoadError(null);

    if (!authenticatedUser) {
      setLoading(auth.status === "loading" || auth.status === "verifying");
      return;
    }

    void loadInvoice();

    return () => {
      scopeGenerationRef.current += 1;
      readAbortRef.current?.abort();
      readAbortRef.current = null;
      cancelInFlightRef.current = false;
    };
  }, [auth.status, authenticatedUser, loadInvoice, scopeKey]);

  const reconcileReadOnly = React.useCallback(
    async (
      generation: number,
      mode: "conflict" | "ambiguous" | "manual",
    ) => {
      if (!authenticatedUser) return;
      readAbortRef.current?.abort();
      const controller = new AbortController();
      readAbortRef.current = controller;
      setIsCheckingStatus(true);

      try {
        const refreshed = await getInvoiceById(orderId, authenticatedUser, controller.signal);
        if (controller.signal.aborted || scopeGenerationRef.current !== generation) return;

        setInvoice(refreshed);
        setDialogOpen(false);

        if (refreshed.rawStatus === "CANCELLED") {
          setRetransmissionLocked(false);
          setFeedback({
            kind: "confirmed",
            message:
              mode === "conflict"
                ? "This order is already cancelled."
                : "Order cancellation was confirmed.",
          });
          return;
        }

        if (refreshed.rawStatus === "REFUNDED") {
          setRetransmissionLocked(false);
          setFeedback({
            kind: "confirmed",
            message: "This order is marked as refunded.",
          });
          return;
        }

        if (mode === "conflict") {
          setRetransmissionLocked(false);
          setFeedback({
            kind: "stale-or-conflict",
            message: refreshed.canCancel
              ? "Your cancellation could not be completed because the order was updated at the same time. Select Cancel order to try again."
              : "This order changed and can no longer be cancelled online. Review the updated order status below.",
          });
          return;
        }

        setRetransmissionLocked(true);
        setFeedback({
          kind: "uncertain",
          message:
            "We could not confirm whether your cancellation completed. Select Check order status to verify before taking another action.",
        });
      } catch (reconcileError) {
        if (controller.signal.aborted || scopeGenerationRef.current !== generation) return;

        if (reconcileError instanceof ApiError && reconcileError.status === 401) {
          setDialogOpen(false);
          setInvoice(null);
          setRetransmissionLocked(true);
          setFeedback({
            kind: "auth-required",
            message: "Your session expired. Sign in again to check or manage this order.",
          });
          return;
        }

        if (reconcileError instanceof ApiError && (reconcileError.status === 403 || reconcileError.status === 404)) {
          setDialogOpen(false);
          setInvoice(null);
          setLoadError(reconcileError);
          return;
        }

        setDialogOpen(false);
        setRetransmissionLocked(true);
        setFeedback({
          kind: "uncertain",
          message:
            "We could not confirm the latest status of this order. Select Check order status to verify.",
        });
      } finally {
        if (!controller.signal.aborted && scopeGenerationRef.current === generation) {
          setIsCheckingStatus(false);
        }
        if (readAbortRef.current === controller) {
          readAbortRef.current = null;
        }
      }
    },
    [authenticatedUser, orderId],
  );

  const openDialog = React.useCallback(() => {
    if (!invoice?.canCancel || retransmissionLocked || isSubmitting) return;
    if (feedback?.kind === "csrf-expired") {
      setFeedback(null);
    }
    setDialogOpen(true);
  }, [feedback?.kind, invoice?.canCancel, isSubmitting, retransmissionLocked]);

  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isSubmitting && !nextOpen) return;
      if (!nextOpen && feedback?.kind === "csrf-expired") {
        setFeedback(null);
      }
      setDialogOpen(nextOpen);
    },
    [feedback?.kind, isSubmitting],
  );

  const confirmCancellation = React.useCallback(async () => {
    if (
      cancelInFlightRef.current
      || isSubmitting
      || retransmissionLocked
      || !authenticatedUser
      || !invoice
      || invoice.id !== orderId
      || !invoice.canCancel
    ) {
      return;
    }

    const generation = scopeGenerationRef.current;
    const expectedSnapshot = authSnapshot;
    const currentSnapshot = getAuthSessionSnapshot();
    if (currentSnapshot !== expectedSnapshot || activeScopeKeyRef.current !== scopeKey) {
      return;
    }

    cancelInFlightRef.current = true;
    setIsSubmitting(true);
    if (feedback?.kind === "csrf-expired") {
      setFeedback(null);
    }

    try {
      const updated = await cancelBuyerOrder(orderId, authenticatedUser);
      if (scopeGenerationRef.current !== generation) return;
      setInvoice(updated);
      setDialogOpen(false);
      setRetransmissionLocked(false);
      setFeedback({
        kind: "confirmed",
        message: "Your order has been cancelled.",
      });
    } catch (cancelError) {
      if (scopeGenerationRef.current !== generation) return;

      if (isCsrfError(cancelError)) {
        setFeedback({
          kind: "csrf-expired",
          message:
            "Your order was not cancelled because your verification expired. Select Confirm cancellation to try again.",
        });
        return;
      }

      if (cancelError instanceof ApiError && cancelError.status === 401) {
        setDialogOpen(false);
        setInvoice(null);
        setRetransmissionLocked(true);
        setFeedback({
          kind: "auth-required",
          message: "Your session expired. Sign in again to check or manage this order.",
        });
        return;
      }

      if (cancelError instanceof ApiError && (cancelError.status === 403 || cancelError.status === 404)) {
        setDialogOpen(false);
        setInvoice(null);
        setLoadError(cancelError);
        return;
      }

      if (cancelError instanceof ApiError && (cancelError.status === 400 || cancelError.status === 409)) {
        await reconcileReadOnly(generation, "conflict");
        return;
      }

      await reconcileReadOnly(generation, "ambiguous");
    } finally {
      if (scopeGenerationRef.current === generation) {
        cancelInFlightRef.current = false;
        setIsSubmitting(false);
      }
    }
  }, [
    authSnapshot,
    authenticatedUser,
    feedback?.kind,
    invoice,
    isSubmitting,
    orderId,
    reconcileReadOnly,
    retransmissionLocked,
    scopeKey,
  ]);

  const checkOrderStatus = React.useCallback(async () => {
    if (isCheckingStatus || isSubmitting) return;
    await reconcileReadOnly(scopeGenerationRef.current, "manual");
  }, [isCheckingStatus, isSubmitting, reconcileReadOnly]);

  return {
    invoice,
    loading,
    loadError,
    loadInvoice,
    dialogOpen,
    isSubmitting,
    isCheckingStatus,
    retransmissionLocked,
    feedback,
    canShowCancelAction: Boolean(invoice?.canCancel && !retransmissionLocked),
    openDialog,
    handleDialogOpenChange,
    confirmCancellation,
    checkOrderStatus,
  };
}
