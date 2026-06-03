import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { SellerOnboardingDocumentConfig, SellerOnboardingFormValues, SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { ComplianceSection } from "./sections/compliance-section";
import { IdentitySection } from "./sections/identity-section";
import { OperatingModelSection } from "./sections/operating-model-section";
import { SettlementSection } from "./sections/settlement-section";
import { StoreFootprintSection } from "./sections/store-footprint-section";
import { StatusBadge } from "./shared/status-badge";

const statusMap = {
  completed: "completed",
  pending: "pending",
  draft: "draft",
  missing: "missing",
  verified: "verified",
} as const;

export function MobileApplicationAccordion({
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
}) {
  const mobileSections = [
    {
      value: "operating-model",
      title: "Operating model",
      status: viewModel.sections.operatingModel.status,
      content: <OperatingModelSection viewModel={viewModel} watch={watch} setValue={setValue} disabled={disabled} />,
    },
    {
      value: "identity",
      title: "Identity",
      status: viewModel.sections.identity.status,
      content: <IdentitySection viewModel={viewModel} register={register} errors={errors} watch={watch} disabled={disabled} />,
    },
    {
      value: "store-footprint",
      title: "Store footprint",
      status: viewModel.sections.storeFootprint.status,
      content: <StoreFootprintSection viewModel={viewModel} register={register} errors={errors} disabled={disabled} />,
    },
    {
      value: "compliance",
      title: "Documents",
      status: viewModel.sections.compliance.status,
      content: (
        <ComplianceSection
          viewModel={viewModel}
          register={register}
          errors={errors}
          watch={watch}
          disabled={disabled}
          uploadingDocuments={uploadingDocuments}
          onSelectDocument={onSelectDocument}
        />
      ),
    },
    {
      value: "settlement",
      title: "Payouts",
      status: viewModel.sections.settlement.status,
      content: <SettlementSection viewModel={viewModel} register={register} errors={errors} disabled={disabled} />,
    },
  ] as const;

  return (
    <section className="px-4">
      <Accordion type="single" value={openSection} onValueChange={onOpenSectionChange} collapsible className="gap-3">
        {mobileSections.map((section) => (
          <AccordionItem key={section.value} value={section.value} className="border-0">
            <AccordionTrigger className="rounded-3xl border border-[#E9E1D6] bg-[#FFFCF8] px-4 py-3 no-underline hover:no-underline">
              <span className="text-sm font-black text-[#1F1A14]">{section.title}</span>
              <StatusBadge status={statusMap[section.status]} />
            </AccordionTrigger>
            <AccordionContent className="pt-3 pb-0">
              <div className="[&>section]:rounded-[24px] [&>section]:p-4 [&>section]:shadow-none">{section.content}</div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
