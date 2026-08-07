import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { AccountChecksList } from "./account-checks-list";

export function MobileAccountChecks({ viewModel }: { viewModel: SellerOnboardingViewModel }) {
  return (
    <section
      className="mx-4 mt-3 scroll-mt-24 rounded-3xl border border-[#E9E1D6] bg-[#FFFCF8] p-4"
      data-onboarding-target="submit"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B8924F]">
        Before you submit
      </p>
      <h2 className="mt-1 text-lg font-black tracking-tight text-[#1F1A14]">Account checks</h2>
      <p className="mt-1 text-xs font-medium leading-5 text-[#6F6A62]">
        Zogular checks your account status automatically. Only unfinished checks need action.
      </p>
      <div className="mt-4">
        <AccountChecksList
          items={viewModel.trustControls}
          accountActive={viewModel.application?.user?.isActive ?? null}
        />
      </div>
    </section>
  );
}
