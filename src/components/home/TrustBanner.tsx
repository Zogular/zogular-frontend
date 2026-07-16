"use client";

import {
  Headphones,
  ReceiptText,
  ShieldCheck,
  Truck,
} from "lucide-react";

type TrustItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  colorClass: string;
  bgClass: string;
};

const TRUST_ITEMS: TrustItem[] = [
  {
    id: "manual-delivery",
    icon: Truck,
    title: "Lusaka Pilot Delivery",
    subtitle: "Manual dispatch and timing confirmation",
    colorClass: "text-[#FF6B00]",
    bgClass: "bg-[#FF6B00]/10",
  },
  {
    id: "secure-payments",
    icon: ShieldCheck,
    title: "Backend-Quoted Totals",
    subtitle: "Checkout amounts confirmed before order",
    colorClass: "text-[#009E49]",
    bgClass: "bg-[#009E49]/10",
  },
  {
    id: "flexible-options",
    icon: ReceiptText,
    title: "Cash on Delivery",
    subtitle: "COD is the live MVP payment method",
    colorClass: "text-blue-600",
    bgClass: "bg-blue-500/10",
  },
  {
    id: "local-support",
    icon: Headphones,
    title: "Support Options",
    subtitle: "Help centre and account support paths",
    colorClass: "text-purple-600",
    bgClass: "bg-purple-500/10",
  },
];

function TrustBannerCard({ item }: { item: TrustItem }) {
  const Icon = item.icon;

  return (
    <div className="group flex cursor-default flex-col items-start gap-3 p-2 md:flex-row md:items-center md:gap-4 transition-all duration-300 hover:bg-white/60">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-110 group-hover:shadow-md md:h-12 md:w-12 ${item.bgClass} ${item.colorClass}`}
      >
        <Icon className="h-5 w-5 md:h-6 md:w-6" />
      </div>

      <div>
        <h4 className="text-sm font-bold leading-tight text-zinc-900 md:text-base">
          {item.title}
        </h4>
        <p className="mt-0.5 text-[10px] font-medium text-zinc-500 md:text-xs">
          {item.subtitle}
        </p>
      </div>
    </div>
  );
}

export function TrustBanner() {
  return (
    <section className="container mx-auto max-w-7xl px-4 pb-4 pt-6 md:px-6 md:pt-10">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/60 bg-white/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-2xl md:rounded-3xl md:p-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-10 top-0 h-full w-40 bg-emerald-200/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-full w-40 bg-orange-200/20 blur-3xl" />
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4 md:gap-8 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <TrustBannerCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
