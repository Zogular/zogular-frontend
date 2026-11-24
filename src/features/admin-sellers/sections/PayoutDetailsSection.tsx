import { EyeOff, HandCoins } from "lucide-react";
import type { SellerReviewDetail } from "../types/seller-review.types";
import { SectionCard } from "./TrustChecksSection";

export function PayoutDetailsSection({ detail }: { detail: SellerReviewDetail }) {
  const { application } = detail;
  const { canViewSensitiveFields } = detail.review.capabilities;

  if (!canViewSensitiveFields) {
    return (
      <SectionCard title="Payout details" description="Restricted financial information." icon={HandCoins}>
        <div className="flex items-start gap-3 rounded-xl border border-[color:rgba(184,135,70,0.25)] bg-[var(--admin-surface-mist)] p-4">
          <EyeOff className="mt-0.5 size-4 shrink-0 text-[var(--admin-copper-muted)]" />
          <p className="text-sm leading-6 text-[var(--admin-ink-soft)]">Your role does not include access to payout details.</p>
        </div>
      </SectionCard>
    );
  }

  const mode = application.payoutMode;
  const showMobile = mode === "MOBILE_MONEY" || mode === "BOTH";
  const showBank = mode === "BANK_ACCOUNT" || mode === "BOTH";

  return (
    <SectionCard title="Payout details" description="Masked destination information supplied for seller review." icon={HandCoins}>
      {!detail.review.evidence.payoutDestinationAvailable ? (
        <p className="rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-mist)] p-4 text-sm text-[var(--admin-ink-soft)]">No payout destination is available.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {showMobile ? (
            <PayoutGroup title="Mobile money" rows={[
              ["Provider", application.momoProvider || "Not provided"],
              ["Phone", maskValue(application.momoPhone, 3)],
              ["Account name", application.momoAccountName || "Not provided"],
            ]} />
          ) : null}
          {showBank ? (
            <PayoutGroup title="Bank account" rows={[
              ["Bank", application.bankName || "Not provided"],
              ["Account", maskValue(application.bankAccountNumber, 4)],
              ["Account name", application.bankAccountName || "Not provided"],
              ["Branch", application.bankBranch || "Not provided"],
            ]} />
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

function PayoutGroup({ title, rows }: { title: string; rows: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-mist)] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--admin-canopy)]">{title}</h3>
      <dl className="mt-2 divide-y divide-[color:rgba(184,135,70,0.18)]">
        {rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 py-2 text-xs"><dt className="text-[var(--admin-ink-soft)]">{label}</dt><dd className="break-words text-right font-semibold text-[var(--admin-ink)]">{value}</dd></div>)}
      </dl>
    </div>
  );
}

function maskValue(value: string | null, visible: number) {
  if (!value) return "Not provided";
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= visible) return "••••";
  return `••••${compact.slice(-visible)}`;
}
