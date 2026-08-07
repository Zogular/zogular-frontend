import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OptionCardState, StatusBadgeTone } from "../../types/seller-onboarding.types";
import { StatusBadge } from "./status-badge";

const stateToStatus: Record<OptionCardState, StatusBadgeTone> = {
  selected: "selected",
  default: "pending",
  disabled: "comingSoon",
};

export function OptionCard({
  title,
  description,
  statusLabel,
  state = "default",
  icon,
  onClick,
}: {
  title: string;
  description: string;
  statusLabel?: string;
  state?: OptionCardState;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const disabled = state === "disabled";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full min-w-0 rounded-2xl md:rounded-3xl border p-3 md:p-4 text-left transition-all cursor-pointer select-none",
        state === "selected"
          ? "border-[#0EA85B]/40 bg-[#E9F8EF] shadow-sm"
          : "border-[#E9E1D6] bg-[#FFFCF8] hover:border-[#D8C9B8] hover:bg-white",
        disabled && "cursor-not-allowed border-dashed bg-[#FBF6EE] opacity-75 hover:bg-[#FBF6EE]",
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon ? (
            <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl md:rounded-2xl border border-white bg-white/80 text-[#0B3425] shadow-sm">
              {icon}
            </div>
          ) : null}
          <h3 className="text-xs md:text-sm font-black text-[#1F1A14] truncate">{title}</h3>
        </div>
        <StatusBadge status={stateToStatus[state]} label={statusLabel} className="shrink-0 text-[9px] md:text-[10px]" />
      </div>
      <p className="mt-1.5 hidden md:block text-xs font-medium leading-4 text-[#6F6A62]">{description}</p>
    </button>
  );
}
