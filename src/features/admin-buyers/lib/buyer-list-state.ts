/**
 * @file buyer-list-state.ts
 * @module features/admin-buyers/lib
 * @description
 * Pure utility functions for the Admin Buyers CRM domain:
 * 1. URL search param parsing and serialization with bounds checking and canonical fallbacks.
 * 2. Immutable URL search param delta application.
 * 3. Sanitized error mapper transforming raw API exceptions into structured, user-friendly errors.
 */

import { ApiError } from "@/services/api";
import type {
  BuyerListQueryState,
  BuyerListSafeError,
  BuyerListViewMode,
  BuyerStatusFilter,
} from "../types/admin-buyer.types";

/**
 * Parses URL search parameters into a strongly-typed BuyerListQueryState.
 * Guarantees safe defaults for missing or invalid query parameters.
 */
export function parseBuyerListQuery(params: URLSearchParams): BuyerListQueryState {
  const rawStatus = params.get("status");
  const status: BuyerStatusFilter =
    rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all";

  const rawPage = Number.parseInt(params.get("page") ?? "", 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawView = params.get("view");
  const view: BuyerListViewMode = rawView === "grid" ? "grid" : "list";

  const search = (params.get("search") ?? "").trim().slice(0, 120);

  return { search, status, page, view };
}

/**
 * Serializes partial buyer query state into URL query parameter key-value pairs,
 * omitting default values to ensure clean, canonical URLs.
 */
export function serializeBuyerListQuery(state: Partial<BuyerListQueryState>): Record<string, string> {
  const result: Record<string, string> = {};
  if (state.search && state.search.trim().length > 0) {
    result.search = state.search.trim();
  }
  if (state.status && state.status !== "all") {
    result.status = state.status;
  }
  if (state.page && state.page > 1) {
    result.page = String(state.page);
  }
  if (state.view && state.view !== "list") {
    result.view = state.view;
  }
  return result;
}

/**
 * Applies updates to an existing URLSearchParams instance immutably.
 * Empty string or nullish values remove the parameter.
 */
export function applyBuyerListUrlUpdates(
  current: URLSearchParams,
  updates: Partial<Record<keyof BuyerListQueryState, string>>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

/**
 * Maps arbitrary errors (including ApiError HTTP status codes) to structured safe error objects.
 */
export function getBuyerSafeError(error: unknown): BuyerListSafeError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { kind: "unauthenticated", message: "Your admin session expired. Please sign in again." };
    }
    if (error.status === 403) {
      return { kind: "forbidden", message: "You do not have permission to view or manage customers." };
    }
    if (error.status === 404) {
      return { kind: "not-found", message: "The requested customer was not found." };
    }
    if (error.status === 409) {
      return { kind: "conflict", message: "The customer record changed concurrently. Refreshing view." };
    }
    if (error.status === 408) {
      return { kind: "timeout", message: "The customer directory took too long to load. Try again." };
    }
  }
  return {
    kind: "unavailable",
    message: error instanceof Error ? error.message : "The customer directory is temporarily unavailable.",
  };
}
