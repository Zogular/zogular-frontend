import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DiscoverySectionHeaderProps = {
  title: string;
  description?: string;
  action?: {
    href: string;
    label: string;
  };
  className?: string;
};

export function DiscoverySectionHeader({
  title,
  description,
  action,
  className,
}: DiscoverySectionHeaderProps) {
  return (
    <header className={cn("flex min-w-0 items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-black tracking-tight text-zinc-950 sm:text-xl">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-600">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-[#007d3a] outline-none transition-colors hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </header>
  );
}
