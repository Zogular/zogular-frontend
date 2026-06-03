import { Banknote, Landmark, Smartphone, WalletCards } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { sellerOnboardingClasses } from "../../constants/seller-onboarding-ui";
import type { SellerOnboardingFormValues, SellerOnboardingViewModel } from "../../types/seller-onboarding.types";
import { ApplicationSectionCard } from "../shared/application-section-card";
import { FormField } from "../shared/form-field";
import { OptionCard } from "../shared/option-card";
import { StatusBadge } from "../shared/status-badge";

const providers = ["MTN Mobile Money", "Airtel Money", "Zamtel Kwacha"];

export function SettlementSection({
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
  const section = viewModel.sections.settlement;

  return (
    <ApplicationSectionCard
      id={section.id}
      title={section.title}
      eyebrow={section.eyebrow}
      description={section.description}
      icon={<WalletCards className="h-5 w-5" />}
      status={section.status}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <OptionCard
              title="Mobile Money"
            description="Mobile Money is available now. Add your provider and payout phone."
              statusLabel="Active"
              state="selected"
              icon={<Smartphone className="h-4 w-4" />}
            />
          </div>
          <OptionCard
            title="Bank Account"
            description="Bank payouts will be added later."
            statusLabel="Coming soon"
            state="disabled"
            icon={<Landmark className="h-4 w-4" />}
          />
          <OptionCard
            title="Bot / decide later"
            description="More payout choices will be added later."
            statusLabel="Coming soon"
            state="disabled"
            icon={<Banknote className="h-4 w-4" />}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {providers.map((provider, index) => (
            <StatusBadge key={provider} status={index === 0 ? "active" : "draft"} label={provider} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Payout provider" required error={errors.payoutProvider?.message}>
            <Input className={sellerOnboardingClasses.input} disabled={disabled} {...register("payoutProvider")} />
          </FormField>
          <FormField label="Payout phone" required error={errors.payoutPhone?.message}>
            <Input className={sellerOnboardingClasses.input} placeholder="+260 96 000 0000" disabled={disabled} {...register("payoutPhone")} />
          </FormField>
          <FormField label="Payout account name">
            <Input className={sellerOnboardingClasses.input} placeholder="Registered payout name" disabled={disabled} {...register("payoutAccountName")} />
          </FormField>
        </div>
      </div>
    </ApplicationSectionCard>
  );
}
