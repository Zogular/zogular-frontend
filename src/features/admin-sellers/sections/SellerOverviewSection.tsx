import { CalendarClock, MapPin, RefreshCw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SellerTypeBadge,
  StatusBadge,
  formatAdminDate,
  getApplicationPrimaryName,
  getStatusMeta,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { SellerReviewApplication } from "../types/seller-review.types";

export function SellerOverviewSection({
  application,
  isRefreshing,
  onRefresh,
}: {
  application: SellerReviewApplication;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const statusMeta = getStatusMeta(application.status);

  return (
    <section className="overflow-hidden rounded-3xl border border-[color:rgba(184,135,70,0.34)] bg-[var(--admin-surface-cream)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_rgba(6,59,41,0.08)]">
      <div className="border-b border-[color:rgba(184,135,70,0.25)] bg-[var(--admin-canopy-deep)] px-5 py-5 text-[var(--admin-surface-cream)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={application.status} />
              <SellerTypeBadge sellerType={application.sellerType} />
            </div>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[color:rgba(255,248,236,0.16)] bg-[color:rgba(255,248,236,0.1)] text-[var(--admin-ember)]">
                <Store className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                  {getApplicationPrimaryName(application)}
                </h1>
                <p className="mt-1 text-sm text-[color:rgba(255,248,236,0.68)]">
                  {application.ownerFullName || "Owner name not provided"}
                </p>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="min-h-11 self-start border-[color:rgba(255,248,236,0.22)] bg-[color:rgba(255,248,236,0.08)] text-[var(--admin-surface-cream)] hover:bg-[color:rgba(255,248,236,0.14)] hover:text-[var(--admin-surface-cream)]"
          >
            <RefreshCw className={isRefreshing ? "animate-spin motion-reduce:animate-none" : ""} />
            {isRefreshing ? "Refreshing" : "Refresh review"}
          </Button>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[color:rgba(255,248,236,0.74)]">
          {statusMeta.summary}
        </p>
      </div>

      <dl className="grid divide-y divide-[color:rgba(184,135,70,0.2)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <OverviewMeta icon={MapPin} label="Location" value={[application.district, application.businessAddress].filter(Boolean).join(", ") || "Not provided"} />
        <OverviewMeta icon={CalendarClock} label="Submitted" value={application.submittedAt ? formatAdminDate(application.submittedAt) : "Not submitted"} />
        <OverviewMeta icon={CalendarClock} label="Last changed" value={formatAdminDate(application.updatedAt)} />
      </dl>
    </section>
  );
}

function OverviewMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-5 py-4 sm:px-6">
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--admin-canopy)]" />
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-ink-soft)]">{label}</dt>
        <dd className="mt-1 break-words text-sm font-semibold text-[var(--admin-ink)]">{value}</dd>
      </div>
    </div>
  );
}
