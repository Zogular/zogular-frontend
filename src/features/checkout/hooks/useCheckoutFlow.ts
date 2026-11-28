"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ClientAuthState } from "@/hooks/use-auth-session";
import { beginGeneration, CART_REVIEW_PENDING, checkoutMode, settleGeneration, rejectGenerationAttempt, heldGeneration, observeGeneration,
  preserveLegacySending, reviewChangedGeneration, subscribeCheckoutHold, useCart } from "@/hooks/use-cart";
import { appendNextPath } from "@/services/auth-intent";
import { getSavedAddresses } from "@/services/account";
import {
  CheckoutContractError,
  CheckoutOrderOutcomeUnknownError,
  CheckoutQuoteChangedError,
  prepareCheckoutOrder,
  readCheckoutCart,
  readCheckoutReceipt,
  inspectCheckoutOutcome,
  quoteCheckoutOrder,
  type CheckoutQuote,
} from "@/services/checkout";
import type { Address } from "@/types/address";
import {
  buildCartRequestKey,
  getCheckoutErrorMessage,
  isValidCheckoutAddress,
  type QuoteRecovery,
} from "@/features/checkout/lib/checkout-presentation";
import type { CheckoutStage } from "@/features/checkout/types/checkout.types";
import { ApiError } from "@/services/api";
import { getAuthSessionSnapshot } from "@/services/auth-session";

function conflictCode(error: unknown) {
  return error instanceof ApiError && error.status === 409 && error.details && typeof error.details === "object" && "code" in error.details
    ? error.details.code : undefined;
}

