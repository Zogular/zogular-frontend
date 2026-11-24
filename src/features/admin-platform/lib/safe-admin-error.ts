import { ZodError } from "zod";
import { ApiError } from "@/services/api";
import {
  SAFE_ADMIN_ERROR_CONTRACT_VERSION,
  SafeAdminErrorSchema,
  type SafeAdminError,
  type SafeAdminErrorKind,
} from "../types/errors";

interface SafeErrorCopy {
  readonly title: string;
  readonly message: string;
  readonly action: SafeAdminError["action"];
}

const SAFE_ERROR_COPY: Readonly<Record<SafeAdminErrorKind, SafeErrorCopy>> = Object.freeze({
  unauthenticated: {
    title: "Sign in required",
    message: "Your admin session is no longer available. Sign in again to continue.",
    action: "sign_in",
  },
  forbidden: {
    title: "Access unavailable",
    message: "You do not have access to this admin resource or action.",
    action: "request_access",
  },
  not_found: {
    title: "Item not found",
    message: "This admin item is unavailable or may no longer exist.",
    action: "go_back",
  },
  conflict: {
    title: "State changed",
    message: "This item changed before the action completed. Review the latest state before continuing.",
    action: "none",
  },
  validation: {
    title: "Review the information",
    message: "Some information could not be accepted. Review the highlighted fields and try again.",
    action: "review_input",
  },
  timeout: {
    title: "Request timed out",
    message: "The request took too long. It is safe to try again.",
    action: "retry",
  },
  unavailable: {
    title: "Service temporarily unavailable",
    message: "This admin service is temporarily unavailable. It is safe to try again.",
    action: "retry",
  },
  malformed: {
    title: "Response unavailable",
    message: "The service returned information that could not be verified.",
    action: "contact_support",
  },
  unknown: {
    title: "Something went wrong",
    message: "The request could not be completed. Contact support if the problem continues.",
    action: "contact_support",
  },
});

function kindFromStatus(status: number): SafeAdminErrorKind {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 409) return "conflict";
  if (status === 422) return "validation";
  if (status >= 500 && status <= 599) return "unavailable";
  return "unknown";
}

function isMalformedContractError(error: unknown): boolean {
  if (error instanceof ZodError || error instanceof SyntaxError) return true;
  if (!(error instanceof Error)) return false;
  return /ContractError$/.test(error.name);
}

function createSafeAdminError(
  kind: SafeAdminErrorKind,
  status: number | null,
): SafeAdminError {
  const copy = SAFE_ERROR_COPY[kind];
  return SafeAdminErrorSchema.parse({
    version: SAFE_ADMIN_ERROR_CONTRACT_VERSION,
    kind,
    status,
    title: copy.title,
    message: copy.message,
    action: copy.action,
    retryEligible: kind === "timeout" || kind === "unavailable",
  });
}

export function toSafeAdminError(error: unknown): SafeAdminError {
  if (error instanceof ApiError) {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : null;
    return createSafeAdminError(status === null ? "unknown" : kindFromStatus(status), status);
  }
  if (isMalformedContractError(error)) return createSafeAdminError("malformed", null);
  return createSafeAdminError("unknown", null);
}

export interface AdminFetchErrorContext {
  readonly timedOut?: boolean;
}

export function toSafeAdminFetchError(
  error: unknown,
  context: AdminFetchErrorContext = {},
): SafeAdminError {
  if (context.timedOut || (error instanceof Error && error.name === "TimeoutError")) {
    return createSafeAdminError("timeout", null);
  }
  if (error instanceof Error && error.name === "AbortError") {
    return createSafeAdminError("unknown", null);
  }
  if (error instanceof TypeError) {
    return createSafeAdminError("unavailable", null);
  }
  return toSafeAdminError(error);
}
