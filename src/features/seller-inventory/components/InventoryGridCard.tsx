import Image from "next/image";
import { ArrowUpDown, ImageIcon, Minus, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InventoryProduct } from "@/services/inventory";
import { formatCurrency, getStatusInfo } from "../utils/inventory-utils";
import { InventoryItemMenu } from "./InventoryItemMenu";

interface InventoryGridCardProps {
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
  viewMode: "list" | "grid";
}

export function InventoryGridCard({
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
  viewMode,
}: InventoryGridCardProps) {
  const status = getStatusInfo(item.stock, item.threshold, item.isSold);
  const menu = (
    <InventoryItemMenu
      item={item}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onRestock={(id, threshold) => onSaveStock(id, threshold)}
      onMarkOutOfStock={(id) => onSaveStock(id, 0)}
    />
  );
  const stockInput = (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label={`Decrease stock for ${item.name}`}
        className="h-8 w-8 shrink-0 rounded-lg"
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
        aria-label={`Stock for ${item.name}`}
        className={cn(
          "h-8 min-w-0 flex-1 rounded-lg px-1 text-center text-sm font-bold shadow-inner focus-visible:ring-[#009E49]",
          isEditing && "border-[#009E49] bg-[#009E49]/5",
        )}
      />
      {viewMode === "grid" ? (
        <Button
          variant="outline"
          size="icon"
          aria-label={`Increase stock for ${item.name}`}
          className="h-8 w-8 shrink-0 rounded-lg"
          onClick={() => onAdjustStock(item.id, item.stock, 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      ) : null}
      {isEditing ? (
        <Button
          size="icon"
          aria-label={`Save stock for ${item.name}`}
          onClick={() => onSaveStock(item.id)}
          disabled={isItemSaving}
          className="h-8 w-8 shrink-0 rounded-lg bg-[#009E49] text-white hover:bg-[#00853d]"
        >
          {isItemSaving ? (
            <ArrowUpDown className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
        </Button>
      ) : null}
    </div>
  );

  if (viewMode === "list") {
    return (
      <article
        className={cn(
          "flex min-h-22 items-center gap-2 p-2 transition-colors",
          isSelected && "bg-[#009E49]/5",
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          aria-label={`Select ${item.name}`}
          className="h-4 w-4 shrink-0 rounded border-zinc-300 text-[#009E49] focus:ring-[#009E49]"
        />
        <div className="relative h-18 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          {item.image ? (
            <Image
              src={item.image}
              alt={`Product image for ${item.name}`}
              fill
              sizes="56px"
              className="object-contain p-1"
            />
          ) : (
            <ImageIcon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-zinc-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-1">
            <h3 className="line-clamp-2 min-w-0 text-xs font-black leading-4 text-zinc-950 sm:text-sm">
              {item.name}
            </h3>
            {menu}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-xs font-black text-zinc-900">
              {formatCurrency(item.price)}
            </span>
            <span
              className={cn(
                "hidden shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase min-[430px]:inline-flex",
                status.bg,
                status.text,
                status.border,
              )}
            >
              <status.icon className="h-2.5 w-2.5" />
              {status.label}
            </span>
            <div className="ml-auto min-w-27 max-w-38 flex-1">{stockInput}</div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm", isSelected && "border-[#009E49]/40 bg-[#009E49]/5")}>
      <div className="relative aspect-[3/4] bg-zinc-50">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 899px) 50vw, (max-width: 1199px) 33vw, (max-width: 1535px) 25vw, 20vw"
            className="object-contain p-1.5"
          />
        ) : (
          <ImageIcon className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-zinc-300" />
        )}
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(item.id)} aria-label={`Select ${item.name}`} className="absolute left-2 top-2 h-5 w-5 rounded border-white bg-white text-[#009E49] shadow focus:ring-[#009E49]" />
        <div className="absolute right-1.5 top-1.5 rounded-lg bg-white/95 shadow-sm">{menu}</div>
      </div>
      <div className="p-2">
        <h3 className="line-clamp-2 text-xs font-black leading-4 text-zinc-950 sm:text-[13px]">{item.name}</h3>
        <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-zinc-400">{item.sku}</p>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1"><span className="text-sm font-black text-zinc-900">{formatCurrency(item.price)}</span><span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase", status.bg, status.text, status.border)}><status.icon className="h-2.5 w-2.5" />{status.label}</span></div>
        <div className="mt-1.5">{stockInput}</div>
      </div>
    </article>
  );
}
