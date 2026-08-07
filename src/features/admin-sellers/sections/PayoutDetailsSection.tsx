import { HandCoins } from "lucide-react";
import { normalizePayoutDestination } from "@/lib/payout-destination";
import type { VendorApplication } from "@/types/seller";
import { SectionCard } from "./TrustChecksSection";

export function PayoutDetailsSection({
  application,
}: {
  application: VendorApplication;
}) {
  const payout = normalizePayoutDestination(application);
  const mode = payout.mode;

  const showMomo = mode === "MOBILE_MONEY" || mode === "BOTH";
  const showBank = mode === "BANK_ACCOUNT" || mode === "BOTH";

  return (
    <SectionCard
      title="Payout details"
      description="Seller's saved payout destinations."
      icon={HandCoins}
    >
      <div className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white/50 space-y-3 p-2">
        <div className="flex items-center justify-between px-3 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Payout Mode</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
            {mode === "BOTH" ? "Mobile Money and Bank" : mode === "BANK_ACCOUNT" ? "Bank Account" : mode === "MOBILE_MONEY" ? "Mobile Money" : "Unavailable"}
          </span>
        </div>

        {showMomo && (
          <div className="rounded-xl border border-stone-200/50 bg-white p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-600">Mobile Money</div>
            <dl className="divide-y divide-stone-100 text-xs">
              <PayoutRow label="Network / Provider" value={payout.momoProvider || "Unavailable"} />
              <PayoutRow label="Phone Number" value={maskValue(payout.momoPhone, 3)} />
              <PayoutRow label="Account Name" value={payout.momoAccountName || "Unavailable"} />
            </dl>
          </div>
        )}

        {showBank && (
          <div className="rounded-xl border border-stone-200/50 bg-white p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-600">Bank Account</div>
            <dl className="divide-y divide-stone-100 text-xs">
              <PayoutRow label="Bank Name" value={payout.bankName || "Unavailable"} />
              <PayoutRow label="Account Number" value={maskValue(payout.bankAccountNumber, 4)} />
              <PayoutRow label="Account Holder" value={payout.bankAccountName || "Unavailable"} />
              <PayoutRow label="Branch" value={payout.bankBranch || "Not provided"} />
            </dl>
          </div>
        )}

        {!mode ? (
          <p className="px-3 pb-2 text-xs font-medium text-stone-600">
            No recognized payout destination is available for this application.
          </p>
        ) : null}

        {application.tpin ? (
          <div className="px-3 pb-2">
            <PayoutRow label="TPIN" value={application.tpin} />
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function maskValue(value: string, visibleDigits: number) {
  if (!value) return "Unavailable";
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= visibleDigits) return compact;
  return `${"•".repeat(Math.min(6, compact.length - visibleDigits))}${compact.slice(-visibleDigits)}`;
}

function PayoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 transition-colors hover:bg-stone-50/50 sm:items-center">
      <dt className="shrink-0 text-xs font-bold text-stone-600">{label}</dt>
      <dd className="break-words text-right text-xs font-black text-stone-950">{value}</dd>
    </div>
  );
}
