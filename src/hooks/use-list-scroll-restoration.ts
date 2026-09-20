"use client";

/**
 * @file use-list-scroll-restoration.ts
 * @description
 * Container-aware list scroll restoration hook and helper utilities.
 * Mandate:
 * Every administrative, seller, and consumer list, catalog, and review queue MUST preserve
 * exact scroll position upon return navigation (browser back, back button, breadcrumb).
 * When an operator or user navigates from a list/queue into an item's detail page and then returns,
 * the viewport returns immediately to the exact row and scroll position where they left off.
 *
 * Container awareness:
 * Standard consumer and seller pages scroll the window.
 * The Admin Portal (`AdminShell.tsx`) scrolls an inner container (`[data-testid="admin-main-scroll"]`,
 * `[data-scroll-container="admin"]`) while window overflow is hidden.
 * This helper dynamically detects the active target and abstracts measuring and restoring scroll positions.
 */

import { useEffect } from "react";

const STORAGE_PREFIX = "zogular:list-scroll:";
const MAX_AGE_MS = 10 * 60 * 1000;

type StoredScrollPosition = {
  y: number;
  savedAt: number;
};

export type ScrollTarget = {
  element: HTMLElement | null;
  getY: () => number;
  setY: (y: number) => void;
  getMaxY: () => number;
};

/**
 * Resolves whether scroll target is an inner admin scroll container or the global window,
 * returning unified getters and setters for measurement and restoration.
 */
export function getScrollTarget(): ScrollTarget {
  if (typeof window === "undefined") {
    return { element: null, getY: () => 0, setY: () => {}, getMaxY: () => 0 };
  }
  const adminScroll = document.querySelector<HTMLElement>(
    '[data-testid="admin-main-scroll"], [data-scroll-container="admin"]',
  );
  if (adminScroll) {
    return {
      element: adminScroll,
      getY: () => Math.round(adminScroll.scrollTop),
      setY: (y: number) => {
        adminScroll.scrollTop = y;
      },
      getMaxY: () => Math.max(0, adminScroll.scrollHeight - adminScroll.clientHeight),
    };
  }
  return {
    element: null,
    getY: () => Math.max(0, Math.round(window.scrollY)),
    setY: (y: number) => {
      window.scrollTo({ top: y, behavior: "instant" });
    },
    getMaxY: () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  };
}

function getStorageKey(listUrl: string) {
  return `${STORAGE_PREFIX}${listUrl}`;
}

/**
 * Remembers the current scroll position for a given list URL in sessionStorage.
 * Call this when clicking an item to navigate to its detail page.
 */
export function rememberListScroll(listUrl: string) {
  if (typeof window === "undefined") return;

  const target = getScrollTarget();
  const position: StoredScrollPosition = {
    y: Math.max(0, target.getY()),
    savedAt: Date.now(),
  };

  window.sessionStorage.setItem(getStorageKey(listUrl), JSON.stringify(position));
}

/**
 * Restores the remembered scroll position once the list has rendered (ready === true).
 * Retries across animation frames (up to 15 frames) or until the scroll target height
 * accommodates the saved position.
 */
export function useListScrollRestoration(listUrl: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return;

    const storageKey = getStorageKey(listUrl);
    const rawPosition = window.sessionStorage.getItem(storageKey);
    if (!rawPosition) return;

    let position: StoredScrollPosition;
    try {
      position = JSON.parse(rawPosition) as StoredScrollPosition;
    } catch {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    if (
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.savedAt) ||
      Date.now() - position.savedAt > MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    let frameId = 0;
    let attempts = 0;

    const restore = () => {
      const target = getScrollTarget();
      const maximumScroll = target.getMaxY();
      const clampedY = Math.min(position.y, maximumScroll);
      target.setY(clampedY);
      attempts += 1;

      if (maximumScroll >= position.y || attempts >= 15) {
        window.sessionStorage.removeItem(storageKey);
        return;
      }

      frameId = window.requestAnimationFrame(restore);
    };

    frameId = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frameId);
  }, [listUrl, ready]);
}
