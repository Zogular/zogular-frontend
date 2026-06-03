import { MapPinned } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sellerOnboardingClasses } from "../../constants/seller-onboarding-ui";
import type { SellerOnboardingFormValues, SellerOnboardingViewModel } from "../../types/seller-onboarding.types";
import { ApplicationSectionCard } from "../shared/application-section-card";
import { FormField } from "../shared/form-field";

export function StoreFootprintSection({
  viewModel,
  register,
  errors,
  disabled,
}: {
  viewModel: SellerOnboardingViewModel;
  register: UseFormRegister<SellerOnboardingFormValues>;
  errors: FieldErrors<SellerOnboardingFormValues>;
  disabled?: boolean;
}) {
  const section = viewModel.sections.storeFootprint;

  return (
    <ApplicationSectionCard
      id={section.id}
      title={section.title}
      eyebrow={section.eyebrow}
      description={section.description}
      icon={<MapPinned className="h-5 w-5" />}
      status={section.status}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="District" required error={errors.district?.message}>
          <Input className={sellerOnboardingClasses.input} placeholder="Lusaka" disabled={disabled} {...register("district")} />
        </FormField>
        <FormField label="Product categories" required hint="Separate categories with commas." error={errors.productCategoriesInput?.message}>
          <Input className={sellerOnboardingClasses.input} placeholder="Phones, accessories, home goods" disabled={disabled} {...register("productCategoriesInput")} />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Business address" required error={errors.businessAddress?.message}>
            <Textarea
              className="min-h-28 rounded-xl border-[#E4D8C9] bg-[#FFFCF8] px-4 py-3 text-sm font-semibold text-[#1F1A14] placeholder:text-[#9B948A] focus-visible:ring-2 focus-visible:ring-[#0EA85B]/20"
              placeholder="Shop number, street, market, or delivery base"
              disabled={disabled}
              {...register("businessAddress")}
            />
          </FormField>
        </div>
      </div>
    </ApplicationSectionCard>
  );
}
