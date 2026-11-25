import { CheckCircle2, Clock, Truck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/order";

const STATUS_PRESENTATION = {
  processing: { label: "Processing", icon: Clock, color: "bg-amber-100 text-amber-700" },
  shipped: { label: "In Transit", icon: Truck, color: "bg-blue-100 text-blue-700" },
  delivered: { label: "Delivered", icon: CheckCircle2, color: "bg-[#009E49]/10 text-[#009E49]" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-100 text-red-700" },
} satisfies Record<OrderStatus, { label: string; icon: typeof Clock; color: string }>;

export function BuyerOrderStatusBadge({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  const { label, icon: Icon, color } = STATUS_PRESENTATION[status];

  return (
    <Badge className={cn("border-none shadow-none", compact ? "mt-1" : "gap-1.5 px-3 py-1", color)}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
