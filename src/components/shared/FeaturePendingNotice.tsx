import { AlertTriangle, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BACKEND_INTEGRATION_PENDING_MESSAGE,
  OPERATIONS_PREVIEW_MESSAGE,
} from "@/services/backend-pending";

type FeaturePendingNoticeProps = {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
};

export function BackendPendingBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800",
        className,
      )}
    >
      <LockKeyhole className="h-3 w-3" />
      Backend pending
    </span>
  );
}

export function FeaturePendingNotice({
  title = "Backend integration pending",
  description = OPERATIONS_PREVIEW_MESSAGE,
  className,
  compact = false,
}: FeaturePendingNoticeProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-200/80 bg-amber-50/80 text-amber-950 shadow-sm shadow-amber-900/5",
        compact ? "px-3 py-2" : "p-4",
        className,
      )}
    >
      <div className={cn("flex gap-2.5", compact ? "items-start" : "items-center")}>
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={cn("font-black", compact ? "text-[11px]" : "text-sm")}>{title}</p>
          <p className={cn("font-semibold leading-relaxed text-amber-800/85", compact ? "mt-0.5 text-[10px]" : "mt-1 text-xs")}>
            {description || BACKEND_INTEGRATION_PENDING_MESSAGE}
          </p>
        </div>
      </div>
    </div>
  );
}
