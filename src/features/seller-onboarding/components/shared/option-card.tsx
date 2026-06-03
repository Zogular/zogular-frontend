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
        "min-h-35 rounded-3xl border p-4 text-left transition-all",
        state === "selected"
          ? "border-[#0EA85B]/45 bg-[#E9F8EF] shadow-[0_18px_42px_rgba(14,168,91,0.12)]"
          : "border-[#E9E1D6] bg-[#FFFCF8] hover:border-[#D8C9B8] hover:bg-white",
        disabled && "cursor-not-allowed border-dashed bg-[#FBF6EE] opacity-75 hover:bg-[#FBF6EE]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white bg-white/80 text-[#0B3425] shadow-sm">
            {icon}
          </div>
        ) : null}
        <StatusBadge status={stateToStatus[state]} label={statusLabel} className="shrink-0" />
      </div>
      <h3 className="mt-4 text-sm font-black text-[#1F1A14]">{title}</h3>
      <p className="mt-2 text-xs font-medium leading-5 text-[#6F6A62]">{description}</p>
    </button>
  );
}
