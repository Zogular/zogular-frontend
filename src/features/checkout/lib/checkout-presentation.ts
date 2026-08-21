import type { CartItem } from "@/hooks/use-cart";
import { ApiError } from "@/services/api";
import { CheckoutContractError } from "@/services/checkout";
import type { Address } from "@/types/address";
import type { CheckoutErrorBoundary } from "@/features/checkout/types/checkout.types";

export function formatCheckoutCurrency(value: number): string {
  return `K${value.toLocaleString()}`;
}

export function buildCartRequestKey(items: CartItem[]): string {
  return items.map((item) => `${item.id}:${item.quantity}`).sort().join("|");
}

export function isValidCheckoutAddress(address: Address): boolean {
  return Boolean(
    address
    && typeof address.id === "string"
    && address.id.trim()
    && typeof address.name === "string"
    && address.name.trim().length >= 3
    && typeof address.street === "string"
    && address.street.trim().length >= 5
    && typeof address.area === "string"
    && address.area.trim().length >= 2
    && typeof address.phone === "string"
    && address.phone.trim().length >= 10,
  );
}

export function getCheckoutErrorMessage(
  error: unknown,
  boundary: CheckoutErrorBoundary,
): string {
  if (error instanceof CheckoutContractError) {
    return boundary === "quote"
      ? "Order totals could not be confirmed. Try again."
      : "Your order details could not be confirmed. Review them and try again.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "Please sign in again to continue.";
    if (error.status === 404 || error.status === 409 || error.status === 422) {
      return boundary === "address"
        ? "That delivery address is no longer available."
        : "Some cart details changed. Review your cart and try again.";
    }
    if (error.status === 408 || error.status >= 500) {
      return "This service is temporarily unavailable. Please try again in a moment.";
    }
  }
  return "Something went wrong. Please try again.";
}
