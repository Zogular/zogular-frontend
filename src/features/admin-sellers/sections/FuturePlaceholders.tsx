import { BarChart3, Package, Wallet } from "lucide-react";

export function FuturePlaceholders() {
  return (
    <div className="space-y-3">
      <PlaceholderCard
        icon={Package}
        title="Products"
        note="Available after seller starts listing."
      />
      <PlaceholderCard
        icon={BarChart3}
        title="Orders"
        note="Available after seller starts trading."
      />
      <PlaceholderCard
        icon={Wallet}
        title="Wallet and payouts"
        note="Available after seller starts trading."
      />
    </div>
  );
}

function PlaceholderCard({
  icon: Icon,
  title,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-stone-200/80 bg-stone-50/40 px-3.5 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black text-stone-500">{title}</p>
        <p className="mt-0.5 text-[10px] font-medium text-stone-400">{note}</p>
      </div>
    </div>
  );
}
