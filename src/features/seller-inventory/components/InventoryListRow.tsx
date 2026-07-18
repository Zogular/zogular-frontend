import Image from "next/image";
import { Minus, Plus, Save, ArrowUpDown, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InventoryProduct } from "@/services/inventory";
import { getStatusInfo, formatCurrency } from "../utils/inventory-utils";
import { InventoryItemMenu } from "./InventoryItemMenu";

export function InventoryListRow({
  item,
  isSelected,
  onToggleSelect,
  isEditing,
  isItemSaving,
  editingStockValue,
  onUpdateEditingStock,
  onKeyDown,
  onAdjustStock,
  onSaveStock,
}: {
  item: InventoryProduct;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  isEditing: boolean;
  isItemSaving: boolean;
  editingStockValue: string;
  onUpdateEditingStock: (id: string, value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, id: string) => void;
  onAdjustStock: (id: string, currentStock: number, delta: number) => void;
  onSaveStock: (id: string, overrideValue?: number) => void;
}) {
  const status = getStatusInfo(item.stock, item.threshold, item.isSold);

  return (
    <tr
      className={cn(
        "transition-colors hover:bg-zinc-50/50",
        isSelected && "bg-[#009E49]/5 hover:bg-[#009E49]/10",
      )}
    >
      <td className="p-4 pl-6">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-[#009E49] focus:ring-[#009E49]"
        />
      </td>

      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-13 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
            {item.image ? (
              <Image src={item.image} alt={item.name} fill sizes="40px" className="object-contain p-0.5" />
            ) : (
              <ImageIcon className="h-4 w-4 text-zinc-400" />
            )}
          </div>

          <div>
            <p className="max-w-55 truncate font-bold text-zinc-900">
              {item.name}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {item.category.name}
              {item.hasVariants ? " • Variants" : ""}
            </p>
          </div>
        </div>
      </td>

      <td className="p-4 text-xs font-bold text-zinc-600">{item.sku}</td>
      <td className="p-4 font-black text-zinc-900">{formatCurrency(item.price)}</td>

      <td className="p-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${status.bg} ${status.text} ${status.border}`}
        >
          <status.icon className="h-3 w-3" />
          {status.label}
        </span>
      </td>

      <td className="p-4">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={`Decrease stock for ${item.name}`}
            className="h-9 w-9 shrink-0 rounded-lg text-zinc-500 hover:text-zinc-900"
            onClick={() => onAdjustStock(item.id, item.stock, -1)}
          >
            <Minus className="h-3 w-3" />
          </Button>

          <Input
            type="number"
            min={0}
            max={2_147_483_647}
            step={1}
            value={isEditing ? editingStockValue : String(item.stock)}
            onChange={(event) => onUpdateEditingStock(item.id, event.target.value)}
            onKeyDown={(event) => onKeyDown(event, item.id)}
            className={cn(
              "h-9 w-16 rounded-lg px-1 text-center text-sm font-bold shadow-inner focus-visible:ring-[#009E49]",
              isEditing && "border-[#009E49] bg-[#009E49]/5",
            )}
          />

          <Button
            variant="outline"
            size="icon"
            aria-label={`Increase stock for ${item.name}`}
            className="h-9 w-9 shrink-0 rounded-lg text-zinc-500 hover:text-zinc-900"
            onClick={() => onAdjustStock(item.id, item.stock, 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>

          {isEditing ? (
            <Button
              size="icon"
              aria-label={`Save stock for ${item.name}`}
              onClick={() => onSaveStock(item.id)}
              disabled={isItemSaving}
              className="ml-1 h-9 w-9 shrink-0 rounded-lg bg-[#009E49] text-white hover:bg-[#00853d]"
            >
              {isItemSaving ? (
                <ArrowUpDown className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          ) : null}
        </div>
      </td>

      <td className="p-4 pr-6 text-right">
        <InventoryItemMenu
          item={item}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          onRestock={(id, threshold) => {
            onSaveStock(id, threshold);
          }}
          onMarkOutOfStock={(id) => {
            onSaveStock(id, 0);
          }}
        />
      </td>
    </tr>
  );
}
