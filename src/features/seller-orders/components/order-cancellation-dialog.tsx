"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SellerOrderSummary } from "@/services/seller-orders";

interface OrderCancellationDialogProps {
  order: SellerOrderSummary | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function OrderCancellationDialog({
  order,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: OrderCancellationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent className="rounded-2xl border border-red-100 bg-white p-5 sm:max-w-md">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="pt-2 text-lg font-black text-zinc-950">Cancel this seller order?</DialogTitle>
          <DialogDescription className="leading-6 text-zinc-600">
            {order ? `Order ${order.orderNumber} will be cancelled for your store.` : "This seller order will be cancelled."} Reserved inventory for your items is restored only after the server confirms the cancellation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)} className="h-10 rounded-xl">
            Keep order
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm} className="h-10 rounded-xl bg-red-600 text-white hover:bg-red-700">
            {pending ? "Cancelling…" : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
