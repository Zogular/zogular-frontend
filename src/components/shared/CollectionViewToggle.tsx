"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CollectionViewMode = "list" | "grid";

interface CollectionViewToggleProps {
  className?: string;
  value: CollectionViewMode;
  onChange: (value: CollectionViewMode) => void;
  compactLabel?: string;
}

export function CollectionViewToggle({
  className,
  value,
  onChange,
  compactLabel = "View",
}: CollectionViewToggleProps) {
  return (
    <div className={cn("flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-1", className)}>
      <span className="pl-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {compactLabel}
      </span>
      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          variant={value === "list" ? "default" : "ghost"}
          onClick={() => onChange("list")}
          className={cn(
            "h-8 rounded-xl px-3 text-[11px] font-black",
            value === "list"
              ? "bg-zinc-950 text-white hover:bg-zinc-900"
              : "text-zinc-600 hover:bg-white",
          )}
        >
          <Rows3 className="mr-1.5 h-3.5 w-3.5" />
          List
        </Button>
        <Button
          type="button"
          variant={value === "grid" ? "default" : "ghost"}
          onClick={() => onChange("grid")}
          className={cn(
            "h-8 rounded-xl px-3 text-[11px] font-black",
            value === "grid"
              ? "bg-zinc-950 text-white hover:bg-zinc-900"
              : "text-zinc-600 hover:bg-white",
          )}
        >
          <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
          Grid
        </Button>
      </div>
    </div>
  );
}
