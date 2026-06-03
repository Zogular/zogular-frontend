import { cn } from "@/lib/utils";
import type { StatusBadgeTone } from "../../types/seller-onboarding.types";

const statusLabels: Record<StatusBadgeTone, string> = {
  ready: "Ready",
  verified: "Verified",
  pending: "Pending",
  draft: "Draft",
  missing: "Missing",
  selected: "Selected",
  active: "Active",
  comingSoon: "Coming soon",
  completed: "Completed",
};

const statusClasses: Record<StatusBadgeTone, string> = {
  ready: "bg-[#E9F8EF] text-[#0A7A42]",
  verified: "bg-[#E9F8EF] text-[#0A7A42]",
  active: "bg-[#E9F8EF] text-[#0A7A42]",
  selected: "bg-[#E9F8EF] text-[#0A7A42]",
  completed: "bg-[#E9F8EF] text-[#0A7A42]",
  pending: "bg-[#F5EAD5] text-[#8A6528]",
  draft: "bg-[#EFE8DD] text-[#6F6255]",
  missing: "bg-[#FBE9E4] text-[#A5442E]",
  comingSoon: "bg-[#EFE8DD] text-[#8A6528]",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusBadgeTone;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[10px] font-black uppercase tracking-[0.16em]",
        statusClasses[status],
        className,
      )}
    >
      {label ?? statusLabels[status]}
    </span>
  );
}
