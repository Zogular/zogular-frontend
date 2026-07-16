import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductImageUnavailable({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(145deg,#f8fafc,#eef2f3)] text-zinc-500", className)}>
      <div className={cn("flex items-center justify-center rounded-2xl border border-white bg-white/80 shadow-sm", compact ? "h-8 w-8" : "h-14 w-14")}>
        <ImageOff className={compact ? "h-4 w-4" : "h-6 w-6"} />
      </div>
      {!compact ? <span className="mt-3 text-[10px] font-black uppercase tracking-[0.16em]">Image unavailable</span> : null}
    </div>
  );
}
