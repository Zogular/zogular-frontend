"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CollectionPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function CollectionPagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: CollectionPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Collection pages" className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-9 rounded-lg px-3 text-xs font-bold"
      >
        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Previous
      </Button>
      <p className="text-xs font-semibold text-zinc-500">
        Page <span className="font-black text-zinc-900">{page}</span> of {totalPages}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-9 rounded-lg px-3 text-xs font-bold"
      >
        Next <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
