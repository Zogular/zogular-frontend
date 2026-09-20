/**
 * @file SellersListGrid.tsx
 * @description
 * Card grid presentation for the Admin Seller Review Queue.
 * Enables visual scanning of seller applications in a responsive grid layout.
 * Integrates container-aware scroll restoration via rememberListScroll when navigating to seller detail.
 */

import React from "react";
import type { VendorApplication } from "@/types/seller";
import {
  getApplicationPrimaryName,
  formatAdminDate,
  StatusBadge,
  getApplicationLocation,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import { getAvailableVendorActions } from "../lib/vendor-action-availability";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuNote,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { rememberListScroll } from "@/hooks/use-list-scroll-restoration";

interface SellersListGridProps {
  applications: VendorApplication[];
  canApprove: boolean;
  canSuspend: boolean;
  canViewSensitiveFields: boolean;
  onOpenAction: (action: VendorApplicationAdminAction, application: VendorApplication) => void;
  isRefreshing?: boolean;
}

export function SellersListGrid({
  applications,
  canApprove,
  canSuspend,
  canViewSensitiveFields,
  onOpenAction,
  isRefreshing = false,
}: SellersListGridProps) {
  if (applications.length === 0) return null;

  return (
    <section
      aria-label="Seller applications"
      aria-busy={isRefreshing}
      className="relative"
    >
      {isRefreshing ? (
        <div className="absolute inset-x-0 -top-2 z-10 h-1 overflow-hidden rounded bg-[color-mix(in_srgb,var(--admin-canopy)_14%,transparent)]" aria-hidden="true">
          <div className="h-full w-1/3 bg-[var(--admin-ember)]" />
        </div>
      ) : null}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-150 ${isRefreshing ? "opacity-75" : "opacity-100"}`}>
      {applications.map((app) => {
        return (
          <div key={app.id} className="flex flex-col bg-[var(--admin-surface-cream)] border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] rounded-lg shadow-sm">
            <div className="p-4 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] pb-2 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-[var(--admin-canopy-deep)]">{getApplicationPrimaryName(app)}</h3>
                <p className="text-xs font-semibold text-[var(--admin-ink-soft)] mt-0.5">{app.sellerType === "REGISTERED_BUSINESS" ? "Registered business" : "Individual"}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>
            <div className="p-4 flex-1">
              <dl className="text-xs space-y-2">
                <div className="flex justify-between items-baseline">
                  <dt className="font-black uppercase text-[9px] text-[var(--admin-ink-soft)]">Owner</dt>
                  <dd className="font-bold">{app.ownerFullName}</dd>
                </div>
                <div className="flex justify-between items-baseline">
                  <dt className="font-black uppercase text-[9px] text-[var(--admin-ink-soft)]">Contact</dt>
                  <dd className="font-bold truncate max-w-[160px]">
                    {canViewSensitiveFields ? (app.businessPhone || app.user?.telephone || "No phone") : <span className="italic font-normal text-[var(--admin-ink-soft)]">Hidden</span>}
                  </dd>
                </div>
                <div className="flex justify-between items-baseline">
                  <dt className="font-black uppercase text-[9px] text-[var(--admin-ink-soft)]">Location</dt>
                  <dd className="font-bold">{getApplicationLocation(app) || "Not provided"}</dd>
                </div>
                {app.submittedAt && (
                  <div className="flex justify-between items-baseline">
                    <dt className="font-black uppercase text-[9px] text-[var(--admin-ink-soft)]">Submitted</dt>
                    <dd className="font-bold" suppressHydrationWarning>{formatAdminDate(app.submittedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="p-4 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] flex justify-end gap-2 items-center">
              <SellerActionMenu application={app} onOpenAction={onOpenAction} canApprove={canApprove} canSuspend={canSuspend} />
              <Button variant="default" size="sm" asChild className="h-8 rounded-md bg-[var(--admin-canopy-deep)] font-black text-[var(--admin-surface-cream)]">
                <Link
                  href={`/admin/sellers/${app.id}`}
                  onClick={() => rememberListScroll(window.location.pathname + window.location.search)}
                >
                  View Details
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
      </div>
    </section>
  );
}

function SellerActionMenu({
  application,
  onOpenAction,
  canApprove,
  canSuspend,
}: {
  application: VendorApplication;
  onOpenAction: (action: VendorApplicationAdminAction, application: VendorApplication) => void;
  canApprove: boolean;
  canSuspend: boolean;
}) {
  const actions = getAvailableVendorActions(application, canApprove, canSuspend);
  if (actions.length === 0) return null;
  const reviewActions = actions.filter((action) => ["approve-approved", "approve-provisional", "needs-info", "reject"].includes(action));
  const statusActions = actions.filter((action) => ["restrict", "suspend"].includes(action));

  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Manage ${getApplicationPrimaryName(application)}`} className="size-8 rounded-md text-[var(--admin-ink-soft)] hover:bg-[var(--admin-surface-mist)] hover:text-[var(--admin-canopy-deep)]">
          <MoreHorizontal className="size-4" />
        </Button>
      </ActionMenuTrigger>
      <ActionMenuContent>
        <ActionMenuNote>Manage seller</ActionMenuNote>
        <ActionMenuSeparator />
        {actions.includes("approve-approved") ? <ActionMenuItem onClick={() => onOpenAction("approve-approved", application)}>Approve</ActionMenuItem> : null}
        {actions.includes("approve-provisional") ? <ActionMenuItem onClick={() => onOpenAction("approve-provisional", application)}>Approve provisional</ActionMenuItem> : null}
        {actions.includes("needs-info") ? <ActionMenuItem onClick={() => onOpenAction("needs-info", application)}>Needs info</ActionMenuItem> : null}
        {actions.includes("reject") ? <ActionMenuItem onClick={() => onOpenAction("reject", application)} className="text-rose-700">Reject</ActionMenuItem> : null}
        {reviewActions.length > 0 && statusActions.length > 0 ? <ActionMenuSeparator /> : null}
        {actions.includes("restrict") ? <ActionMenuItem onClick={() => onOpenAction("restrict", application)} className="text-amber-800">Restrict</ActionMenuItem> : null}
        {actions.includes("suspend") ? <ActionMenuItem onClick={() => onOpenAction("suspend", application)} className="text-rose-700">Suspend</ActionMenuItem> : null}
      </ActionMenuContent>
    </ActionMenu>
  );
}
