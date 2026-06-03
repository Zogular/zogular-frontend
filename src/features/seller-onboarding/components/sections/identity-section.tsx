import { IdCard } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { sellerOnboardingClasses } from "../../constants/seller-onboarding-ui";
import type { SellerOnboardingFormValues, SellerOnboardingViewModel } from "../../types/seller-onboarding.types";
import { ApplicationSectionCard } from "../shared/application-section-card";
import { FormField } from "../shared/form-field";

export function IdentitySection({
  viewModel,
  register,
  errors,
  watch,
  disabled,
}: {
  viewModel: SellerOnboardingViewModel;
  register: UseFormRegister<SellerOnboardingFormValues>;
  errors: FieldErrors<SellerOnboardingFormValues>;
  watch: UseFormWatch<SellerOnboardingFormValues>;
  disabled?: boolean;
}) {
  const section = viewModel.sections.identity;
  const sellerType = watch("sellerType");

  return (
    <ApplicationSectionCard
      id={section.id}
      title={section.title}
      eyebrow={section.eyebrow}
      description={section.description}
      icon={<IdCard className="h-5 w-5" />}
      status={section.status}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Owner full name" required error={errors.ownerFullName?.message}>
          <Input className={sellerOnboardingClasses.input} placeholder="Owner full name" disabled={disabled} {...register("ownerFullName")} />
        </FormField>
        <FormField label="Store name" required error={errors.storeName?.message}>
          <Input className={sellerOnboardingClasses.input} placeholder="Public store name" disabled={disabled} {...register("storeName")} />
        </FormField>
        {sellerType === "REGISTERED_BUSINESS" ? (
          <FormField label="Registered business name" required error={errors.legalBusinessName?.message}>
            <Input className={sellerOnboardingClasses.input} placeholder="Business name on PACRA record" disabled={disabled} {...register("legalBusinessName")} />
          </FormField>
        ) : null}
        <FormField label="Business phone" required error={errors.businessPhone?.message}>
          <Input className={sellerOnboardingClasses.input} placeholder="+260 96 000 0000" disabled={disabled} {...register("businessPhone")} />
        </FormField>
        <FormField label="Business email" required error={errors.businessEmail?.message}>
          <Input className={sellerOnboardingClasses.input} placeholder="store@example.com" disabled={disabled} {...register("businessEmail")} />
        </FormField>
      </div>
    </ApplicationSectionCard>
  );
}
