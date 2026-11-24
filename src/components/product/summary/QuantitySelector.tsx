import * as React from "react";
import { Minus, Plus } from "lucide-react";

export function QuantitySelector({
  value,
  onDecrease,
  onIncrease,
  disabled = false,
  max,
  size = "default",
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
  max?: number;
  size?: "default" | "touch";
}) {
  const decreaseDisabled = disabled || value <= 1;
  const increaseDisabled = disabled || (typeof max === "number" && value >= max);

  if (size === "touch") {
    return (
      <div className="flex h-11 min-h-[44px] shrink-0 items-center rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={onDecrease}
          disabled={decreaseDisabled}
          title="Decrease quantity"
          aria-label="Decrease quantity"
          className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#009E49] disabled:cursor-not-allowed disabled:text-zinc-300"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex h-11 min-w-[28px] shrink-0 items-center justify-center px-1 text-[13px] font-bold tabular-nums text-zinc-900">
          {value}
        </div>
        <button
          type="button"
          onClick={onIncrease}
          disabled={increaseDisabled}
          title="Increase quantity"
          aria-label="Increase quantity"
          className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#009E49] disabled:cursor-not-allowed disabled:text-zinc-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[38px] w-full items-center rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:min-h-12 md:rounded-xl md:shadow-sm">
      <button type="button" onClick={onDecrease} disabled={decreaseDisabled} title="Decrease quantity" aria-label="Decrease quantity" className="relative flex h-full min-w-7 flex-1 items-center justify-center text-zinc-500 transition-colors before:absolute before:-inset-y-[3px] before:inset-x-0 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300">
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex h-full min-w-[28px] shrink-0 items-center justify-center text-[13px] font-bold text-zinc-900">{value}</div>
      <button type="button" onClick={onIncrease} disabled={increaseDisabled} title="Increase quantity" aria-label="Increase quantity" className="relative flex h-full min-w-7 flex-1 items-center justify-center text-zinc-500 transition-colors before:absolute before:-inset-y-[3px] before:inset-x-0 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
