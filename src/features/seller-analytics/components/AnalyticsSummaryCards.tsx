import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, widthClass } from "../utils/analytics-utils";

export function StatCard({
  title,
  value,
  growth,
  icon: Icon,
  isCurrency = false,
  inverseGrowth = false,
  colorClass = "bg-white border-zinc-200/80 text-zinc-900",
}: {
  title: string;
  value: number;
  growth?: number;
  icon: React.ComponentType<{ className?: string }>;
  isCurrency?: boolean;
  inverseGrowth?: boolean;
  colorClass?: string;
}) {
  const isPositive = growth !== undefined && growth > 0;
  const isGood = inverseGrowth ? !isPositive : isPositive;

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md", colorClass)}>
      <div className="mb-2 flex items-center justify-between opacity-80">
        <p className="text-[10px] font-bold uppercase tracking-wider">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-xl font-black md:text-2xl">
        {isCurrency ? formatCurrency(value) : formatNumber(value)}
        {title.includes("Rate") ? "%" : ""}
      </h3>
      {growth !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          <span className={cn("flex items-center rounded-sm px-1 py-0.5 text-[10px] font-bold", isGood ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
            {isPositive ? <ArrowUpRight className="mr-0.5 h-3 w-3" /> : <ArrowDownRight className="mr-0.5 h-3 w-3" />}
            {Math.abs(Number(growth.toFixed(1)))}%
          </span>
          <span className="text-[9px] font-medium opacity-70">vs prev.</span>
        </div>
      )}
    </div>
  );
}

export function ProgressBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-zinc-700">{label}</span>
        <span className="text-zinc-900">
          {formatNumber(value)} <span className="text-[10px] font-medium text-zinc-400">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-full rounded-full", colorClass, widthClass(percentage))} />
      </div>
    </div>
  );
}
