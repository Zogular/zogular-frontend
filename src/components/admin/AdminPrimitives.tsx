"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type AdminTone = "emerald" | "amber" | "indigo" | "rose" | "zinc" | "sky" | "orange";

const toneClasses: Record<AdminTone, { card: string; icon: string; badge: string }> = {
  emerald: {
    card: "border-emerald-200/70 from-white via-emerald-50/70 to-emerald-100/60 text-emerald-700",
    icon: "bg-emerald-600 text-white shadow-emerald-900/20",
    badge: "border-emerald-400/50 bg-emerald-950 text-emerald-100",
  },
  amber: {
    card: "border-amber-200/70 from-white via-amber-50/70 to-orange-100/60 text-amber-700",
    icon: "bg-amber-500 text-white shadow-amber-900/20",
    badge: "border-amber-400/50 bg-amber-950 text-amber-100",
  },
  indigo: {
    card: "border-indigo-200/70 from-white via-indigo-50/70 to-sky-100/60 text-indigo-700",
    icon: "bg-indigo-600 text-white shadow-indigo-900/20",
    badge: "border-indigo-400/50 bg-indigo-950 text-indigo-100",
  },
  rose: {
    card: "border-rose-200/70 from-white via-rose-50/70 to-red-100/60 text-rose-700",
    icon: "bg-rose-600 text-white shadow-rose-900/20",
    badge: "border-rose-400/50 bg-rose-950 text-rose-100",
  },
  zinc: {
    card: "border-zinc-200/70 from-white via-zinc-50 to-zinc-100 text-zinc-700",
    icon: "bg-zinc-950 text-white shadow-zinc-900/20",
    badge: "border-zinc-500/50 bg-zinc-900 text-zinc-100",
  },
  sky: {
    card: "border-sky-200/70 from-white via-sky-50/70 to-cyan-100/60 text-sky-700",
    icon: "bg-sky-600 text-white shadow-sky-900/20",
    badge: "border-sky-400/50 bg-sky-950 text-sky-100",
  },
  orange: {
    card: "border-orange-200/70 from-white via-orange-50/70 to-amber-100/60 text-orange-700",
    icon: "bg-orange-600 text-white shadow-orange-900/20",
    badge: "border-orange-400/50 bg-orange-950 text-orange-100",
  },
};

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm font-medium text-zinc-500">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminMetricCard({
  title,
  value,
  note,
  icon,
  tone = "zinc",
}: {
  title: string;
  value: string | number;
  note: string;
  icon: ReactNode;
  tone?: AdminTone;
}) {
  return (
    <div className={cn("rounded-2xl sm:rounded-3xl border bg-linear-to-br p-4 sm:p-5 shadow-md shadow-zinc-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg", toneClasses[tone].card)}>
      <div className="mb-3 flex items-start justify-between gap-2 sm:gap-3">
        <p className="text-[9px] sm:text-[10px] leading-snug font-black uppercase tracking-wider text-zinc-600">{title}</p>
        <div className={cn("flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl shadow-md sm:shadow-lg [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5", toneClasses[tone].icon)}>
          {icon}
        </div>
      </div>
      <h3 className="text-2xl sm:text-3xl font-black text-zinc-950">{value}</h3>
      <p className="mt-1 text-[10px] sm:text-xs font-bold text-current">{note}</p>
    </div>
  );
}

export function AdminStatusBadge({
  children,
  tone = "zinc",
  className,
}: {
  children: ReactNode;
  tone?: AdminTone;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", toneClasses[tone].badge, className)}>
      {children}
    </span>
  );
}

export function AdminSearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner transition-all hover:bg-white focus-visible:ring-zinc-900"
      />
    </div>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/75 p-2 shadow-md shadow-zinc-900/5 backdrop-blur-xl sm:gap-3 sm:rounded-3xl sm:p-4 md:flex-row md:items-center">
      {children}
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="p-12 text-center">
      <p className="text-sm font-black text-zinc-600">{title}</p>
      {description ? <p className="mt-1 text-xs font-medium text-zinc-500">{description}</p> : null}
    </div>
  );
}

export function AdminDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  contentClassName,
  bodyClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  contentClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("w-full border-l border-white/40 bg-white/95 p-0 shadow-2xl shadow-zinc-950/20 backdrop-blur-2xl sm:max-w-xl", contentClassName)}>
        <SheetHeader className="border-b border-zinc-100 bg-zinc-950 px-6 py-5 text-white">
          <SheetTitle className="text-lg font-black text-white">{title}</SheetTitle>
          <SheetDescription className="text-xs font-bold text-zinc-400">{description}</SheetDescription>
        </SheetHeader>
        <div className={cn("flex-1 overflow-y-auto p-6", bodyClassName)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
