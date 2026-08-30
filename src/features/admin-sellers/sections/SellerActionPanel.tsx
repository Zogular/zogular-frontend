"use client";

import { Ban, CheckCheck, MessageSquareWarning, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toVendorApplicationAdminActions, type VendorApplicationAdminAction } from "../types/admin-seller.types";
import type { SellerReviewCapabilities } from "../types/seller-review.types";

const ACTION_UI: Record<VendorApplicationAdminAction, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  "approve-approved": { label: "Approve seller", icon: CheckCheck, className: "bg-[var(--admin-canopy)] text-white hover:bg-[var(--admin-canopy-deep)]" },
  "approve-provisional": { label: "Grant provisional access", icon: ShieldCheck, className: "border-[color:rgba(7,91,54,0.26)] bg-[color:rgba(7,91,54,0.07)] text-[var(--admin-canopy)] hover:bg-[color:rgba(7,91,54,0.12)]" },
  "needs-info": { label: "Request information", icon: MessageSquareWarning, className: "border-[color:rgba(217,106,31,0.3)] bg-[color:rgba(217,106,31,0.08)] text-[var(--admin-ember)] hover:bg-[color:rgba(217,106,31,0.14)]" },
  reject: { label: "Reject application", icon: Ban, className: "border-[color:rgba(184,59,50,0.3)] bg-[color:rgba(184,59,50,0.07)] text-[var(--admin-escalation)] hover:bg-[color:rgba(184,59,50,0.12)]" },
  restrict: { label: "Restrict seller", icon: ShieldAlert, className: "border-[color:rgba(217,106,31,0.3)] bg-[color:rgba(217,106,31,0.08)] text-[var(--admin-ember)] hover:bg-[color:rgba(217,106,31,0.14)]" },
  suspend: { label: "Suspend seller", icon: Ban, className: "border-[color:rgba(184,59,50,0.3)] bg-[color:rgba(184,59,50,0.07)] text-[var(--admin-escalation)] hover:bg-[color:rgba(184,59,50,0.12)]" },
};

export function SellerActionPanel({ capabilities, disabled, compact = false, onAction }: { capabilities: SellerReviewCapabilities; disabled: boolean; compact?: boolean; onAction: (action: VendorApplicationAdminAction) => void }) {
  const actions = toVendorApplicationAdminActions(capabilities.availableActions);

  if (compact && actions.length === 0) return null;

  return (
    <section className={`rounded-2xl border border-[color:rgba(184,135,70,0.34)] bg-[var(--admin-surface-cream)] shadow-[0_14px_32px_rgba(6,59,41,0.09)] ${compact ? "p-2" : "p-4"}`} aria-label="Seller review actions">
      <h2 className={compact ? "sr-only" : "text-sm font-semibold text-[var(--admin-ink)]"}>Review actions</h2>
      <p className={compact ? "sr-only" : "mt-1 text-xs leading-5 text-[var(--admin-ink-soft)]"}>
        {capabilities.canManageStatus ? "Choose an action provided for this application." : "Your role does not include seller status changes."}
      </p>
      {actions.length ? (
        <div className={compact ? "flex max-w-full gap-2 overflow-x-auto overscroll-x-contain" : "mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1"}>
          {actions.map((action) => {
            const meta = ACTION_UI[action];
            const Icon = meta.icon;
            return <Button key={action} type="button" variant={action === "approve-approved" ? "default" : "outline"} disabled={disabled} onClick={() => onAction(action)} className={`min-h-11 justify-start rounded-xl text-xs font-semibold ${compact ? "shrink-0" : ""} ${meta.className}`}><Icon className="size-4" />{meta.label}</Button>;
          })}
        </div>
      ) : <p className="mt-3 rounded-xl bg-[var(--admin-surface-mist)] p-3 text-sm text-[var(--admin-ink-soft)]">No actions are available for the current status.</p>}
    </section>
  );
}
