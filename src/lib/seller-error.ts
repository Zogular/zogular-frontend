import { ApiError } from "@/services/api";

export type SellerErrorContext =
  | "workspace"
  | "settings"
  | "support-list"
  | "support-detail"
  | "support-create"
  | "support-reply"
  | "support-resolve"
  | "notifications";

const CONTEXT_ACTION: Record<SellerErrorContext, string> = {
  workspace: "load your seller workspace",
  settings: "load your seller settings",
  "support-list": "load support tickets",
  "support-detail": "load this ticket",
  "support-create": "create this support ticket",
  "support-reply": "send your reply",
  "support-resolve": "update this ticket",
  notifications: "load seller notifications",
};

export function getSellerSafeErrorMessage(error: unknown, context: SellerErrorContext): string {
  const action = CONTEXT_ACTION[context];

  if (error instanceof ApiError) {
    if (error.status === 401) return "Please sign in again to continue.";
    if (error.status === 403) return "You do not have access to this seller action.";
    if (error.status === 404) return "We could not find that seller record. Refresh and try again.";
    if (error.status === 409) return `This changed before we could ${action}. Refresh and try again.`;
    if (error.status === 422) return "Check the details and try again.";
    if (error.status === 429) return "Too many attempts. Wait a moment, then try again.";
    if (error.status === 408) return `The request took too long. Check your connection and try again.`;
    if (error.status >= 500) return `Zogular could not ${action} right now. Try again shortly.`;
  }

  return `Zogular could not ${action} right now. Try again.`;
}
