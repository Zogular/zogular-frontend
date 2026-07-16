"use client";

import {
  Ban,
  CheckCheck,
  ChevronDown,
  MessageSquareWarning,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";
import { getAvailableVendorActions } from "@/features/admin-sellers/lib/vendor-action-availability";
import type { VendorApplication } from "@/types/seller";

export function SellerActionPanel({
  application,
  onAction,
  canApprove,
  canSuspend,
}: {
  application: VendorApplication;
  onAction: (action: VendorApplicationAdminAction) => void;
  canApprove: boolean;
  canSuspend: boolean;
}) {
  const availableActions = getAvailableVendorActions(application, canApprove, canSuspend);

  if (availableActions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-stone-200/50 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] sm:p-5">
      <h2 className="text-sm font-black tracking-tight text-stone-900">Review actions</h2>
      <p className="mt-0.5 text-[11px] font-medium text-stone-500">
        Take action on this seller application.
      </p>

      <div className="mt-4 space-y-2">
        {availableActions.includes("approve-approved") && (
          <Button
            onClick={() => onAction("approve-approved")}
            className="h-9 w-full justify-start gap-2 rounded-xl bg-[#009E49] text-xs font-bold text-white shadow-sm shadow-emerald-900/15 hover:bg-[#00853d]"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Approve seller
          </Button>
        )}

        {availableActions.includes("approve-provisional") && (
          <Button
            variant="outline"
            onClick={() => onAction("approve-provisional")}
            className="h-9 w-full justify-start gap-2 rounded-xl border-sky-200 bg-sky-50/70 text-xs font-bold text-sky-700 hover:bg-sky-100"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Grant provisional access
          </Button>
        )}

        {availableActions.includes("needs-info") && (
          <Button
            variant="outline"
            onClick={() => onAction("needs-info")}
            className="h-9 w-full justify-start gap-2 rounded-xl border-amber-200 bg-amber-50/70 text-xs font-bold text-amber-700 hover:bg-amber-100"
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            Request more information
          </Button>
        )}

        {(availableActions.includes("reject") || availableActions.includes("restrict") || availableActions.includes("suspend")) && (
          <div className="pt-1">
            <ActionMenu>
              <ActionMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-between gap-2 rounded-xl border-stone-200 bg-stone-50/80 text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  <span className="flex items-center gap-2">
                    <MoreVertical className="h-3.5 w-3.5" />
                    More actions
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </ActionMenuTrigger>
              <ActionMenuContent className="w-52">
                {availableActions.includes("reject") && (
                  <ActionMenuItem
                    onClick={() => onAction("reject")}
                    className="text-rose-700 hover:bg-rose-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Reject application
                  </ActionMenuItem>
                )}

                {(availableActions.includes("restrict") || availableActions.includes("suspend")) && (
                  <>
                    {availableActions.includes("reject") ? <ActionMenuSeparator /> : null}

                    {availableActions.includes("restrict") && (
                      <ActionMenuItem
                        onClick={() => onAction("restrict")}
                        className="text-amber-700 hover:bg-amber-50"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Restrict seller
                      </ActionMenuItem>
                    )}

                    {availableActions.includes("suspend") && (
                      <ActionMenuItem
                        onClick={() => onAction("suspend")}
                        className="text-stone-700 hover:bg-stone-100"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Suspend seller
                      </ActionMenuItem>
                    )}
                  </>
                )}
              </ActionMenuContent>
            </ActionMenu>
          </div>
        )}
      </div>
    </section>
  );
}
