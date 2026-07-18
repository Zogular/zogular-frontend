"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface CollectionFilterSheetProps {
  title: string;
  description: string;
  activeCount?: number;
  children: ReactNode;
}

export function CollectionFilterSheet({
  title,
  description,
  activeCount = 0,
  children,
}: CollectionFilterSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={activeCount > 0 ? `Open filters, ${activeCount} active` : "Open filters"}
          title="Filters"
          className="relative h-9 w-9 rounded-lg border-zinc-200 bg-white"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {activeCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#009E49] px-1 text-[9px] font-black text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85svh] rounded-t-3xl border-zinc-200 bg-white p-0">
        <SheetHeader className="border-b border-zinc-100 px-5 pb-4 pt-5 text-left">
          <SheetTitle className="text-lg font-black text-zinc-950">{title}</SheetTitle>
          <SheetDescription className="text-sm text-zinc-500">{description}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
