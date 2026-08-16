import { ApiError } from "@/services/api";

export type AccountResource = "account" | "orders" | "order" | "addresses" | "settings";

export interface AccountErrorPresentation {
  kind: "sign-in" | "unavailable" | "temporary";
  title: string;
  description: string;
}

const resourceNames: Record<AccountResource, string> = {
  account: "Account details",
  orders: "Orders",
  order: "Order",
  addresses: "Addresses",
  settings: "Settings",
};

const unavailableDescriptions: Record<AccountResource, string> = {
  account: "This account information is not available.",
  orders: "Your order history is not available.",
  order: "This order is not available.",
  addresses: "Your saved addresses are not available.",
  settings: "Your settings are not available.",
};

export function getAccountErrorPresentation(
  error: unknown,
  resource: AccountResource,
): AccountErrorPresentation {
  if (error instanceof ApiError && error.status === 401) {
    return {
      kind: "sign-in",
      title: "Please sign in again",
      description: "Sign in to continue.",
    };
  }

  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    if (resource === "order" && error.status === 404) {
      return {
        kind: "unavailable",
        title: "Order not found",
        description: "This order is not available.",
      };
    }

    return {
      kind: "unavailable",
      title: `${resourceNames[resource]} unavailable`,
      description: unavailableDescriptions[resource],
    };
  }

  return {
    kind: "temporary",
    title: `${resourceNames[resource]} could not load`,
    description: "Please try again in a moment.",
  };
}
