"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  INITIAL_ADMIN_OVERVIEW_STATE,
  reduceAdminOverviewState,
} from "@/features/admin-overview/lib/overview-state";
import {
  fetchAdminDashboardSummary,
  getAdminOverviewSafeError,
} from "@/services/admin/dashboard";

export function useAdminOverview() {
  const [state, dispatch] = useReducer(
    reduceAdminOverviewState,
    INITIAL_ADMIN_OVERVIEW_STATE,
  );
  const requestIdRef = useRef(0);
  const requestPendingRef = useRef(false);

  const load = useCallback(async (refresh: boolean) => {
    if (requestPendingRef.current) return;

    requestPendingRef.current = true;
    const requestId = ++requestIdRef.current;
    dispatch({ type: "request-started", requestId, refresh });

    try {
      const data = await fetchAdminDashboardSummary();
      if (requestId === requestIdRef.current) {
        dispatch({ type: "request-succeeded", requestId, data, refresh });
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        dispatch({
          type: "request-failed",
          requestId,
          error: getAdminOverviewSafeError(error),
          refresh,
        });
      }
    } finally {
      if (requestId === requestIdRef.current) {
        requestPendingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
    return () => {
      requestIdRef.current += 1;
      requestPendingRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { ...state, refresh };
}
