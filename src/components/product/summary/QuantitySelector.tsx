import * as React from "react";
import { Minus, Plus } from "lucide-react";

export function QuantitySelector({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex h-12 items-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button type="button" onClick={onDecrease} title="Decrease quantity" aria-label="Decrease quantity" className="flex h-full w-12 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900">
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex h-full min-w-12 items-center justify-center text-sm font-bold text-zinc-900">{value}</div>
      <button type="button" onClick={onIncrease} title="Increase quantity" aria-label="Increase quantity" className="flex h-full w-12 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
