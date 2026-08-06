import type { ReactNode } from "react";
import { sellerOnboardingClasses } from "../../constants/seller-onboarding-ui";

export function FormField({
  label,
  children,
  required = false,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5 w-full max-w-full min-w-0 overflow-hidden">
      <span className={`${sellerOnboardingClasses.label} text-[#8F6B34]`}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {error ? (
        <span className="block text-xs font-bold leading-5 text-[#A5442E]">{error}</span>
      ) : hint ? (
        <span className="block text-xs font-medium leading-5 text-[#7B746B]">{hint}</span>
      ) : null}
    </label>
  );
}
