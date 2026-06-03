import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { SellerOnboardingDocumentConfig, SellerOnboardingFormValues, SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { MobileApplicationAccordion } from "./mobile-application-accordion";
import { MobileHero } from "./mobile-hero";
import { MobileProgressStrip } from "./mobile-progress-strip";
import { StickyMobileActionBar } from "./sticky-mobile-action-bar";

export function MobileSellerApplication({
  viewModel,
  register,
  errors,
  watch,
  setValue,
  disabled,
  openSection,
  onOpenSectionChange,
  uploadingDocuments,
  onSelectDocument,
  onContinue,
  onSave,
  onSubmit,
  saving,
  submitting,
  uploading,
  menuOpen,
  onToggleMenu,
}: {
  viewModel: SellerOnboardingViewModel;
  register: UseFormRegister<SellerOnboardingFormValues>;
  errors: FieldErrors<SellerOnboardingFormValues>;
  watch: UseFormWatch<SellerOnboardingFormValues>;
  setValue: UseFormSetValue<SellerOnboardingFormValues>;
  disabled?: boolean;
  openSection: string;
  onOpenSectionChange: (value: string) => void;
  uploadingDocuments: Partial<Record<SellerOnboardingDocumentConfig["key"], { uploading: boolean; progress: number; error?: string }>>;
  onSelectDocument: (config: SellerOnboardingDocumentConfig, file: File | null) => void;
  onContinue: () => void;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
  uploading: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F7F4EE] pb-28 lg:hidden">
      <MobileHero
        viewModel={viewModel}
        onContinue={onContinue}
        menuOpen={menuOpen}
        onToggleMenu={onToggleMenu}
      />
      <MobileProgressStrip viewModel={viewModel} />
      <MobileApplicationAccordion
        viewModel={viewModel}
        register={register}
        errors={errors}
        watch={watch}
        setValue={setValue}
        disabled={disabled}
        openSection={openSection}
        onOpenSectionChange={onOpenSectionChange}
        uploadingDocuments={uploadingDocuments}
        onSelectDocument={onSelectDocument}
      />
      <StickyMobileActionBar
        viewModel={viewModel}
        onSave={onSave}
        onSubmit={onSubmit}
        saving={saving}
        submitting={submitting}
        uploading={uploading}
      />
    </div>
  );
}
