import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";

export function SellerOnboardingNotice({
  viewModel,
  onContinue,
}: {
  viewModel: SellerOnboardingViewModel;
  onContinue: () => void;
}) {
  return (
    <section className="mb-5 flex flex-col gap-4 rounded-[24px] border border-[#E9E1D6] bg-[#FFFCF8] px-5 py-4 shadow-[0_12px_36px_rgba(31,26,20,0.05)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E9F8EF] text-[#0A7A42]">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-[#1F1A14]">{viewModel.statusMessage}</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-[#6F6A62]">
            {viewModel.submitDisabledReason}
          </p>
        </div>
      </div>
      <Button type="button" onClick={onContinue} className="h-10 shrink-0 rounded-2xl bg-[#0EA85B] px-4 font-black text-white hover:bg-[#0B8E4D]">
        Continue application
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </section>
  );
}
