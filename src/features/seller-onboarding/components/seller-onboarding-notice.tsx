import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";

export function SellerOnboardingNotice({
  viewModel,
  onContinue,
}: {
  viewModel: SellerOnboardingViewModel;
  onContinue: () => void;
}) {
  const isNeedsInfo = viewModel.status === "NEEDS_INFO";

  if (isNeedsInfo) {
    return (
      <section className="mb-5 rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 shadow-[0_12px_36px_rgba(31,26,20,0.05)]">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">
              Admin requested updates
            </p>
            <h2 className="mt-1 text-sm font-black text-[#1F1A14]">
              Your application needs changes before it can be reviewed.
            </h2>
            {viewModel.needsInfoReason ? (
              <div className="mt-3 rounded-2xl border border-amber-200/70 bg-white/80 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
                  What to fix
                </p>
                <p className="mt-1.5 text-sm font-semibold leading-6 text-[#1F1A14]">
                  {viewModel.needsInfoReason}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm font-medium leading-5 text-[#6F6A62]">
                Please update the requested details and resubmit your application.
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={onContinue} className="h-10 shrink-0 rounded-2xl bg-[#0EA85B] px-4 font-black text-white hover:bg-[#0B8E4D]">
            Update application
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
    );
  }

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
