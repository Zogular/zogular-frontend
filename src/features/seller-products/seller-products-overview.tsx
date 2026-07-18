import { AlertTriangle, CheckCircle2, FileEdit, Layers, XCircle } from "lucide-react";
import type { SellerProductsSummary } from "@/features/seller-products/types";

interface SellerProductsOverviewProps {
  summary: SellerProductsSummary;
}

export function SellerProductsOverview({ summary }: SellerProductsOverviewProps) {
  const metrics = [
    { label: "Total", value: summary.total, icon: Layers, tone: "text-zinc-700 bg-zinc-100" },
    { label: "Buyer visible", value: summary.buyerVisible, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Pending", value: summary.pendingReview, icon: FileEdit, tone: "text-blue-700 bg-blue-50" },
    { label: "Low stock", value: summary.lowStock, icon: AlertTriangle, tone: "text-amber-700 bg-amber-50" },
    { label: "Out of stock", value: summary.outOfStock, icon: XCircle, tone: "text-red-700 bg-red-50" },
  ] as const;

  return (
    <section aria-label="Product summary" className="grid grid-cols-2 gap-2 xl:grid-cols-5">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className={`flex min-h-15 items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 ${index === metrics.length - 1 ? "col-span-2 xl:col-span-1" : ""}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-500">{metric.label}</p>
              <p className="text-lg font-black leading-5 text-zinc-950">{metric.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
