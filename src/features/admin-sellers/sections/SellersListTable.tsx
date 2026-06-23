import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  StatusBadge,
  SellerTypeBadge,
  formatAdminDate,
  getApplicationLocation,
  getApplicationPrimaryName,
  type VendorApplicationAdminAction,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
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
import type { CollectionViewMode } from "@/components/shared/CollectionViewToggle";

interface SellersListTableProps {
  applications: VendorApplication[];
  onOpenAction: (action: VendorApplicationAdminAction, application: VendorApplication) => void;
  canApprove: boolean;
  canSuspend: boolean;
  mobileView: CollectionViewMode;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function SellersListTable({
  applications,
  onOpenAction,
  canApprove,
  canSuspend,
  mobileView,
  hasMore,
  onLoadMore,
}: SellersListTableProps) {
  return (
    <div className="w-full space-y-6">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-[2rem] border border-stone-200 bg-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/50 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                <th className="px-4 py-3.5">Seller</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5">Timeline</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs font-bold text-stone-700">
              {applications.map((application) => (
                <tr key={application.id} className="transition-colors hover:bg-stone-50/50">
                  <td className="px-4 py-3.5">
                    <div className="font-black text-stone-950 text-sm">{getApplicationPrimaryName(application)}</div>
                    <div className="mt-0.5 text-stone-500 font-medium">{application.ownerFullName}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <SellerTypeBadge sellerType={application.sellerType} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div>{application.businessPhone || application.user?.telephone || "No phone"}</div>
                    <div className="mt-0.5 text-stone-500 font-medium">{application.businessEmail || application.user?.email || "No email"}</div>
                  </td>
                  <td className="px-4 py-3.5 max-w-[200px] truncate text-ellipsis">
                    {getApplicationLocation(application) || "Not provided"}
                  </td>
                  <td className="px-4 py-3.5">
                    <div suppressHydrationWarning>Sub: {formatAdminDate(application.submittedAt || application.createdAt)}</div>
                    <div className="mt-0.5 text-stone-500 font-medium" suppressHydrationWarning>Rev: {formatAdminDate(application.reviewedAt)}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-stone-200 bg-white font-black text-stone-700 shadow-sm hover:bg-stone-50">
                        <Link href={`/admin/sellers/${application.id}`}>Review</Link>
                      </Button>
                      
                      {(canApprove || canSuspend) && (
                        <ActionMenu>
                          <ActionMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </ActionMenuTrigger>
                          <ActionMenuContent>
                            <ActionMenuNote>Manage Seller</ActionMenuNote>
                            <ActionMenuSeparator />
                            {canApprove && (
                              <>
                                <ActionMenuItem onClick={() => onOpenAction("approve-approved", application)}>
                                  Approve
                                </ActionMenuItem>
                                <ActionMenuItem onClick={() => onOpenAction("approve-provisional", application)}>
                                  Approve Provisional
                                </ActionMenuItem>
                                <ActionMenuItem onClick={() => onOpenAction("needs-info", application)}>
                                  Needs Info
                                </ActionMenuItem>
                                <ActionMenuItem onClick={() => onOpenAction("reject", application)} className="text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-500">
                                  Reject
                                </ActionMenuItem>
                              </>
                            )}
                            {canApprove && canSuspend && <ActionMenuSeparator />}
                            {canSuspend && (
                              <>
                                <ActionMenuItem onClick={() => onOpenAction("restrict", application)} className="text-amber-700 hover:bg-amber-50 focus-visible:ring-amber-500">
                                  Restrict
                                </ActionMenuItem>
                                <ActionMenuItem onClick={() => onOpenAction("suspend", application)} className="text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-500">
                                  Suspend
                                </ActionMenuItem>
                              </>
                            )}
                          </ActionMenuContent>
                        </ActionMenu>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Stacked View */}
      <div className={mobileView === "grid" ? "grid gap-4 md:hidden" : "md:hidden overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white/80 shadow-sm backdrop-blur-xl"}>
        {applications.map((application) => (
          <article
            key={application.id}
            className={mobileView === "grid" ? "flex flex-col gap-4 rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur-xl" : "p-3.5"}
          >
            {mobileView === "grid" ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-black text-stone-950">
                      {getApplicationPrimaryName(application)}
                    </h2>
                    <p className="mt-0.5 text-xs font-bold text-stone-500">{application.ownerFullName}</p>
                  </div>
                  <SellerMobileActionMenu application={application} onOpenAction={onOpenAction} canApprove={canApprove} canSuspend={canSuspend} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={application.status} />
                  <SellerTypeBadge sellerType={application.sellerType} />
                </div>

                <div className="rounded-[1rem] border border-stone-200 bg-stone-50/80 px-3">
                  <MobileSellerRow label="Contact" value={application.businessPhone || application.user?.telephone || "No phone"} />
                  <MobileSellerRow label="Location" value={getApplicationLocation(application) || "Not provided"} />
                  <MobileSellerRow label="Submitted" value={formatAdminDate(application.submittedAt || application.createdAt)} />
                  <MobileSellerRow label="Reviewed" value={formatAdminDate(application.reviewedAt)} isLast />
                </div>

                <Button asChild variant="outline" className="mt-1 w-full rounded-xl border-stone-200 bg-stone-50 font-black text-stone-900 shadow-sm hover:bg-stone-100">
                  <Link href={`/admin/sellers/${application.id}`}>Review Application</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[13px] font-black text-stone-950">{getApplicationPrimaryName(application)}</h2>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">{application.ownerFullName}</p>
                  </div>
                  <StatusBadge status={application.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-stone-600">
                  <span className="inline-flex items-center gap-1"><span className="text-[8px] font-black uppercase tracking-[0.16em] text-stone-400">Type</span><span>{application.sellerType === "REGISTERED_BUSINESS" ? "Business" : "Individual"}</span></span>
                  <span className="inline-flex items-center gap-1"><span className="text-[8px] font-black uppercase tracking-[0.16em] text-stone-400">Phone</span><span>{application.businessPhone || application.user?.telephone || "No phone"}</span></span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button asChild variant="outline" className="h-8 rounded-xl border-stone-200 bg-stone-50 px-3 font-black text-[10px] text-stone-900 shadow-sm hover:bg-stone-100">
                    <Link href={`/admin/sellers/${application.id}`}>Review</Link>
                  </Button>
                  <SellerMobileActionMenu application={application} onOpenAction={onOpenAction} canApprove={canApprove} canSuspend={canSuspend} />
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4 pb-8">
          <Button
            variant="outline"
            onClick={onLoadMore}
            className="rounded-full border-stone-200 bg-white px-8 font-black text-stone-700 shadow-sm hover:bg-stone-50"
          >
            Load more sellers
          </Button>
        </div>
      )}
    </div>
  );
}

function SellerMobileActionMenu({
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
  if (!canApprove && !canSuspend) return null;

  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </ActionMenuTrigger>
      <ActionMenuContent>
        <ActionMenuNote>Manage Seller</ActionMenuNote>
        <ActionMenuSeparator />
        {canApprove && (
          <>
            <ActionMenuItem onClick={() => onOpenAction("approve-approved", application)}>Approve</ActionMenuItem>
            <ActionMenuItem onClick={() => onOpenAction("approve-provisional", application)}>Approve Provisional</ActionMenuItem>
            <ActionMenuItem onClick={() => onOpenAction("needs-info", application)}>Needs Info</ActionMenuItem>
            <ActionMenuItem onClick={() => onOpenAction("reject", application)} className="text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-500">Reject</ActionMenuItem>
          </>
        )}
        {canApprove && canSuspend && <ActionMenuSeparator />}
        {canSuspend && (
          <>
            <ActionMenuItem onClick={() => onOpenAction("restrict", application)} className="text-amber-700 hover:bg-amber-50 focus-visible:ring-amber-500">Restrict</ActionMenuItem>
            <ActionMenuItem onClick={() => onOpenAction("suspend", application)} className="text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-500">Suspend</ActionMenuItem>
          </>
        )}
      </ActionMenuContent>
    </ActionMenu>
  );
}

function MobileSellerRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div className={`${!isLast ? "border-b border-stone-200" : ""} grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-2`}>
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-stone-500">{label}</span>
      <span className="truncate text-right text-[11px] font-bold text-stone-900">{value}</span>
    </div>
  );
}
