"use client";

import { useState } from "react";
import { Copy, Eye, MoreVertical, PauseCircle, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuNote,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import type { SellerProductListing } from "@/services/seller-catalog";
import { isSellerProductBuyerVisibleStatus, isSellerProductNeedsChangesStatus } from "@/services/product-moderation";
import type { SellerProductActions } from "@/features/seller-products/types";

interface SellerProductActionMenuProps {
  product: SellerProductListing;
  actions: SellerProductActions;
  className?: string;
}

export function SellerProductActionMenu({ product, actions, className }: SellerProductActionMenuProps) {
  const [open, setOpen] = useState(false);
  const isRejectedFamily = isSellerProductNeedsChangesStatus(product.status);
  const isBuyerVisibleFamily = isSellerProductBuyerVisibleStatus(product.status);

  const closeAfter = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <ActionMenu open={open} onOpenChange={setOpen}>
      <ActionMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Open product actions for ${product.title}`}
          title="Product actions"
          className={className ?? "h-9 w-9 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </ActionMenuTrigger>
      <ActionMenuContent className="w-56">
        {product.status === "draft" ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => actions.edit(product))}><Pencil className="h-3.5 w-3.5" /> Edit</ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => actions.view(product))}><Eye className="h-3.5 w-3.5" /> Preview</ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => actions.remove(product.id))} className="text-red-600 hover:bg-red-50 focus-visible:ring-red-200"><Trash2 className="h-3.5 w-3.5" /> Delete</ActionMenuItem>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => actions.submitForReview(product.id))} className="text-[#007d3a] hover:bg-emerald-50"><Send className="h-3.5 w-3.5" /> Submit for Review</ActionMenuItem>
          </>
        ) : null}

        {product.status === "pending_review" ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => actions.view(product))}><Eye className="h-3.5 w-3.5" /> View</ActionMenuItem>
            <ActionMenuNote>Withdraw review before editing this product.</ActionMenuNote>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => actions.withdrawReview(product.id))} className="text-amber-700 hover:bg-amber-50"><RotateCcw className="h-3.5 w-3.5" /> Withdraw Review</ActionMenuItem>
          </>
        ) : null}

        {isRejectedFamily ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => actions.view(product))}><Eye className="h-3.5 w-3.5" /> View Feedback</ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => actions.edit(product))}><Pencil className="h-3.5 w-3.5" /> Edit After Feedback</ActionMenuItem>
          </>
        ) : null}

        {isBuyerVisibleFamily ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => actions.view(product))}><Eye className="h-3.5 w-3.5" /> View</ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => actions.edit(product))}><Pencil className="h-3.5 w-3.5" /> Edit</ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => actions.pause(product.id))} className="text-amber-700 hover:bg-amber-50"><PauseCircle className="h-3.5 w-3.5" /> Pause Listing</ActionMenuItem>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => actions.duplicate(product))}><Copy className="h-3.5 w-3.5" /> Duplicate</ActionMenuItem>
          </>
        ) : null}

        {product.status === "paused" ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => actions.view(product))}><Eye className="h-3.5 w-3.5" /> View</ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => actions.edit(product))}><Pencil className="h-3.5 w-3.5" /> Edit</ActionMenuItem>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => actions.duplicate(product))}><Copy className="h-3.5 w-3.5" /> Duplicate</ActionMenuItem>
          </>
        ) : null}

        {product.status === "suspended" ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => actions.view(product))}><Eye className="h-3.5 w-3.5" /> View</ActionMenuItem>
            <ActionMenuNote>This listing is controlled by moderation.</ActionMenuNote>
          </>
        ) : null}
      </ActionMenuContent>
    </ActionMenu>
  );
}
