import type { ReactNode } from "react";
import type { SectionStatus } from "../../types/seller-onboarding.types";
import { StatusBadge } from "./status-badge";

const sectionStatusMap: Record<SectionStatus, "completed" | "pending" | "draft" | "missing" | "verified"> = {
  completed: "completed",
  pending: "pending",
  draft: "draft",
  missing: "missing",
  verified: "verified",
};

export type ApplicationSectionCardProps = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: ReactNode;
  status: SectionStatus;
  children: ReactNode;
};

export function ApplicationSectionCard({
  id,
  title,
  eyebrow,
  description,
  icon,
  status,
  children,
}: ApplicationSectionCardProps) {
  return (
    <section
      id={id}
      className="rounded-[28px] border border-[#E9E1D6] bg-[#FFFCF8] p-5 shadow-[0_20px_55px_rgba(31,26,20,0.06)] md:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E9E1D6] bg-[#FBF6EE] text-[#0B3425] shadow-inner">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8924F]">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-[#1F1A14]">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#6F6A62]">{description}</p>
          </div>
        </div>
        <StatusBadge status={sectionStatusMap[status]} />
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
