"use client";

import { useEffect } from "react";

const STORAGE_PREFIX = "zogular:list-scroll:";
const MAX_AGE_MS = 10 * 60 * 1000;

type StoredScrollPosition = {
  y: number;
  savedAt: number;
};

function getStorageKey(listUrl: string) {
  return `${STORAGE_PREFIX}${listUrl}`;
}

export function rememberListScroll(listUrl: string) {
  if (typeof window === "undefined") return;

  const position: StoredScrollPosition = {
    y: Math.max(0, Math.round(window.scrollY)),
    savedAt: Date.now(),
  };

  window.sessionStorage.setItem(getStorageKey(listUrl), JSON.stringify(position));
}

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
      const maximumScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const target = Math.min(position.y, maximumScroll);
      window.scrollTo({ top: target, behavior: "instant" });
      attempts += 1;

      if (maximumScroll >= position.y || attempts >= 12) {
        window.sessionStorage.removeItem(storageKey);
        return;
      }

      frameId = window.requestAnimationFrame(restore);
    };

    frameId = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frameId);
  }, [listUrl, ready]);
}
