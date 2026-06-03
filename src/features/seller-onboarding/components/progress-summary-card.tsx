import { Progress } from "@/components/ui/progress";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { StatusBadge } from "./shared/status-badge";

export function ProgressSummaryCard({ viewModel }: { viewModel: SellerOnboardingViewModel }) {
  const { progress, seller } = viewModel;
  return (
    <div className="rounded-[28px] border border-white/70 bg-[#FFFCF8]/90 p-5 shadow-[0_24px_60px_rgba(9,40,28,0.14)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8924F]">Application progress</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-[#1F1A14]">
            {progress.completed}/{progress.total} completed
          </p>
        </div>
        <StatusBadge status={viewModel.canEdit ? "draft" : "pending"} label={viewModel.statusLabel} />
      </div>
      <Progress value={progress.percent} className="mt-5 h-2 bg-[#E9E1D6] [&_[data-slot=progress-indicator]]:bg-[#0EA85B]" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <SummaryStat label="Percent" value={`${progress.percent}%`} />
        <SummaryStat label="Seller type" value={seller.sellerTypeLabel} />
        <SummaryStat label="Remaining" value={progress.remainingLabel} />
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E9E1D6] bg-[#FBF6EE] px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8F6B34]">{label}</p>
      <p className="mt-1 text-xs font-black leading-4 text-[#1F1A14]">{value}</p>
    </div>
  );
}
