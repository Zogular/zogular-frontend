import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { SellerOnboardingDocumentConfig, SellerOnboardingFormValues, SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { ComplianceSection } from "./sections/compliance-section";
import { IdentitySection } from "./sections/identity-section";
import { OperatingModelSection } from "./sections/operating-model-section";
import { SettlementSection } from "./sections/settlement-section";
import { StoreFootprintSection } from "./sections/store-footprint-section";

export function ApplicationMainColumn({
  viewModel,
  register,
  errors,
  watch,
  setValue,
  disabled,
  uploadingDocuments,
  onSelectDocument,
}: {
  viewModel: SellerOnboardingViewModel;
  register: UseFormRegister<SellerOnboardingFormValues>;
  errors: FieldErrors<SellerOnboardingFormValues>;
  watch: UseFormWatch<SellerOnboardingFormValues>;
  setValue: UseFormSetValue<SellerOnboardingFormValues>;
  disabled?: boolean;
  uploadingDocuments: Partial<Record<SellerOnboardingDocumentConfig["key"], { uploading: boolean; progress: number; error?: string }>>;
  onSelectDocument: (config: SellerOnboardingDocumentConfig, file: File | null) => void;
}) {
  return (
    <div className="space-y-5">
      <OperatingModelSection viewModel={viewModel} watch={watch} setValue={setValue} disabled={disabled} />
      <IdentitySection viewModel={viewModel} register={register} errors={errors} watch={watch} disabled={disabled} />
      <StoreFootprintSection viewModel={viewModel} register={register} errors={errors} disabled={disabled} />
      <ComplianceSection
        viewModel={viewModel}
        register={register}
        errors={errors}
        watch={watch}
        disabled={disabled}
        uploadingDocuments={uploadingDocuments}
        onSelectDocument={onSelectDocument}
      />
      <SettlementSection viewModel={viewModel} register={register} errors={errors} watch={watch} setValue={setValue} disabled={disabled} />
    </div>
  );
}
