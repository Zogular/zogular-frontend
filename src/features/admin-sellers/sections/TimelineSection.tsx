import { History } from "lucide-react";
import { formatAdminDate } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { SellerReviewHistoryEntry } from "../types/seller-review.types";
import { SectionCard } from "./TrustChecksSection";

const ACTION_LABELS: Record<SellerReviewHistoryEntry["action"], string> = {
  APPROVED: "Approved",
  PROVISIONAL_GRANTED: "Provisional access granted",
  INFORMATION_REQUESTED: "Information requested",
  REJECTED: "Rejected",
  RESTRICTED: "Restricted",
  SUSPENDED: "Suspended",
};

export function DecisionHistorySection({ history }: { history: SellerReviewHistoryEntry[] }) {
  return (
    <SectionCard title="Decision history" description="Recorded review decisions, newest first." icon={History}>
      {history.length ? (
        <ol className="space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-mist)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--admin-ink)]">{ACTION_LABELS[entry.action]}</p>
                <time className="text-xs text-[var(--admin-ink-soft)]" dateTime={entry.timestamp}>{formatAdminDate(entry.timestamp)}</time>
              </div>
              <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">{entry.previousStatus.replaceAll("_", " ")} → {entry.newStatus.replaceAll("_", " ")}</p>
              <p className="mt-2 text-xs font-medium text-[var(--admin-ink)]">{entry.actorDisplayName || "Authorized administrator"}</p>
              {entry.reason ? <p className="mt-2 border-l-2 border-[var(--admin-ember)] pl-3 text-sm leading-5 text-[var(--admin-ink-soft)]">{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      ) : <p className="rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-mist)] p-4 text-sm text-[var(--admin-ink-soft)]">No review decisions have been recorded.</p>}
    </SectionCard>
  );
}
