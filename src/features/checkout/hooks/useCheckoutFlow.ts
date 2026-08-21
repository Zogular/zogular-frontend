"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ClientAuthState } from "@/hooks/use-auth-session";
import { useCart } from "@/hooks/use-cart";
import { appendNextPath } from "@/services/auth-intent";
import { getSavedAddresses } from "@/services/account";
import {
  CheckoutContractError,
  CheckoutOrderOutcomeUnknownError,
  createCheckoutOrder,
  quoteCheckoutOrder,
  type CheckoutQuote,
} from "@/services/checkout";
import type { Address } from "@/types/address";
import {
  buildCartRequestKey,
  getCheckoutErrorMessage,
  isValidCheckoutAddress,
} from "@/features/checkout/lib/checkout-presentation";
import type { CheckoutStage } from "@/features/checkout/types/checkout.types";

export function useCheckoutFlow(auth: ClientAuthState) {
  const router = useRouter();
  const cart = useCart();
  const {
    hasHydrated,
    identityResolved,
    items,
    itemCount,
    totalAmount,
    checkoutOutcomeOwnerId,
    clearConfirmedCart,
    markCheckoutOutcomeUnknown,
    resumeCheckoutAfterReview,
    syncWithBackend,
  } = cart;
  const ownerId = auth.status === "authenticated" ? auth.user.id : null;
  const identityRef = React.useRef({ ownerId, epoch: 0, active: true });
  const submitInFlightRef = React.useRef(false);
  const [savedAddresses, setSavedAddresses] = React.useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = React.useState(false);
  const [addressLoadError, setAddressLoadError] = React.useState(false);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [checkoutStage, setCheckoutStage] = React.useState<CheckoutStage>("details");
  const [orderQuote, setOrderQuote] = React.useState<CheckoutQuote | null>(null);
  const [quotedCartKey, setQuotedCartKey] = React.useState<string | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);

  if (identityRef.current.ownerId !== ownerId) {
    identityRef.current.ownerId = ownerId;
    identityRef.current.epoch += 1;
  }

  const currentCartKey = React.useMemo(() => buildCartRequestKey(items), [items]);
  const selectedAddress = React.useMemo(
    () => savedAddresses.find((address) => address.id === selectedAddressId),
    [savedAddresses, selectedAddressId],
  );
  const isCurrentIdentity = React.useCallback((expectedOwnerId: string, epoch: number) => (
    identityRef.current.active
    && identityRef.current.ownerId === expectedOwnerId
    && identityRef.current.epoch === epoch
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
    setIsLoadingAddresses(true);
    setAddressLoadError(false);
    try {
      const addresses = await getSavedAddresses();
      if (!isCurrentIdentity(expectedOwnerId, epoch)) return;
      if (!Array.isArray(addresses) || !addresses.every(isValidCheckoutAddress)) {
        throw new CheckoutContractError("Delivery address response is malformed.");
      }
      setSavedAddresses(addresses);
      const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
      setSelectedAddressId(defaultAddress?.id ?? null);
    } catch (error) {
      if (!isCurrentIdentity(expectedOwnerId, epoch)) return;
      setSavedAddresses([]);
      setSelectedAddressId(null);
      setAddressLoadError(true);
      setSubmitError(getCheckoutErrorMessage(error, "address"));
    } finally {
      if (isCurrentIdentity(expectedOwnerId, epoch)) setIsLoadingAddresses(false);
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
    ) {
      setOrderQuote(null);
      setQuotedCartKey(null);
      return;
    }

    const expectedOwnerId = auth.user.id;
    const epoch = identityRef.current.epoch;
    const requestCartKey = currentCartKey;
    let active = true;
    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      setQuoteError(null);
      setOrderQuote(null);
      setQuotedCartKey(null);
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
        });
        if (active && isCurrentIdentity(expectedOwnerId, epoch)) {
          setOrderQuote(quote);
          setQuotedCartKey(requestCartKey);
        }
      } catch (error) {
        if (active && isCurrentIdentity(expectedOwnerId, epoch)) {
          setOrderQuote(null);
          setQuotedCartKey(null);
          setQuoteError(getCheckoutErrorMessage(error, "quote"));
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
    currentCartKey,
    hasHydrated,
    identityResolved,
    isCurrentIdentity,
    items,
    selectedAddress,
  ]);

  const hasUnknownOutcome = ownerId !== null && checkoutOutcomeOwnerId === ownerId;
  const detailsComplete = selectedAddressId !== null;
  const canSubmit = hasHydrated
    && identityResolved
    && auth.status === "authenticated"
    && items.length > 0
    && detailsComplete
    && !submitting
    && !hasUnknownOutcome
    && !isLoadingAddresses
    && !isLoadingQuote
    && Boolean(orderQuote)
    && quotedCartKey === currentCartKey
    && !quoteError;

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
    if (!canSubmit) {
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
    try {
      await syncWithBackend();
      if (!isCurrentIdentity(expectedOwnerId, epoch)) return;
      const currentCart = useCart.getState();
      if (currentCart.syncStatus === "error") {
        setSubmitError(currentCart.syncError ?? "Your cart could not be refreshed. Try again.");
        return;
      }
      const confirmedItems = currentCart.items;
      if (buildCartRequestKey(confirmedItems) !== currentCartKey) {
        setSubmitError("Your cart changed. Review the updated totals before placing your order.");
        return;
      }
      const order = await createCheckoutOrder({
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
      });
      if (!isCurrentIdentity(expectedOwnerId, epoch)) return;
      clearConfirmedCart(expectedOwnerId);
      router.push(`/success?orderId=${encodeURIComponent(order.id)}`);
    } catch (error) {
      if (!isCurrentIdentity(expectedOwnerId, epoch)) return;
      if (error instanceof CheckoutOrderOutcomeUnknownError) {
        markCheckoutOutcomeUnknown(expectedOwnerId);
        setSubmitError("Order outcome not confirmed. Check your orders before trying again.");
      } else {
        setSubmitError(getCheckoutErrorMessage(error, "create"));
      }
    } finally {
      if (isCurrentIdentity(expectedOwnerId, epoch)) setSubmitting(false);
      submitInFlightRef.current = false;
    }
  };

  return {
    auth,
    hasHydrated,
    identityResolved,
    items,
    itemCount,
    totalAmount,
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
    isLoadingQuote,
    quoteError,
    hasUnknownOutcome,
    detailsComplete,
    canSubmit,
    resumeCheckoutAfterReview,
    handleSubmit,
  };
}

export type CheckoutFlow = ReturnType<typeof useCheckoutFlow>;
