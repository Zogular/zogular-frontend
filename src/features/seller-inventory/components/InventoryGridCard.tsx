import { Minus, Plus, Save, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InventoryProduct } from "@/services/inventory";
import { getStatusInfo, formatCurrency } from "../utils/inventory-utils";
import { InventoryItemMenu } from "./InventoryItemMenu";

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
  viewMode: "list" | "grid";
}) {
  const status = getStatusInfo(item.stock, item.threshold);

  return (
    <div
      className={cn(
        "transition-colors",
        viewMode === "grid"
          ? "rounded-[1.4rem] border border-zinc-200/80 bg-white p-4 shadow-sm"
          : "p-3.5",
        isSelected && (viewMode === "grid" ? "bg-[#009E49]/5" : "bg-[#009E49]/5"),
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          className={cn("shrink-0 rounded border-zinc-300 text-[#009E49] focus:ring-[#009E49]", viewMode === "grid" ? "mt-1 h-5 w-5" : "mt-0.5 h-4 w-4")}
        />

        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-bold text-zinc-900">
              {item.name}
            </h3>

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
          </div>

          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {item.sku}
          </p>

          {viewMode === "list" ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-600">
                <span className="inline-flex items-center gap-1">
                  <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Category</span>
                  <span>{item.category.name}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Price</span>
                  <span>{formatCurrency(item.price)}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Stock</span>
                  <span>{item.stock}</span>
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${status.bg} ${status.text} ${status.border}`}
                >
                  <status.icon className="h-3 w-3" />
                  {status.label}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Decrease stock for ${item.name}`}
                    className="h-8 w-8 shrink-0 rounded-lg text-zinc-500 hover:text-zinc-900"
                    onClick={() => onAdjustStock(item.id, item.stock, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>

                  <Input
                    type="number"
                    value={isEditing ? editingStockValue : String(item.stock)}
                    onChange={(event) => onUpdateEditingStock(item.id, event.target.value)}
                    onKeyDown={(event) => onKeyDown(event, item.id)}
                    className={cn(
                      "h-8 w-14 rounded-lg px-1 text-center text-sm font-bold shadow-inner focus-visible:ring-[#009E49]",
                      isEditing && "border-[#009E49] bg-[#009E49]/5",
                    )}
                  />

                  {isEditing ? (
                    <Button
                      size="icon"
                      aria-label={`Save stock for ${item.name}`}
                      onClick={() => onSaveStock(item.id)}
                      disabled={isItemSaving}
                      className="h-8 w-8 shrink-0 rounded-lg bg-[#009E49] text-white hover:bg-[#00853d]"
                    >
                      {isItemSaving ? <ArrowUpDown className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-3 border-t border-zinc-100 pt-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-black text-zinc-900">{formatCurrency(item.price)}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${status.bg} ${status.text} ${status.border}`}
                >
                  <status.icon className="h-3 w-3" />
                  {status.label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Decrease stock for ${item.name}`}
                    className="h-10 w-10 shrink-0 rounded-lg text-zinc-500 hover:text-zinc-900"
                    onClick={() => onAdjustStock(item.id, item.stock, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

                  <Input
                    type="number"
                    value={isEditing ? editingStockValue : String(item.stock)}
                    onChange={(event) => onUpdateEditingStock(item.id, event.target.value)}
                    onKeyDown={(event) => onKeyDown(event, item.id)}
                    className={cn(
                      "h-10 w-full rounded-lg px-1 text-center text-sm font-bold shadow-inner focus-visible:ring-[#009E49]",
                      isEditing && "border-[#009E49] bg-[#009E49]/5",
                    )}
                  />

                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Increase stock for ${item.name}`}
                    className="h-10 w-10 shrink-0 rounded-lg text-zinc-500 hover:text-zinc-900"
                    onClick={() => onAdjustStock(item.id, item.stock, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {isEditing ? (
                  <Button
                    size="icon"
                    aria-label={`Save stock for ${item.name}`}
                    onClick={() => onSaveStock(item.id)}
                    disabled={isItemSaving}
                    className="h-10 w-10 shrink-0 rounded-lg bg-[#009E49] text-white hover:bg-[#00853d]"
                  >
                    {isItemSaving ? <ArrowUpDown className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
