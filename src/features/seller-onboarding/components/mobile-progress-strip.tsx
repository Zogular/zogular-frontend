import { Progress } from "@/components/ui/progress";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";

export function MobileProgressStrip({ viewModel }: { viewModel: SellerOnboardingViewModel }) {
  const { progress } = viewModel;
  return (
    <section className="px-4 py-4">
      <div className="rounded-3xl border border-[#E9E1D6] bg-[#FFFCF8] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-[#1F1A14]">{progress.percent}% complete</p>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8F6B34]">{progress.remainingLabel}</p>
        </div>
        <Progress value={progress.percent} className="mt-3 h-2 bg-[#E9E1D6] [&_[data-slot=progress-indicator]]:bg-[#0EA85B]" />
      </div>
    </section>
  );
}
