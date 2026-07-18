import type { LucideIcon } from "lucide-react";
import { AlertCircle, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollectionStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  tone?: "neutral" | "error";
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function CollectionState({
  title,
  description,
  icon: Icon = PackageSearch,
  tone = "neutral",
  action,
  className,
}: CollectionStateProps) {
  const isError = tone === "error";

  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-2xl border px-6 py-12 text-center",
        isError ? "border-red-200 bg-red-50/70" : "border-zinc-200 bg-white",
        className,
      )}
      role={isError ? "alert" : "status"}
    >
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", isError ? "bg-red-100 text-red-600" : "bg-zinc-100 text-zinc-500")}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className={cn("mt-4 text-base font-black", isError ? "text-red-950" : "text-zinc-950")}>{title}</h2>
      <p className={cn("mt-1 max-w-md text-sm leading-6", isError ? "text-red-700" : "text-zinc-500")}>{description}</p>
      {action ? (
        <Button
          type="button"
          variant="outline"
          onClick={action.onClick}
          className={cn("mt-4 h-9 rounded-lg text-xs font-bold", isError && "border-red-200 text-red-700 hover:bg-red-100")}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function CollectionErrorState(props: Omit<CollectionStateProps, "icon" | "tone">) {
  return <CollectionState {...props} icon={AlertCircle} tone="error" />;
}
