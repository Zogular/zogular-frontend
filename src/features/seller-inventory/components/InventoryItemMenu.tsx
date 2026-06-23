import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import type { InventoryProduct } from "@/services/inventory";

export function InventoryItemMenu({
  item,
  isSelected,
  onToggleSelect,
  onRestock,
  onMarkOutOfStock,
}: {
  item: InventoryProduct;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRestock: (id: string, threshold: number) => void;
  onMarkOutOfStock: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ActionMenu open={open} onOpenChange={setOpen}>
      <ActionMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open inventory actions"
          className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </ActionMenuTrigger>

      <ActionMenuContent>
        <ActionMenuItem
          onClick={() => {
            onToggleSelect(item.id);
            setOpen(false);
          }}
        >
          {isSelected ? "Unselect Item" : "Select Item"}
        </ActionMenuItem>
        <ActionMenuItem
          onClick={() => {
            onRestock(item.id, item.threshold);
            setOpen(false);
          }}
        >
          Restock to Threshold
        </ActionMenuItem>
        <ActionMenuSeparator />
        <ActionMenuItem
          onClick={() => {
            onMarkOutOfStock(item.id);
            setOpen(false);
          }}
          className="text-red-600 hover:bg-red-50 focus-visible:ring-red-200"
        >
          Mark Out of Stock
        </ActionMenuItem>
      </ActionMenuContent>
    </ActionMenu>
  );
}
