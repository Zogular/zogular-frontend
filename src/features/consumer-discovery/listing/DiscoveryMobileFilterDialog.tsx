"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CLOSE_TRANSITION_MS = 200;

type DiscoveryMobileFilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocusRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
};

type BodyStyleSnapshot = {
  overflow: string;
  paddingRight: string;
};

export function DiscoveryMobileFilterDialog({
  open,
  onOpenChange,
  restoreFocusRef,
  children,
}: DiscoveryMobileFilterDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bodyStyleRef = useRef<BodyStyleSnapshot | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outsidePointerRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const presentationState = open ? "open" : "closed";

  const restoreBodyStyles = useCallback(() => {
    const snapshot = bodyStyleRef.current;
    if (!snapshot) return;
    document.body.style.overflow = snapshot.overflow;
    document.body.style.paddingRight = snapshot.paddingRight;
    bodyStyleRef.current = null;
  }, []);

  const finishClose = useCallback(({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
    const dialog = dialogRef.current;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (dialog?.open) dialog.close();
    restoreBodyStyles();
    if (restoreFocus) restoreFocusRef.current?.focus({ preventScroll: true });
  }, [restoreBodyStyles, restoreFocusRef]);

  const beginClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closeTimerRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      finishClose();
      return;
    }
    closeTimerRef.current = setTimeout(() => finishClose(), CLOSE_TRANSITION_MS);
  }, [finishClose]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (!dialog.open) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        bodyStyleRef.current = {
          overflow: document.body.style.overflow,
          paddingRight: document.body.style.paddingRight,
        };
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
        dialog.showModal();
      }
      closeButtonRef.current?.focus({ preventScroll: true });
      return;
    }

    beginClose();
  }, [beginClose, open]);

  useEffect(() => () => {
    finishClose({ restoreFocus: false });
  }, [finishClose]);

  function requestClose() {
    if (!open) return;
    onOpenChange(false);
  }

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    requestClose();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDialogElement>) {
    if (event.button !== 0) {
      outsidePointerRef.current = false;
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    outsidePointerRef.current =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDialogElement>) {
    const startedOutside = outsidePointerRef.current;
    outsidePointerRef.current = false;
    if (!startedOutside || event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const endedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (endedOutside) requestClose();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-state={presentationState}
      data-testid="mobile-filter-dialog"
      className={cn(
        "fixed inset-0 m-0 h-svh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 text-inherit",
        "backdrop:bg-black/50 backdrop:transition-opacity backdrop:duration-200",
        "data-[state=closed]:backdrop:opacity-0 data-[state=open]:backdrop:opacity-100",
        "motion-reduce:backdrop:transition-none",
      )}
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div
        ref={panelRef}
        data-testid="mobile-filter-sheet"
        data-state={presentationState}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-zinc-200 bg-white shadow-lg",
          "translate-y-full transition-transform duration-200 ease-out data-[state=open]:translate-y-0",
          "motion-reduce:transition-none",
        )}
      >
        <div className="relative shrink-0 border-b border-zinc-200 px-5 py-4 pr-16">
          <h2 id={titleId} className="text-lg font-black text-zinc-950">Filter and sort</h2>
          <p id={descriptionId} className="text-sm text-zinc-500">Choose supported listing options, then apply them.</p>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-11 w-11 rounded-full"
            onClick={requestClose}
          >
            <X aria-hidden="true" />
            <span className="sr-only">Close filter and sort</span>
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
