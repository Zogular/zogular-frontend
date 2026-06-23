import { cn } from "@/lib/utils";

export const SettingsToggleSwitch = ({
  active,
  onClick,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <div
    onClick={() => !disabled && onClick()}
    className={cn(
      "relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      active ? "border-[#009E49] bg-[#009E49]" : "border-zinc-200 bg-zinc-100",
    )}
  >
    <div
      className={cn(
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300",
        active ? "translate-x-5" : "translate-x-0.5",
      )}
    />
  </div>
);
