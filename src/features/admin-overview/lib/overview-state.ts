import type { AdminDashboardSummary } from "@/features/admin-overview/types/dashboard-summary";
import type { AdminOverviewSafeError } from "@/services/admin/dashboard";

export interface AdminOverviewState {
  data: AdminDashboardSummary | null;
  error: AdminOverviewSafeError | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  activeRequestId: number;
  liveMessage: string;
}

export type AdminOverviewAction =
  | { type: "request-started"; requestId: number; refresh: boolean }
  | { type: "request-succeeded"; requestId: number; data: AdminDashboardSummary; refresh: boolean }
  | { type: "request-failed"; requestId: number; error: AdminOverviewSafeError; refresh: boolean };

export const INITIAL_ADMIN_OVERVIEW_STATE: AdminOverviewState = {
  data: null,
  error: null,
  isInitialLoading: true,
  isRefreshing: false,
  activeRequestId: 0,
  liveMessage: "",
};

export function reduceAdminOverviewState(
  state: AdminOverviewState,
  action: AdminOverviewAction,
): AdminOverviewState {
  if (action.type === "request-started") {
    return {
      ...state,
      error: null,
      isInitialLoading: state.data === null,
      isRefreshing: action.refresh && state.data !== null,
      activeRequestId: action.requestId,
      liveMessage: action.refresh ? "Refreshing overview." : "",
    };
  }

  if (action.requestId !== state.activeRequestId) return state;

  if (action.type === "request-succeeded") {
    return {
      ...state,
      data: action.data,
      error: null,
      isInitialLoading: false,
      isRefreshing: false,
      liveMessage: action.refresh ? "Overview refreshed." : "",
    };
  }

  return {
    ...state,
    error: action.error,
    isInitialLoading: false,
    isRefreshing: false,
    liveMessage: action.error.message,
  };
}
