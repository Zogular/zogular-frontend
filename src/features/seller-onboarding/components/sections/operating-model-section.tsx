import { Building2, UserRound } from "lucide-react";
import type { UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { SellerOnboardingFormValues, SellerOnboardingViewModel } from "../../types/seller-onboarding.types";
import { ApplicationSectionCard } from "../shared/application-section-card";
import { OptionCard } from "../shared/option-card";

export function OperatingModelSection({
  viewModel,
  watch,
  setValue,
  disabled,
}: {
  viewModel: SellerOnboardingViewModel;
  watch: UseFormWatch<SellerOnboardingFormValues>;
  setValue: UseFormSetValue<SellerOnboardingFormValues>;
  disabled?: boolean;
}) {
  const section = viewModel.sections.operatingModel;
  const sellerType = watch("sellerType");

  return (
    <ApplicationSectionCard
      id={section.id}
      title={section.title}
      eyebrow={section.eyebrow}
      description={section.description}
      icon={<UserRound className="h-5 w-5" />}
      status={section.status}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <OptionCard
          title="Individual seller"
          description="Best for informal sellers, solo founders, and small operators starting without full business registration."
          statusLabel="Selected"
          state={sellerType === "INDIVIDUAL" ? "selected" : "default"}
          icon={<UserRound className="h-4 w-4" />}
          onClick={() => !disabled && setValue("sellerType", "INDIVIDUAL", { shouldDirty: true })}
        />
        <OptionCard
          title="Registered business"
          description="Best for established businesses with PACRA registration and formal tax identity."
          statusLabel="Entity review"
          state={sellerType === "REGISTERED_BUSINESS" ? "selected" : "default"}
          icon={<Building2 className="h-4 w-4" />}
          onClick={() => !disabled && setValue("sellerType", "REGISTERED_BUSINESS", { shouldDirty: true })}
        />
      </div>
    </ApplicationSectionCard>
  );
}
