import type { ReactNode } from "react";
import { sellerOnboardingClasses } from "../../constants/seller-onboarding-ui";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`${sellerOnboardingClasses.label} text-[#B8924F]`}>{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-[#1F1A14]">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#6F6A62]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
