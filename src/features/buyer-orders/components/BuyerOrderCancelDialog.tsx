"use client";

import * as React from "react";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BuyerOrderCancelDialogProps {
  orderLabel: string;
  open: boolean;
  isSubmitting: boolean;
  csrfRetryMessage: string | null;
  onOpenTrigger: () => void;
  onOpenChange: (open: boolean) => void;
  onConfirmCancellation: () => void | Promise<void>;
}

export function BuyerOrderCancelDialog({
  orderLabel,
  open,
  isSubmitting,
  csrfRetryMessage,
  onOpenTrigger,
  onOpenChange,
  onConfirmCancellation,
}: BuyerOrderCancelDialogProps) {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const keepButtonRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        onClick={onOpenTrigger}
        disabled={isSubmitting}
        className="h-11 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        Cancel order
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={!isSubmitting}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            keepButtonRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (triggerRef.current && triggerRef.current.isConnected) {
              event.preventDefault();
              triggerRef.current.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (isSubmitting) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isSubmitting) event.preventDefault();
          }}
          className="max-w-[calc(100%-1.5rem)] rounded-2xl p-5 sm:max-w-md sm:p-6"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900">
              Cancel order #{orderLabel}?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-zinc-600">
              This will cancel the whole order and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {csrfRetryMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900"
            >
              {csrfRetryMessage}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              ref={keepButtonRef}
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="h-11 w-full font-semibold sm:w-auto"
            >
              Keep order
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => void onConfirmCancellation()}
              className="h-11 w-full bg-red-600 font-bold text-white hover:bg-red-700 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Cancelling…
                </>
              ) : (
                "Confirm cancellation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
