"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendOrderPage, getMyOrdersPage } from "@/services/orders";
import type { OrderPage } from "@/types/order";
import { useOrderReturnScope } from "../components/OrderReturnScope";
import { MAX_ORDER_RETURN_PAGES, orderLinkId, type OrderFilter, type OrderReturnSnapshot } from "../lib/order-return-state";

const RETURN_MAX_AGE_MS = 5 * 60_000;

export function useBuyerOrderHistory(filter: OrderFilter) {
  const snapshot = useOrderReturnScope();
  const initialFilter = useRef(filter);
  const request = useRef<AbortController | null>(null);
  const [page, setPage] = useState<OrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nextPageError, setNextPageError] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<{ target: OrderReturnSnapshot | null; sameRows: boolean } | null>(null);

  const loadInitial = useCallback(async (requestedFilter: OrderFilter) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const { signal } = controller;
    const saved = snapshot.current;
    const returning = saved && saved.filter === requestedFilter && Date.now() - saved.savedAt <= RETURN_MAX_AGE_MS
      ? saved
      : null;
    setLoading(true);
    setError(null);
    setNextPageError(false);
    try {
      let loaded = await getMyOrdersPage({ signal });
      let incomplete = false;
      // Only commit coherent prefixes; appendOrderPage rejects duplicate or drifting results.
      for (let next = 2; returning && next <= Math.min(loaded.pagination.pages, MAX_ORDER_RETURN_PAGES) && !signal.aborted; next++) {
        if (next > returning.page && loaded.orders.some(order => order.id === returning.orderId)) break;
        try {
          loaded = appendOrderPage(loaded, await getMyOrdersPage({ page: next, signal }));
        } catch {
          incomplete = true;
          break;
        }
      }
      if (signal.aborted) return;
      if (snapshot.current === saved) snapshot.current = null;
      setPage(loaded);
      if (returning) {
        setSearch(returning.search);
        const sameRows = loaded.orders.length === returning.rowIds.length
          && loaded.orders.every((order, index) => order.id === returning.rowIds[index]);
        setPosition({ target: returning, sameRows });
      }
      setNextPageError(incomplete);
    } catch (cause) {
      if (!signal.aborted) setError(cause);
    } finally {
      if (!signal.aborted) setLoading(false);
      if (request.current === controller) request.current = null;
    }
  }, [snapshot]);

  useEffect(() => {
    void loadInitial(initialFilter.current);
    return () => request.current?.abort();
  }, [loadInitial]);

  useEffect(() => {
    if (loading || !position) return;
    let frame = 0;
    let attempts = 0;
    const target = position.target;
    const exact = target && position.sameRows
      && window.innerWidth === target.viewportWidth && window.innerHeight === target.viewportHeight;
    const cleanup = () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
    const stop = () => {
      cleanup();
      setPosition(null);
    };
    function restore() {
      const link = target && document.getElementById(orderLinkId(target.orderId));
      if (!link || !target) {
        window.scrollTo({ top: 0, behavior: "instant" });
        stop();
        return;
      }
      const linkTop = link.getBoundingClientRect().top;
      const list = link.closest("[data-order-history-list]");
      const sameLayout = list && Math.abs(linkTop - list.getBoundingClientRect().top - target.listOffset) <= 1;
      const top = exact && sameLayout ? target.scrollY : window.scrollY + linkTop - target.viewportOffset;
      window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: "instant" });
      // The sticky header and late layout can settle just after the first scroll.
      if (++attempts < 15) frame = window.requestAnimationFrame(restore);
      else stop();
    }
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    frame = window.requestAnimationFrame(restore);
    return cleanup;
  }, [loading, position]);

  async function loadMore() {
    if (!page || request.current || page.pagination.page >= page.pagination.pages) return;
    const controller = new AbortController();
    request.current = controller;
    setLoadingMore(true);
    setNextPageError(false);
    try {
      const next = await getMyOrdersPage({ page: page.pagination.page + 1, signal: controller.signal });
      if (!controller.signal.aborted) setPage(appendOrderPage(page, next));
    } catch {
      if (!controller.signal.aborted) setNextPageError(true);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
      if (request.current === controller) request.current = null;
    }
  }

  function rememberOrder(orderId: string) {
    const link = document.getElementById(orderLinkId(orderId));
    const list = link?.closest("[data-order-history-list]");
    if (!link || !list || !page) return;
    snapshot.current = {
      filter,
      search,
      page: page.pagination.page,
      orderId,
      rowIds: page.orders.slice(0, MAX_ORDER_RETURN_PAGES * page.pagination.limit).map((order) => order.id),
      scrollY: Math.round(window.scrollY),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      viewportOffset: link.getBoundingClientRect().top,
      listOffset: link.getBoundingClientRect().top - list.getBoundingClientRect().top,
      savedAt: Date.now(),
    };
  }

  return { page, error, loading, loadingMore, nextPageError, search, setSearch, loadMore, rememberOrder, retry: () => loadInitial(filter) };
}
