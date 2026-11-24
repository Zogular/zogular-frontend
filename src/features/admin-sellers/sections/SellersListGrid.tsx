import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rememberListScroll } from "@/hooks/use-list-scroll-restoration";
import {
  formatAdminDate,
  getApplicationLocation,
  getApplicationPrimaryName,
  getSellerTypeLabel,
  StatusBadge,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { VendorApplication } from "@/types/seller";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";
import { SellerActionMenu } from "./SellersListTable";

interface SellersListGridProps {
  applications: VendorApplication[];
  onOpenAction: (action: VendorApplicationAdminAction, application: VendorApplication, triggerElement?: HTMLElement) => void;
  canApprove: boolean;
  canSuspend: boolean;
  isRefreshing: boolean;
}

export function SellersListGrid({ applications, onOpenAction, canApprove, canSuspend, isRefreshing }: SellersListGridProps) {
  return (
    <section aria-label="Seller applications grid" aria-busy={isRefreshing} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {applications.map((application) => (
        <article key={application.id} className="flex min-h-64 flex-col rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] p-4 shadow-[0_16px_34px_rgb(6_59_41_/_7%)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/admin/sellers/${application.id}`} prefetch={false} onClick={() => rememberListScroll("/admin/sellers")} className="block truncate text-base font-black text-[var(--admin-canopy-deep)] hover:underline">
                {getApplicationPrimaryName(application)}
              </Link>
              <p className="mt-1 truncate text-xs font-semibold text-[var(--admin-ink-soft)]">{application.ownerFullName || "Owner not provided"}</p>
            </div>
            <StatusBadge status={application.status} />
          </div>
          <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="font-black uppercase text-[var(--admin-ink-soft)]">Type</dt><dd className="mt-1 font-bold">{getSellerTypeLabel(application.sellerType)}</dd></div>
            <div><dt className="font-black uppercase text-[var(--admin-ink-soft)]">Submitted</dt><dd className="mt-1 font-bold" suppressHydrationWarning>{formatAdminDate(application.submittedAt || application.createdAt)}</dd></div>
            <div><dt className="font-black uppercase text-[var(--admin-ink-soft)]">Contact</dt><dd className="mt-1 truncate font-bold">{application.businessPhone || application.user?.telephone || "No phone"}</dd></div>
            <div><dt className="font-black uppercase text-[var(--admin-ink-soft)]">Location</dt><dd className="mt-1 truncate font-bold">{getApplicationLocation(application) || "Not provided"}</dd></div>
          </dl>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] pt-4">
            <Button asChild variant="outline" size="sm" className="h-9 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_30%,transparent)] bg-[var(--admin-surface-mist)] font-black text-[var(--admin-canopy-deep)]">
              <Link href={`/admin/sellers/${application.id}`} prefetch={false} onClick={() => rememberListScroll("/admin/sellers")}><Eye className="mr-2 size-4" />Review</Link>
            </Button>
            <SellerActionMenu application={application} onOpenAction={onOpenAction} canApprove={canApprove} canSuspend={canSuspend} variant="grid" />
          </div>
        </article>
      ))}
    </section>
  );
}