export function useCheckoutFlow(auth: ClientAuthState) {
  const router = useRouter();
  const cart = useCart();
  const {
    hasHydrated,
    identityResolved,
    items,
    itemCount,
    checkoutOutcomeOwnerId,
    clearConfirmedCart,
    markCheckoutOutcomeUnknown,
    resumeCheckoutAfterReview,
    syncWithBackend,
  } = cart;
  const ownerId = auth.status === "authenticated" ? auth.user.id : null;
  const held = React.useSyncExternalStore(subscribeCheckoutHold, () => heldGeneration(ownerId), () => null);
  const exactRetry = React.useRef<{ generation: string; send: ReturnType<typeof prepareCheckoutOrder> } | null>(null);
  const [changedCart, setChangedCart] = React.useState<{ old: string; next: string } | null>(null);
  const identityRef = React.useRef({ ownerId, epoch: 0, active: true });
  const submitInFlightRef = React.useRef(false);
  const addressRequestRef = React.useRef(0);
  const [savedAddresses, setSavedAddresses] = React.useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = React.useState(false);
  const [addressLoadError, setAddressLoadError] = React.useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [checkingReceipt, setCheckingReceipt] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  // A receipt binds an order to the buyer/cart, not to this tab's address or notes.
  // Keep conflict provenance in memory only; a reopened tab cannot reconstruct it.
  const [existing, setExisting] = React.useState<{
    owner: string; generation: string; epoch: number; session: string; conflict: boolean; orderId?: string;
  } | null>(null);
  React.useEffect(() => {
    if (!ownerId || !held || held === "unavailable") return;
    try {
      preserveLegacySending(ownerId, held);
    } catch {
      setSubmitError("Keep this tab open while you check your order status.");
    }
  }, [ownerId, held]);
  const [checkoutStage, setCheckoutStage] = React.useState<CheckoutStage>("details");
  const [orderQuote, setOrderQuote] = React.useState<CheckoutQuote | null>(null);
  const [quotedCartKey, setQuotedCartKey] = React.useState<string | null>(null);
  const [quotedAddress, setQuotedAddress] = React.useState<Address | null>(null);
  const [quoteRefreshVersion, refreshQuote] = React.useReducer((value: number) => value + 1, 0);
  const [isLoadingQuote, setIsLoadingQuote] = React.useState(false);
  type QuoteFailure = QuoteRecovery & { current: () => boolean };
  const [quoteError, setQuoteError] = React.useState<QuoteFailure | null>(null);
  const reviewRequest = React.useRef<QuoteFailure | null>(null);
  const [reviewing, setReviewing] = React.useState<QuoteFailure | null>(null);

  if (identityRef.current.ownerId !== ownerId) {
    identityRef.current.ownerId = ownerId;
    identityRef.current.epoch += 1;
  }

  const currentCartKey = React.useMemo(() => buildCartRequestKey(items), [items]);
  const selectedAddress = React.useMemo(
    () => savedAddresses.find((address) => address.id === selectedAddressId),
    [savedAddresses, selectedAddressId],
  );
  const currentAddressRef = React.useRef(selectedAddress);
  React.useLayoutEffect(() => {
    currentAddressRef.current = selectedAddress;
  }, [selectedAddress]);
  const isCurrentIdentity = React.useCallback((expectedOwnerId: string, epoch: number) => (
    identityRef.current.active
    && identityRef.current.ownerId === expectedOwnerId
    && identityRef.current.epoch === epoch
    && useCart.getState().ownerId === expectedOwnerId
    && useCart.getState().identityResolved
  ), []);

  React.useLayoutEffect(() => {
    const identity = identityRef.current;
    identity.active = true;
    return () => {
      identity.active = false;
      identity.epoch += 1;
      submitInFlightRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (auth.status !== "guest") return;
    const loginPath = auth.reason === "expired" ? "/auth/login?reason=signin-again" : "/auth/login";
    router.replace(appendNextPath(loginPath, "/checkout"));
  }, [auth, router]);

  const loadAddresses = React.useCallback(async (expectedOwnerId: string, epoch: number) => {
    const request = ++addressRequestRef.current;
    const isCurrentRequest = () =>
      addressRequestRef.current === request && isCurrentIdentity(expectedOwnerId, epoch);
    setIsLoadingAddresses(true);
    setAddressLoadError(null);
    try {
      const addresses = await getSavedAddresses();
      if (!isCurrentRequest()) return;
      if (!Array.isArray(addresses) || !addresses.every(isValidCheckoutAddress)) {
        throw new CheckoutContractError("Delivery address response is malformed.");
      }
      setSavedAddresses(addresses);
      const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
      setSelectedAddressId(defaultAddress?.id ?? null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      setSavedAddresses([]);
      setSelectedAddressId(null);
      setAddressLoadError(getCheckoutErrorMessage(error, "address"));
      setCheckoutStage("details");
    } finally {
      if (isCurrentRequest()) setIsLoadingAddresses(false);
    }
  }, [isCurrentIdentity]);

  const retryAddresses = React.useCallback(() => {
    if (!ownerId) return;
    void loadAddresses(ownerId, identityRef.current.epoch);
  }, [loadAddresses, ownerId]);

  React.useEffect(() => {
    if (!hasHydrated || !identityResolved || auth.status !== "authenticated") return;
    void loadAddresses(auth.user.id, identityRef.current.epoch);
  }, [auth, hasHydrated, identityResolved, loadAddresses]);

  React.useEffect(() => {
    if (
      !hasHydrated
      || !identityResolved
      || items.length === 0
      || !selectedAddress
      || auth.status !== "authenticated"
      || checkoutOutcomeOwnerId === auth.user.id
      || held
    ) {
      setOrderQuote(null);
      setQuotedCartKey(null);
      setQuotedAddress(null);
      setIsLoadingQuote(false);
      setQuoteError(null);
      return;
    }

    const expectedOwnerId = auth.user.id;
    const epoch = identityRef.current.epoch;
    const requestCartKey = currentCartKey;
    const session = getAuthSessionSnapshot();
    let active = true;
    const current = () => active && isCurrentIdentity(expectedOwnerId, epoch)
      && getAuthSessionSnapshot() === session && !heldGeneration(expectedOwnerId)
      && useCart.getState().checkoutOutcomeOwnerId !== expectedOwnerId;
    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      setQuoteError(null);
      setOrderQuote(null);
      setQuotedCartKey(null);
      setQuotedAddress(null);
      try {
        const quote = await quoteCheckoutOrder({
          items,
          contact: {
            firstName: selectedAddress.name,
            lastName: "",
            email: auth.user.email,
            phone: selectedAddress.phone,
          },
          delivery: {
            street: selectedAddress.street,
            area: selectedAddress.area,
            instructions: selectedAddress.deliveryInstructions ?? undefined,
          },
          paymentMethod: "cash_on_delivery",
        }, checkoutMode(expectedOwnerId));
        if (current()) {
          observeGeneration(expectedOwnerId, quote.cartGeneration);
          setOrderQuote(quote);
          setQuotedCartKey(requestCartKey);
          setQuotedAddress(selectedAddress);
        }
      } catch (error) {
        if (current()) {
          setOrderQuote(null);
          setQuotedCartKey(null);
          setQuoteError({ message: getCheckoutErrorMessage(error, "quote"), current,
            action: conflictCode(error) === "CHECKOUT_CART_CHANGED" ? "review-cart" : "refresh-total" });
        }
      } finally {
        if (active && isCurrentIdentity(expectedOwnerId, epoch)) setIsLoadingQuote(false);
      }
    };
    void fetchQuote();
    return () => {
      active = false;
    };
  }, [
    auth,
    checkoutOutcomeOwnerId,
    held,
    currentCartKey,
    hasHydrated,
    identityResolved,
    isCurrentIdentity,
    items,
    quoteRefreshVersion,
    selectedAddress,
  ]);

  const retryQuote = async () => {
    if (!ownerId || !quoteError?.current() || reviewRequest.current === quoteError) return;
    if (quoteError.action === "refresh-total") { refreshQuote(); return; }

    // Capture the idle store before the GET. Never reconcile (which can write)
    // or replace newer local work merely because the buyer requested a review.
    const fail = (message: string) => setQuoteError(previous =>
      previous === quoteError ? { ...previous, message } : previous);
    const adopt = useCart.getState().prepareCartAdoption(ownerId);
    if (!adopt) { fail(CART_REVIEW_PENDING); return; }
    reviewRequest.current = quoteError;
    setReviewing(quoteError);
    try {
      const snapshot = await readCheckoutCart("required");
      if (!quoteError.current()) return;
      if (!adopt(snapshot.items)) { fail(CART_REVIEW_PENDING); return; }
      if (!quoteError.current()) return;
      observeGeneration(ownerId, snapshot.generation);
      router.push("/cart");
    } catch {
      if (quoteError.current()) fail("Your cart could not be refreshed. Try reviewing it again.");
    } finally {
      if (reviewRequest.current === quoteError) {
        reviewRequest.current = null;
        setReviewing(null);
      }
    }
  };

  const hasUnknownOutcome = Boolean(held) || (ownerId !== null && checkoutOutcomeOwnerId === ownerId);
  const detailsComplete = selectedAddressId !== null;
  const canSubmit = hasHydrated
    && identityResolved
    && auth.status === "authenticated"
    && items.length > 0
    && detailsComplete
    && !submitting
    && !hasUnknownOutcome
    && !isLoadingAddresses
    && !addressLoadError
    && !isLoadingQuote
    && Boolean(orderQuote)
    && quotedCartKey === currentCartKey
    && quotedAddress === selectedAddress
    && !quoteError;

  const showVerifiedOrder = (owner: string, generation: string, orderId: string) => {
    // A storage failure can block cart reuse, but cannot undo a verified order.
    const settled = settleGeneration(owner, generation);
    exactRetry.current = null;
    router.push(`/success?orderId=${encodeURIComponent(orderId)}`);
    if (settled) void useCart.getState().refreshCartAfterReceipt(owner);
  };

  const scopedExisting = existing && existing.owner === ownerId && existing.epoch === identityRef.current.epoch
    && existing.session === getAuthSessionSnapshot() && (!held || existing.generation === held || held === "unavailable")
    ? existing : null;
  const viewExistingOrder = () => {
    if (!scopedExisting?.orderId) return;
    const { owner, generation, orderId, session, epoch } = scopedExisting;
    const currentHold = heldGeneration(owner);
    if (!isCurrentIdentity(owner, epoch) || getAuthSessionSnapshot() !== session ||
        (currentHold && currentHold !== generation && currentHold !== "unavailable")) return;
    // Until this deliberate action, closing the tab must preserve receipt recovery.
    if (currentHold) settleGeneration(owner, generation);
    router.push(`/account/orders/${encodeURIComponent(orderId)}`);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    setSubmitError(null);
    if (auth.status !== "authenticated") {
      router.replace(appendNextPath("/auth/login", "/checkout"));
      return;
    }
    const expectedOwnerId = auth.user.id;
    const epoch = identityRef.current.epoch;
    if (hasUnknownOutcome) {
      setSubmitError("Check your orders before trying checkout again.");
      return;
    }
    if (!canSubmit || !orderQuote) {
      setCheckoutStage("details");
      setSubmitError("Please select a delivery address before placing the order.");
      return;
    }
    const selected = savedAddresses.find((address) => address.id === selectedAddressId);
    if (!selected) {
      setSubmitError("Please select a delivery address.");
      setCheckoutStage("details");
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    const key = orderQuote.cartGeneration;
    const session = getAuthSessionSnapshot();
    const current = () => isCurrentIdentity(expectedOwnerId, epoch) && session === getAuthSessionSnapshot();
    let dispatched = false;
    let attempt: string | undefined;
    try {
      if (!key) await syncWithBackend();
      if (!current()) return;
      const currentCart = useCart.getState();
      if (currentCart.ownerId !== expectedOwnerId || currentCart.checkoutOutcomeOwnerId === expectedOwnerId || heldGeneration(expectedOwnerId)) return;
      if (!key && currentCart.syncStatus === "error") {
        setSubmitError(currentCart.syncError ?? "Your cart could not be refreshed. Try again.");
        return;
      }
      const adopt = key ? currentCart.prepareCartAdoption(expectedOwnerId) : null;
      if (key && !adopt) { setSubmitError(CART_REVIEW_PENDING); return; }
      const snapshot = key ? await readCheckoutCart("required") : null;
      if (!current() || heldGeneration(expectedOwnerId)) return;
      if ((snapshot && snapshot.generation !== key) || (!key && checkoutMode(expectedOwnerId) === "required")) {
        const preserved = snapshot && !adopt?.(snapshot.items);
        refreshQuote();
        setSubmitError(preserved ? CART_REVIEW_PENDING : "Your cart changed. Review the latest totals before placing your order.");
        return;
      }
      if (key && useCart.getState() !== currentCart) { setSubmitError(CART_REVIEW_PENDING); return; }
      const confirmedItems = snapshot?.items ?? currentCart.items;
      if (
        buildCartRequestKey(confirmedItems) !== currentCartKey
        || buildCartRequestKey(useCart.getState().items) !== currentCartKey
        || currentAddressRef.current !== selected
      ) {
        setSubmitError("Your checkout details changed. Review the updated totals before placing your order.");
        return;
      }
      const send = prepareCheckoutOrder({
        items: confirmedItems,
        contact: {
          firstName: selected.name.trim(),
          lastName: "",
          email: auth.user.email.trim(),
          phone: selected.phone.trim(),
        },
        delivery: {
          street: selected.street.trim(),
          area: selected.area.trim(),
          instructions: selected.deliveryInstructions?.trim(),
        },
        paymentMethod: "cash_on_delivery",
      }, orderQuote, expectedOwnerId, checkoutMode(expectedOwnerId));
      if (key) {
        try {
          attempt = beginGeneration(expectedOwnerId, key);
        } catch {
          setSubmitError("This tab did not send an order. Check your checkout status before trying again.");
          return;
        }
        exactRetry.current = { generation: key, send };
      }
      dispatched = true;
      const order = await send();
      if (!current()) return;
      if (key) {
        const hold = heldGeneration(expectedOwnerId);
        if (hold !== key && hold !== "unavailable") return;
        showVerifiedOrder(expectedOwnerId, key, order.id);
      } else {
        clearConfirmedCart(expectedOwnerId);
        router.push(`/success?orderId=${encodeURIComponent(order.id)}`);
      }
    } catch (error) {
      if (!current()) return;
      const code = conflictCode(error);
      if (key && dispatched) {
        if (code === "CHECKOUT_INTENT_CONFLICT") {
          setExisting({ owner: expectedOwnerId, generation: key, epoch, session, conflict: true });
        }
        const unknown = error instanceof CheckoutOrderOutcomeUnknownError || code === "CHECKOUT_INTENT_CONFLICT" || code === "CHECKOUT_CART_CHANGED" || !(error instanceof ApiError || error instanceof CheckoutQuoteChangedError);
        if (!unknown && attempt) {
          try {
            rejectGenerationAttempt(expectedOwnerId, key, attempt);
          } catch {
            exactRetry.current = null;
            setSubmitError("Check your order status before trying again.");
            return;
          }
        }
        if (!(error instanceof CheckoutOrderOutcomeUnknownError)) exactRetry.current = null;
      }
      if (error instanceof CheckoutQuoteChangedError || code === "CHECKOUT_RELOAD_REQUIRED") {
        setSubmitError(error instanceof CheckoutQuoteChangedError ? error.message : "Refresh checkout and review the latest totals.");
        setOrderQuote(null);
        setQuotedCartKey(null);
        setQuotedAddress(null);
        refreshQuote();
      } else if (error instanceof CheckoutOrderOutcomeUnknownError) {
        if (!key) markCheckoutOutcomeUnknown(expectedOwnerId);
        setSubmitError("Order outcome not confirmed. Check your orders before trying again.");
      } else {
        setSubmitError(getCheckoutErrorMessage(error, "create"));
      }
    } finally {
      if (isCurrentIdentity(expectedOwnerId, epoch)) setSubmitting(false);
      submitInFlightRef.current = false;
    }
  };

  // GET cart is deliberately separate from syncWithBackend: reconciliation
  // may send mutations and must never be triggered as a consequence of a 404.
  const recover = async (action: "check" | "review" | "retry") => {
    if (scopedExisting?.conflict && ownerId) {
      if (action !== "check" || submitInFlightRef.current) return;
      const { generation, epoch, session } = scopedExisting;
      const current = () => {
        const hold = heldGeneration(ownerId);
        return isCurrentIdentity(ownerId, epoch) && getAuthSessionSnapshot() === session && (!hold || hold === generation);
      };
      if (!current()) return;
      submitInFlightRef.current = true;
      setCheckingReceipt(true);
      setSubmitting(true);
      setSubmitError(null);
      try {
        // The server rejected this intent. Even a receipt miss cannot make it retryable.
        const receipt = await readCheckoutReceipt(ownerId, generation);
        if (!current()) return;
        if (receipt) setExisting({ ...scopedExisting, orderId: receipt.id });
        else setSubmitError("No receipt is available yet. Check again or contact support.");
      } catch {
        if (current()) setSubmitError("The existing order could not be loaded. Check again or contact support.");
      } finally {
        if (isCurrentIdentity(ownerId, epoch)) { setSubmitting(false); setCheckingReceipt(false); }
        submitInFlightRef.current = false;
      }
      return;
    }
    if (!ownerId || !held || held === "unavailable" || heldGeneration(ownerId) !== held || submitInFlightRef.current) return;
    const epoch = identityRef.current.epoch;
    const session = getAuthSessionSnapshot();
    const current = (verifiedRead = false) => {
      const hold = heldGeneration(ownerId);
      return isCurrentIdentity(ownerId, epoch) && session === getAuthSessionSnapshot()
        && (hold === held || (verifiedRead && hold === "unavailable"));
    };
    submitInFlightRef.current = true;
    setCheckingReceipt(true);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const adopt = action === "review" ? useCart.getState().prepareCartAdoption(ownerId, held) : null;
      const result = await inspectCheckoutOutcome(ownerId, held, () => current(true));
      if (!result || !current(true)) return;
      const { snapshot, receipt } = result;
      if (receipt) {
        exactRetry.current = null;
        setChangedCart(null);
        setExisting({ owner: ownerId, generation: held, epoch, session, orderId: receipt.id,
          conflict: false });
        return;
      }
      if (!current()) return; // Unreadable storage never authorizes review or another POST.
      if (snapshot?.generation && snapshot.generation !== held) {
        if (action === "review" && changedCart?.old === held && changedCart.next === snapshot.generation) {
          if (reviewChangedGeneration(ownerId, held, snapshot.generation)) {
            const adopted = adopt?.(snapshot.items);
            if (!adopted) setSubmitError(CART_REVIEW_PENDING);
            exactRetry.current = null;
            setChangedCart(null);
            setCheckoutStage(adopted ? "details" : "review");
            refreshQuote();
          } else setSubmitError("Your updated cart could not be opened. Check your order status before trying again.");
        } else setChangedCart({ old: held, next: snapshot.generation });
        return;
      }
      setChangedCart(null);
      if (action === "retry" && exactRetry.current?.generation === held) {
        const order = await exactRetry.current.send();
        if (!current(true)) return;
        showVerifiedOrder(ownerId, held, order.id);
      } else setSubmitError("No receipt is available yet. Check again before placing another order.");
    } catch (error) {
      if (current()) {
        if (action === "retry" && (conflictCode(error) || error instanceof CheckoutQuoteChangedError)) exactRetry.current = null;
        if (action === "retry" && conflictCode(error) === "CHECKOUT_INTENT_CONFLICT") {
          setExisting({ owner: ownerId, generation: held, epoch, session, conflict: true });
          setSubmitError(getCheckoutErrorMessage(error, "create"));
        } else setSubmitError("Your order could not be confirmed. Check again or contact support.");
      }
    } finally {
      if (isCurrentIdentity(ownerId, epoch)) { setSubmitting(false); setCheckingReceipt(false); }
      submitInFlightRef.current = false;
    }
  };

  return {
    auth,
    hasHydrated,
    identityResolved,
    items,
    itemCount,
    ownerId,
    savedAddresses,
    isLoadingAddresses,
    addressLoadError,
    selectedAddressId,
    setSelectedAddressId,
    retryAddresses,
    submitting,
    submitError,
    checkoutStage,
    setCheckoutStage,
    orderQuote,
    isLoadingQuote: isLoadingQuote || (reviewing !== null && reviewing === quoteError),
    quoteError,
    retryQuote,
    hasUnknownOutcome,
    held,
    placing: submitting && !checkingReceipt,
    recover,
    intentConflict: scopedExisting?.conflict === true,
    onViewExistingOrder: scopedExisting?.orderId ? viewExistingOrder : undefined,
    canReviewChanged: !scopedExisting && changedCart?.old === held,
    canRetryExact: !scopedExisting && Boolean(held && exactRetry.current?.generation === held),
    detailsComplete,
    canSubmit,
    resumeCheckoutAfterReview,
    handleSubmit,
  };
}

export type CheckoutFlow = ReturnType<typeof useCheckoutFlow>;
