import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { SellerOnboardingDocumentConfig, SellerOnboardingFormValues, SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { ApplicationMainColumn } from "./application-main-column";
import { ApplicationReviewRail } from "./application-review-rail";

export function SellerApplicationWorkspace({
  viewModel,
  register,
  errors,
  watch,
  setValue,
  disabled,
  uploadingDocuments,
  onSelectDocument,
  onSave,
  onSubmit,
  saving,
  submitting,
  uploading,
}: {
  viewModel: SellerOnboardingViewModel;
  register: UseFormRegister<SellerOnboardingFormValues>;
  errors: FieldErrors<SellerOnboardingFormValues>;
  watch: UseFormWatch<SellerOnboardingFormValues>;
  setValue: UseFormSetValue<SellerOnboardingFormValues>;
  disabled?: boolean;
  uploadingDocuments: Partial<Record<SellerOnboardingDocumentConfig["key"], { uploading: boolean; progress: number; error?: string }>>;
  onSelectDocument: (config: SellerOnboardingDocumentConfig, file: File | null) => void;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
  uploading: boolean;
}) {
  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)_380px] gap-6">
      <ApplicationMainColumn
        viewModel={viewModel}
        register={register}
        errors={errors}
        watch={watch}
        setValue={setValue}
        disabled={disabled}
        uploadingDocuments={uploadingDocuments}
        onSelectDocument={onSelectDocument}
      />
      <ApplicationReviewRail
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
