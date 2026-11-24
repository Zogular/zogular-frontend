import { Check, CircleMinus, LockKeyhole, ShieldCheck } from "lucide-react";
import type { SellerReviewDetail } from "../types/seller-review.types";

export function EvidenceSection({ detail }: { detail: SellerReviewDetail }) {
  const { application } = detail;
  const { evidence, capabilities } = detail.review;
  const isBusiness = application.sellerType === "REGISTERED_BUSINESS";
  const checks = [
    ["Email verified", evidence.emailVerified ? "available" : "missing"],
    ["Phone confirmed", evidence.phoneVerified ? "available" : "missing"],
    ["Account active", evidence.accountActive ? "available" : "missing"],
    ["NRC front", getSensitiveEvidenceState(evidence.documents.NRC_FRONT, capabilities.canViewSensitiveFields)],
    ["NRC back", getSensitiveEvidenceState(evidence.documents.NRC_BACK, capabilities.canViewSensitiveFields)],
    ["Shop photo", getSensitiveEvidenceState(evidence.documents.SHOP_PHOTO, capabilities.canViewSensitiveFields)],
    ...(isBusiness ? [["PACRA document", getSensitiveEvidenceState(evidence.documents.PACRA_DOCUMENT, capabilities.canViewSensitiveFields)] as const] : []),
    ["Payout details", getSensitiveEvidenceState(evidence.payoutDestinationAvailable, capabilities.canViewSensitiveFields)],
  ] as const;

  return (
    <SectionCard title="Review evidence" description="Information available for this decision." icon={ShieldCheck}>
      <div className="grid gap-2 sm:grid-cols-2">
        {checks.map(([label, state]) => (
          <div
            key={label}
            className={state === "available"
              ? "flex min-h-11 items-center gap-2.5 rounded-xl border border-[color:rgba(7,91,54,0.22)] bg-[color:rgba(7,91,54,0.07)] px-3 text-[var(--admin-canopy)]"
              : "flex min-h-11 items-center gap-2.5 rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-mist)] px-3 text-[var(--admin-ink-soft)]"}
          >
            {state === "available" ? <Check className="size-4 shrink-0" /> : state === "restricted" ? <LockKeyhole className="size-4 shrink-0" /> : <CircleMinus className="size-4 shrink-0" />}
            <span className="min-w-0 text-xs font-semibold">{label}</span>
            <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em]">{state === "available" ? "Available" : state === "restricted" ? "Restricted access" : "Not provided"}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

type EvidenceState = "available" | "restricted" | "missing";

export function getSensitiveEvidenceState(
  evidencePresent: boolean,
  canViewSensitiveFields: boolean,
): EvidenceState {
  if (!evidencePresent) return "missing";
  return canViewSensitiveFields ? "available" : "restricted";
}

export function SectionCard({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="rounded-2xl border border-[color:rgba(184,135,70,0.3)] bg-[var(--admin-surface-cream)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_12px_28px_rgba(6,59,41,0.06)] sm:p-5">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-canopy-deep)] text-[var(--admin-ember)]">
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-5 text-[var(--admin-ink-soft)]">{description}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
