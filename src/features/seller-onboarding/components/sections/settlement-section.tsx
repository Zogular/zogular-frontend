"use client";

import React from "react";
import { Banknote, Landmark, Smartphone, WalletCards } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { sellerOnboardingClasses } from "../../constants/seller-onboarding-ui";
import type { SellerOnboardingFormValues, SellerOnboardingViewModel } from "../../types/seller-onboarding.types";
import {
  MOBILE_MONEY_PROVIDERS,
  PAYOUT_BANKS,
} from "../../config/payout-options";
import type { PayoutMode } from "@/types/seller";
import { ApplicationSectionCard } from "../shared/application-section-card";
import { FormField } from "../shared/form-field";
import { OptionCard } from "../shared/option-card";
import { cn } from "@/lib/utils";

export function SettlementSection({
  viewModel,
  errors,
  watch,
  setValue,
  disabled,
}: {
  viewModel: SellerOnboardingViewModel;
  register?: UseFormRegister<SellerOnboardingFormValues>;
  errors: FieldErrors<SellerOnboardingFormValues>;
  watch?: UseFormWatch<SellerOnboardingFormValues>;
  setValue?: UseFormSetValue<SellerOnboardingFormValues>;
  disabled?: boolean;
}) {
  const section = viewModel.sections.settlement;
  const currentMode: PayoutMode = (watch ? watch("payoutMode") : undefined) || "MOBILE_MONEY";

  const momoProviderVal = watch ? watch("momoProvider") || "" : "";
  const momoPhoneVal = watch ? watch("momoPhone") || "" : "";
  const momoAccountNameVal = watch ? watch("momoAccountName") || "" : "";

  const bankNameVal = watch ? watch("bankName") || "" : "";
  const bankAccountNumberVal = watch ? watch("bankAccountNumber") || "" : "";
  const bankAccountNameVal = watch ? watch("bankAccountName") || "" : "";
  const bankBranchVal = watch ? watch("bankBranch") || "" : "";

  const handleModeChange = (mode: PayoutMode) => {
    if (disabled || !setValue) return;
    setValue("payoutMode", mode, { shouldValidate: true, shouldDirty: true });
  };

  const handleMomoProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!setValue) return;
    const val = e.target.value;
    setValue("momoProvider", val, { shouldValidate: true, shouldDirty: true });
    if (currentMode !== "BANK_ACCOUNT") {
      setValue("payoutProvider", val, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleMomoPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!setValue) return;
    const val = e.target.value;
    setValue("momoPhone", val, { shouldValidate: true, shouldDirty: true });
    if (currentMode !== "BANK_ACCOUNT") {
      setValue("payoutPhone", val, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleMomoAccountNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!setValue) return;
    const val = e.target.value;
    setValue("momoAccountName", val, { shouldValidate: true, shouldDirty: true });
    if (currentMode !== "BANK_ACCOUNT") {
      setValue("payoutAccountName", val, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleBankNameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!setValue) return;
    const val = e.target.value;
    setValue("bankName", val, { shouldValidate: true, shouldDirty: true });
    if (currentMode === "BANK_ACCOUNT") {
      setValue("payoutProvider", val, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleBankAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!setValue) return;
    const val = e.target.value;
    setValue("bankAccountNumber", val, { shouldValidate: true, shouldDirty: true });
  };

  const handleBankAccountNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!setValue) return;
    const val = e.target.value;
    setValue("bankAccountName", val, { shouldValidate: true, shouldDirty: true });
    if (currentMode === "BANK_ACCOUNT") {
      setValue("payoutAccountName", val, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleBankBranchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!setValue) return;
    const val = e.target.value;
    setValue("bankBranch", val, { shouldValidate: true, shouldDirty: true });
  };

  const showMomo = currentMode === "MOBILE_MONEY" || currentMode === "BOTH";
  const showBank = currentMode === "BANK_ACCOUNT" || currentMode === "BOTH";

  return (
    <ApplicationSectionCard
      id={section.id}
      title={section.title}
      eyebrow={section.eyebrow}
      description={section.description}
      icon={<WalletCards className="h-5 w-5" />}
      status={section.status}
    >
      <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
        <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-3 w-full max-w-full min-w-0">
          <OptionCard
            title="Mobile Money"
            description="Airtel, MTN, or Zamtel mobile wallet payout destination."
            statusLabel={currentMode === "MOBILE_MONEY" ? "Selected" : "Select"}
            state={currentMode === "MOBILE_MONEY" ? "selected" : "default"}
            icon={<Smartphone className="h-4 w-4" />}
            onClick={() => handleModeChange("MOBILE_MONEY")}
          />
          <OptionCard
            title="Bank Account"
            description="Commercial bank account payout destination."
            statusLabel={currentMode === "BANK_ACCOUNT" ? "Selected" : "Select"}
            state={currentMode === "BANK_ACCOUNT" ? "selected" : "default"}
            icon={<Landmark className="h-4 w-4" />}
            onClick={() => handleModeChange("BANK_ACCOUNT")}
          />
          <OptionCard
            title="Both"
            description="Use both Mobile Money and a bank account."
            statusLabel={currentMode === "BOTH" ? "Selected" : "Select"}
            state={currentMode === "BOTH" ? "selected" : "default"}
            icon={<Banknote className="h-4 w-4" />}
            onClick={() => handleModeChange("BOTH")}
          />
        </div>

        <div className="w-full max-w-full min-w-0 space-y-6">
          <div
            className={cn(
              "w-full max-w-full min-w-0 space-y-4 rounded-2xl border border-[#E9E1D6] bg-[#FFFCF8] p-3.5 sm:p-4.5 overflow-hidden",
              !showMomo && "hidden"
            )}
          >
            {currentMode === "BOTH" && (
              <div className="border-b border-[#E9E1D6] pb-2 text-xs font-bold uppercase tracking-wider text-amber-900/80">
                Mobile Money Destination
              </div>
            )}
            <FormField label="Mobile Money provider / network" required error={showMomo ? errors.momoProvider?.message : undefined}>
              <select
                disabled={disabled}
                value={momoProviderVal}
                onChange={handleMomoProviderChange}
                className={cn(sellerOnboardingClasses.select, "w-full max-w-full min-w-0 box-border")}
              >
                <option value="">Select network</option>
                {MOBILE_MONEY_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 w-full max-w-full min-w-0">
              <FormField label="Registered phone number" required error={showMomo ? errors.momoPhone?.message : undefined}>
                <Input
                  className={cn(sellerOnboardingClasses.input, "w-full max-w-full min-w-0 box-border")}
                  placeholder="+260 96 000 0000"
                  disabled={disabled}
                  value={momoPhoneVal}
                  onChange={handleMomoPhoneChange}
                />
              </FormField>

              <FormField label="Account holder name" required error={showMomo ? errors.momoAccountName?.message : undefined}>
                <Input
                  className={cn(sellerOnboardingClasses.input, "w-full max-w-full min-w-0 box-border")}
                  placeholder="Registered Mobile Money account name"
                  disabled={disabled}
                  value={momoAccountNameVal}
                  onChange={handleMomoAccountNameChange}
                />
              </FormField>
            </div>
          </div>

          <div
            className={cn(
              "w-full max-w-full min-w-0 space-y-4 rounded-2xl border border-[#E9E1D6] bg-[#FFFCF8] p-3.5 sm:p-4.5 overflow-hidden",
              !showBank && "hidden"
            )}
          >
            {currentMode === "BOTH" && (
              <div className="border-b border-[#E9E1D6] pb-2 text-xs font-bold uppercase tracking-wider text-amber-900/80">
                Bank Account Destination
              </div>
            )}
            <FormField label="Bank name" required error={showBank ? errors.bankName?.message : undefined}>
              <select
                disabled={disabled}
                value={bankNameVal}
                onChange={handleBankNameChange}
                className={cn(sellerOnboardingClasses.select, "w-full max-w-full min-w-0 box-border")}
              >
                <option value="">Select bank</option>
                {PAYOUT_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 w-full max-w-full min-w-0">
              <FormField label="Bank account number" required error={showBank ? errors.bankAccountNumber?.message : undefined}>
                <Input
                  className={cn(sellerOnboardingClasses.input, "w-full max-w-full min-w-0 box-border")}
                  placeholder="e.g. 1029384756"
                  disabled={disabled}
                  value={bankAccountNumberVal}
                  onChange={handleBankAccountNumberChange}
                />
              </FormField>

              <FormField label="Account holder name" required error={showBank ? errors.bankAccountName?.message : undefined}>
                <Input
                  className={cn(sellerOnboardingClasses.input, "w-full max-w-full min-w-0 box-border")}
                  placeholder="Registered bank account holder name"
                  disabled={disabled}
                  value={bankAccountNameVal}
                  onChange={handleBankAccountNameChange}
                />
              </FormField>
            </div>

            <FormField label="Branch name (Optional)" error={showBank ? errors.bankBranch?.message : undefined}>
              <Input
                className={cn(sellerOnboardingClasses.input, "w-full max-w-full min-w-0 box-border")}
                placeholder="e.g. Cairo Road Branch"
                disabled={disabled}
                value={bankBranchVal}
                onChange={handleBankBranchChange}
              />
            </FormField>
          </div>
        </div>
      </div>
    </ApplicationSectionCard>
  );
}
