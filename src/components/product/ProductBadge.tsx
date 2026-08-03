import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function getProductBadgeClasses(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("discount") || normalized.includes("sale") || normalized.includes("off") || normalized.includes("%")) {
    return "border-zinc-800 bg-zinc-900 text-white font-bold";
  }
  if (normalized.includes("new arrival") || normalized === "new") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold";
  }
  if (normalized.includes("best deal") || normalized.includes("deal")) {
    return "border-amber-200 bg-amber-50 text-amber-800 font-bold";
  }
  if (normalized.includes("trending") || normalized.includes("popular")) {
    return "border-violet-200 bg-violet-50 text-violet-700 font-bold";
  }
  if (normalized.includes("limited") || normalized.includes("scarcity")) {
    return "border-rose-200 bg-rose-50 text-rose-700 font-bold";
  }
  if (normalized.includes("low stock") || normalized.includes("left")) {
    return "border-orange-200 bg-orange-50 text-orange-700 font-bold";
  }
  if (normalized.includes("out of stock")) {
    return "border-zinc-200 bg-zinc-100 text-zinc-600 font-medium";
  }

  return "border-zinc-200 bg-zinc-100 text-zinc-800 font-bold";
}

export function ProductBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm backdrop-blur-md",
        getProductBadgeClasses(label),
        className,
      )}
    >
      {label}
    </Badge>
  );
}
