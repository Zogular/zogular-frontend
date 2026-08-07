import { ArrowRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";

export function MobileHero({
  viewModel,
  onContinue,
  menuOpen,
  onToggleMenu,
}: {
  viewModel: SellerOnboardingViewModel;
  onContinue: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <section className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo mode="icon" variant="light" imageClassName="h-9 w-9 rounded-2xl" />
          <div>
            <p className="text-sm font-black text-[#1F1A14]">Seller Hub</p>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8F6B34]">{viewModel.statusLabel}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          title={menuOpen ? "Close menu" : "Open menu"}
          className="h-10 w-10 rounded-2xl border border-[#E9E1D6] bg-[#FFFCF8] text-[#1F1A14] shadow-none hover:bg-white"
        >
          {menuOpen ? <PanelLeftClose className="h-4.5 w-4.5" /> : <PanelLeftOpen className="h-4.5 w-4.5" />}
        </Button>
      </div>
      <div className="rounded-[30px] border border-[#E9E1D6] bg-[linear-gradient(135deg,#FFFCF8,#F5EAD5)] p-5 shadow-[0_22px_55px_rgba(31,26,20,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-[#1F1A14]">Complete your seller application</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6F6A62]">
              {viewModel.nextStep}
            </p>
          </div>
          <div className="rounded-2xl bg-[#09281C] px-3 py-2 text-center text-white">
            <p className="text-lg font-black">{viewModel.progress.completed}/{viewModel.progress.total}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#BDE5CC]">Ready</p>
          </div>
        </div>
        <Button type="button" onClick={onContinue} className="mt-5 h-11 w-full rounded-2xl bg-[#0EA85B] font-black text-white hover:bg-[#0B8E4D]">
          {viewModel.canEdit ? "Continue" : "View status"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
