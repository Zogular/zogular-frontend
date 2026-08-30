import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  StatusBadge,
  formatAdminDate,
  getApplicationLocation,
  getApplicationPrimaryName,
  getSellerTypeLabel,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { VendorApplicationAdminAction } from "@/features/admin-sellers/types/admin-seller.types";
import { getAvailableVendorActions } from "@/features/admin-sellers/lib/vendor-action-availability";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuNote,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import type { VendorApplication } from "@/types/seller";
import { Button } from "@/components/ui/button";

interface SellersListTableProps {
  applications: VendorApplication[];
  onOpenAction: (action: VendorApplicationAdminAction, application: VendorApplication) => void;
  canApprove: boolean;
  canSuspend: boolean;
  isRefreshing: boolean;
}

export function SellersListTable({
  applications,
  onOpenAction,
  canApprove,
  canSuspend,
  isRefreshing,
}: SellersListTableProps) {
  return (
    <section
      aria-label="Seller applications"
      aria-busy={isRefreshing}
      className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] shadow-[0_16px_34px_rgb(6_59_41_/_7%)]"
    >
      {isRefreshing ? (
        <div className="absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-[color-mix(in_srgb,var(--admin-canopy)_14%,transparent)]" aria-hidden="true">
          <div className="h-full w-1/3 bg-[var(--admin-ember)]" />
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-canopy-deep)] text-[10px] font-black uppercase text-[var(--admin-surface-mist)]">
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] text-xs text-[var(--admin-ink)]">
            {applications.map((application) => (
              <tr key={application.id} className="transition-colors hover:bg-[var(--admin-surface-mist)]">
                <td className="max-w-64 px-4 py-3">
                  <Link
                    href={`/admin/sellers/${application.id}`}
                    prefetch={false}
                    className="block truncate text-sm font-black text-[var(--admin-canopy-deep)] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)]"
                  >
                    {getApplicationPrimaryName(application)}
                  </Link>
                  <span className="mt-0.5 block truncate font-semibold text-[var(--admin-ink-soft)]">
                    {application.ownerFullName || "Owner not provided"}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold">{getSellerTypeLabel(application.sellerType)}</td>
                <td className="max-w-60 px-4 py-3">
                  <span className="block truncate font-bold">{application.businessPhone || application.user?.telephone || "No phone"}</span>
                  <span className="mt-0.5 block truncate text-[var(--admin-ink-soft)]">{application.businessEmail || application.user?.email || "No email"}</span>
                </td>
                <td className="max-w-52 px-4 py-3">
                  <span className="block truncate">{getApplicationLocation(application) || "Not provided"}</span>
                </td>
                <td className="px-4 py-3 font-semibold" suppressHydrationWarning>
                  {formatAdminDate(application.submittedAt || application.createdAt)}
                </td>
                <td className="px-4 py-3"><StatusBadge status={application.status} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="outline" size="sm" className="h-8 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_30%,transparent)] bg-[var(--admin-surface-mist)] px-3 font-black text-[var(--admin-canopy-deep)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_10%,var(--admin-surface-mist))]">
                      <Link href={`/admin/sellers/${application.id}`} prefetch={false}>Review</Link>
                    </Button>
                    <SellerActionMenu application={application} onOpenAction={onOpenAction} canApprove={canApprove} canSuspend={canSuspend} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] md:hidden">
        {applications.map((application) => (
          <article key={application.id} className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/sellers/${application.id}`}
                  prefetch={false}
                  className="block truncate text-sm font-black text-[var(--admin-canopy-deep)] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)]"
                >
                  {getApplicationPrimaryName(application)}
                </Link>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--admin-ink-soft)]">
                  {application.ownerFullName || "Owner not provided"}
                </p>
              </div>
              <StatusBadge status={application.status} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <MobileField label="Type" value={application.sellerType === "REGISTERED_BUSINESS" ? "Registered business" : "Individual"} />
              <MobileField label="Submitted" value={formatAdminDate(application.submittedAt || application.createdAt)} />
              <MobileField label="Phone" value={application.businessPhone || application.user?.telephone || "No phone"} />
              <MobileField label="Location" value={getApplicationLocation(application) || "Not provided"} />
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] pt-2.5">
              <Button asChild variant="outline" size="sm" className="h-9 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_30%,transparent)] bg-[var(--admin-surface-mist)] px-3 font-black text-[var(--admin-canopy-deep)]">
                <Link href={`/admin/sellers/${application.id}`} prefetch={false}>Review application</Link>
              </Button>
              <SellerActionMenu application={application} onOpenAction={onOpenAction} canApprove={canApprove} canSuspend={canSuspend} />
            </div>
          </article>
        ))}
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
        <Button variant="ghost" size="icon" aria-label={`Manage ${getApplicationPrimaryName(application)}`} className="size-9 rounded-md text-[var(--admin-ink-soft)] hover:bg-[var(--admin-surface-mist)] hover:text-[var(--admin-canopy-deep)]">
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

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-black uppercase text-[var(--admin-ink-soft)]">{label}</dt>
      <dd className="mt-0.5 truncate font-bold text-[var(--admin-ink)]" suppressHydrationWarning>{value}</dd>
    </div>
  );
}
