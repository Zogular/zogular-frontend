"use client";

import {
  Calendar,
  Mail,
  MapPin,
  Phone,
  Store,
} from "lucide-react";
import {
  StatusBadge,
  SellerTypeBadge,
  formatAdminDate,
  getApplicationPrimaryName,
  getApplicationLocation,
  getStatusMeta,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { VendorApplication } from "@/types/seller";

export function SellerOverviewSection({
  application,
}: {
  application: VendorApplication;
}) {
  const statusMeta = getStatusMeta(application.status);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(250,248,245,0.92))] p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] md:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#009E49]/5 blur-[40px]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={application.status} />
            <SellerTypeBadge sellerType={application.sellerType} />
          </div>

          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-[#009E49] shadow-md shadow-stone-950/5">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight tracking-tight text-stone-900 sm:text-2xl">
                {getApplicationPrimaryName(application)}
              </h1>
              <p className="mt-1 text-sm font-bold text-stone-500">
                {application.ownerFullName || "Owner not specified"}
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-stone-600">
            {statusMeta.summary}
          </p>
        </div>
      </div>

      <div className="relative mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewMeta icon={MapPin} label="Location" value={getApplicationLocation(application) || "Not provided"} />
        <OverviewMeta icon={Mail} label="Email" value={application.businessEmail || application.user?.email || "Not provided"} />
        <OverviewMeta icon={Phone} label="Phone" value={application.businessPhone || application.user?.telephone || "Not provided"} />
        <OverviewMeta icon={Calendar} label="Submitted" value={formatAdminDate(application.submittedAt || application.createdAt)} />
      </div>
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
    <div className="flex items-center gap-2.5 rounded-xl border border-stone-200/50 bg-white/70 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-400">{label}</p>
        <p className="mt-0.5 truncate text-[11px] font-bold text-stone-800">{value}</p>
      </div>
    </div>
  );
}
