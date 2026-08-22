import { ShieldCheck } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { getSellerDocumentAccess } from "@/services/seller-document-uploads";
import { sellerOnboardingClasses } from "../../constants/seller-onboarding-ui";
import type { SellerOnboardingDocumentConfig, SellerOnboardingFormValues, SellerOnboardingViewModel } from "../../types/seller-onboarding.types";
import { ApplicationSectionCard } from "../shared/application-section-card";
import { FormField } from "../shared/form-field";
import { UploadTile } from "../shared/upload-tile";

export function ComplianceSection({
  viewModel,
  register,
  errors,
  watch,
  disabled,
  uploadingDocuments,
  onSelectDocument,
}: {
  viewModel: SellerOnboardingViewModel;
  register: UseFormRegister<SellerOnboardingFormValues>;
  errors: FieldErrors<SellerOnboardingFormValues>;
  watch: UseFormWatch<SellerOnboardingFormValues>;
  disabled?: boolean;
  uploadingDocuments: Partial<Record<SellerOnboardingDocumentConfig["key"], { uploading: boolean; progress: number; error?: string }>>;
  onSelectDocument: (config: SellerOnboardingDocumentConfig, file: File | null) => void;
}) {
  const section = viewModel.sections.compliance;
  const sellerType = watch("sellerType");
  const documents = Object.values(viewModel.documents).filter((document) =>
    document.key === "pacraDocument" ? sellerType === "REGISTERED_BUSINESS" : true,
  );
  const documentErrors: Partial<Record<SellerOnboardingDocumentConfig["key"], string>> = {
    nrcFront: errors.nrcFrontUrl?.message,
    nrcBack: errors.nrcBackUrl?.message,
    shopPhoto: errors.shopPhotoUrl?.message,
    pacraDocument: errors.pacraDocumentUrl?.message,
  };

  return (
    <ApplicationSectionCard
      id={section.id}
      title={section.title}
      eyebrow={section.eyebrow}
      description={section.description}
      icon={<ShieldCheck className="h-5 w-5" />}
      status={section.status}
    >
      <div className="grid gap-4">
        <FormField label="NRC number" required error={errors.nrcNumber?.message}>
          <Input className={sellerOnboardingClasses.input} placeholder="123456/78/9" disabled={disabled} {...register("nrcNumber")} />
        </FormField>
        {sellerType === "REGISTERED_BUSINESS" ? (
          <FormField label="PACRA number" required error={errors.pacraNumber?.message}>
            <Input className={sellerOnboardingClasses.input} placeholder="Business registration number" disabled={disabled} {...register("pacraNumber")} />
          </FormField>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-3">
          {documents.map((document) => {
            const uploadState = uploadingDocuments[document.key];
            return (
              <UploadTile
                key={document.key}
                title={document.title}
                description={document.description}
                status={document.status}
                acceptLabel={document.acceptLabel}
                url={document.url}
                uploading={uploadState?.uploading}
                progress={uploadState?.progress}
                error={uploadState?.error ?? documentErrors[document.key]}
                disabled={disabled}
                onSelectFile={(file) => onSelectDocument(document, file)}
                onRequestPreviewUrl={async () => {
                  const access = await getSellerDocumentAccess(document.documentType);
                  return access.signedUrl;
                }}
              />
            );
          })}
        </div>
      </div>
    </ApplicationSectionCard>
  );
}
