/**
 * @file SellersListGrid.tsx
 * @description
 * Card grid presentation for the Admin Seller Review Queue.
 * Enables visual scanning of seller applications in a responsive grid layout.
 * Integrates container-aware scroll restoration via rememberListScroll when navigating to seller detail.
 */

import React from "react";
import type { VendorApplication } from "@/types/seller";
import { formatAdminDate } from "@/lib/admin-format";
import { StatusBadge } from "../components/StatusBadge";
import {
  getApplicationLocation,
  getApplicationPrimaryName,
} from "../lib/seller-formatters";
import { getAvailableVendorActions } from "../lib/vendor-action-availability";
import { Button } from "@/components/ui/button";
import {
  Ban,
  CheckCheck,
  MessageSquareWarning,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
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

  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Manage ${getApplicationPrimaryName(application)}`}
          className="size-8 rounded-md text-[var(--admin-ink-soft)] hover:bg-[var(--admin-surface-mist)] hover:text-[var(--admin-canopy-deep)]"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </ActionMenuTrigger>
      <ActionMenuContent className="w-56">
        <ActionMenuNote>Manage application</ActionMenuNote>
        <ActionMenuSeparator />

        {/* Approvals */}
        {actions.includes("approve-approved") ? (
          <ActionMenuItem
            onClick={() => onOpenAction("approve-approved", application)}
            className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <CheckCheck className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span>Approve seller</span>
          </ActionMenuItem>
        ) : null}
        {actions.includes("approve-provisional") ? (
          <ActionMenuItem
            onClick={() => onOpenAction("approve-provisional", application)}
            className="text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
          >
            <ShieldCheck className="size-4 shrink-0 text-sky-700 dark:text-sky-400" />
            <span>Grant provisional access</span>
          </ActionMenuItem>
        ) : null}

        {/* Information Requests */}
        {actions.includes("needs-info") ? (
          <ActionMenuItem
            onClick={() => onOpenAction("needs-info", application)}
            className="text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
          >
            <MessageSquareWarning className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>Request information</span>
          </ActionMenuItem>
        ) : null}

        {/* Destructive Decline Action (Separated) */}
        {actions.includes("reject") ? (
          <>
            <ActionMenuSeparator />
            <ActionMenuItem
              onClick={() => onOpenAction("reject", application)}
              className="text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <Ban className="size-4 shrink-0 text-rose-700 dark:text-rose-400" />
              <span>Decline application</span>
            </ActionMenuItem>
          </>
        ) : null}

        {/* Account Lifecycle Actions */}
        {(actions.includes("restrict") || actions.includes("suspend")) ? (
          <>
            <ActionMenuSeparator />
            {actions.includes("restrict") ? (
              <ActionMenuItem
                onClick={() => onOpenAction("restrict", application)}
                className="text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
              >
                <ShieldAlert className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <span>Restrict account</span>
              </ActionMenuItem>
            ) : null}
            {actions.includes("suspend") ? (
              <ActionMenuItem
                onClick={() => onOpenAction("suspend", application)}
                className="text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <Ban className="size-4 shrink-0 text-rose-700 dark:text-rose-400" />
                <span>Suspend account</span>
              </ActionMenuItem>
            ) : null}
          </>
        ) : null}
      </ActionMenuContent>
    </ActionMenu>
  );
}
