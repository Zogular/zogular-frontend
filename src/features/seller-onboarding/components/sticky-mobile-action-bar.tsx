import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";

export function StickyMobileActionBar({
  viewModel,
  onSave,
  onSubmit,
  saving,
  submitting,
  uploading,
}: {
  viewModel: SellerOnboardingViewModel;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
  uploading: boolean;
}) {
  const submitDisabled = !viewModel.canSubmit || saving || submitting || uploading;

  return (
    <div className="mt-5 border-t border-[#E9E1D6] bg-[#FFFCF8]/95 px-4 pb-5 pt-3 shadow-[0_-16px_40px_rgba(31,26,20,0.08)] backdrop-blur lg:hidden">
      <p className="mb-3 text-center text-xs font-bold text-[#6F6A62]">{viewModel.submitDisabledReason}</p>
      <div className="grid grid-cols-[1fr_1.2fr] gap-3">
        <Button type="button" onClick={onSave} disabled={saving || submitting || uploading || !viewModel.canEdit} variant="outline" className="h-11 rounded-2xl border-[#D8C9B8] bg-white font-black text-[#1F1A14]">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" onClick={onSubmit} disabled={submitDisabled} className="h-11 rounded-2xl bg-[#09281C] font-black text-white opacity-100 disabled:bg-[#09281C]/35">
          <Send className="mr-2 h-4 w-4" />
          {submitting ? "Sending..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}
