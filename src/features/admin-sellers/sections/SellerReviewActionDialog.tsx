"use client";

/**
 * @file SellerReviewActionDialog.tsx
 * @description
 * Modular, accessible review decision modal for admin seller applications.
 * Features unambiguous visual differentiation between destructive actions (Decline/Reject),
 * information request actions (Needs Info), and approval actions (Full/Provisional),
 * using warm Zambian admin design tokens and plain operator language.
 */

import { useMemo, useState } from "react";
import {
  Ban,
  CheckCheck,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";
import { StatusBadge } from "../components/StatusBadge";
import {
  getApplicationPrimaryName,
  getSellerTypeLabel,
} from "../lib/seller-formatters";
import type { SellerReviewApplication } from "../types/seller-review.types";

export type ReviewDialogApplication = Pick<
  SellerReviewApplication,
  "id" | "status" | "sellerType" | "ownerFullName" | "storeName" | "legalBusinessName"
> & { businessName?: string };

interface ActionThemeConfig {
  title: string;
  badgeLabel: string;
  description: string;
  bannerTitle: string;
  bannerDescription: string;
  bannerTone: "amber" | "rose" | "emerald" | "sky" | "zinc";
  icon: React.ComponentType<{ className?: string }>;
  confirmLabel: string;
  confirmClassName: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  requireReason?: boolean;
  requireNote?: boolean;
}

const ACTION_CONFIGS: Record<VendorApplicationAdminAction, ActionThemeConfig> = {
  "approve-approved": {
    title: "Approve seller",
    badgeLabel: "Full Approval",
    description: "Approve seller for complete marketplace catalogue access and active transactions.",
    bannerTitle: "Approving Seller Account",
    bannerDescription:
      "Records full marketplace approval for this seller account. Product listings remain subject to standard catalogue moderation.",
    bannerTone: "emerald",
    icon: CheckCheck,
    confirmLabel: "Approve seller",
    confirmClassName:
      "bg-[var(--admin-canopy)] text-white hover:bg-[var(--admin-canopy-deep)] font-black",
    noteLabel: "Internal admin notes",
    notePlaceholder: "Optional verification notes or comments",
  },
  "approve-provisional": {
    title: "Grant provisional access",
    badgeLabel: "Provisional Access",
    description: "Approve seller with provisional listing limits while final vetting completes.",
    bannerTitle: "Granting Provisional Access",
    bannerDescription:
      "Records provisional selling privileges with introductory listing limits while compliance vetting concludes.",
    bannerTone: "sky",
    icon: ShieldCheck,
    confirmLabel: "Grant provisional access",
    confirmClassName: "bg-sky-700 text-white hover:bg-sky-800 font-black",
    noteLabel: "Internal admin notes",
    notePlaceholder: "State terms or conditions for provisional approval",
  },
  "needs-info": {
    title: "Request information",
    badgeLabel: "Needs Info",
    description: "Pause review and ask applicant for additional details.",
    bannerTitle: "Request Information",
    bannerDescription:
      "This records your request and moves the application to Needs Info.",
    bannerTone: "amber",
    icon: MessageSquareWarning,
    confirmLabel: "Request information",
    confirmClassName:
      "bg-[var(--admin-ember)] text-white hover:bg-[color-mix(in_srgb,var(--admin-ember)_88%,black)] font-black",
    reasonLabel: "Information or documents required (visible to seller)",
    reasonPlaceholder: "Clearly describe the missing document, unclear identity detail, or required business update...",
    noteLabel: "Internal admin notes (private)",
    notePlaceholder: "Optional private note for audit tracking",
    requireReason: true,
  },
  reject: {
    title: "Decline application",
    badgeLabel: "Decline Application",
    description: "Decline this application and record the adverse decision.",
    bannerTitle: "Decline Application",
    bannerDescription:
      "This records the decision and moves the application to Rejected. Selling access remains unavailable.",
    bannerTone: "rose",
    icon: Ban,
    confirmLabel: "Decline application",
    confirmClassName:
      "bg-[var(--admin-escalation)] text-white hover:bg-[color-mix(in_srgb,var(--admin-escalation)_88%,black)] font-black",
    reasonLabel: "Reason for declining (visible to applicant)",
    reasonPlaceholder: "State the compliance, fraud, or policy basis for declining this application...",
    noteLabel: "Internal compliance notes (private)",
    notePlaceholder: "Optional private internal compliance note",
    requireReason: true,
  },
  restrict: {
    title: "Restrict account",
    badgeLabel: "Account Restriction",
    description: "Apply capabilities restrictions to an active seller account.",
    bannerTitle: "Restricting Account",
    bannerDescription:
      "Records an operational restriction on the seller account while keeping account records intact for operator review.",
    bannerTone: "amber",
    icon: ShieldAlert,
    confirmLabel: "Restrict account",
    confirmClassName:
      "bg-[var(--admin-ember)] text-white hover:bg-[color-mix(in_srgb,var(--admin-ember)_88%,black)] font-black",
    reasonLabel: "Reason for restriction (visible to seller)",
    reasonPlaceholder: "State the reason for restricting account capabilities...",
    noteLabel: "Internal admin notes (private)",
    notePlaceholder: "Optional private internal note for review tracking",
    requireReason: true,
  },
  suspend: {
    title: "Suspend account",
    badgeLabel: "Account Suspension",
    description: "Fully suspend seller account and freeze all marketplace operations.",
    bannerTitle: "Suspending Account",
    bannerDescription:
      "Records an immediate suspension freezing all storefront activity and seller marketplace access.",
    bannerTone: "rose",
    icon: Ban,
    confirmLabel: "Suspend account",
    confirmClassName:
      "bg-[var(--admin-escalation)] text-white hover:bg-[color-mix(in_srgb,var(--admin-escalation)_88%,black)] font-black",
    reasonLabel: "Reason for suspension (visible to seller)",
    reasonPlaceholder: "State the policy basis or violation for suspending account access...",
    noteLabel: "Internal compliance notes (private)",
    notePlaceholder: "Optional private internal compliance note",
    requireReason: true,
  },
};

export interface SellerReviewActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: VendorApplicationAdminAction | null;
  application: ReviewDialogApplication | null;
  submitting?: boolean;
  onConfirm: (payload: { reason?: string; adminNotes?: string }) => Promise<void> | void;
}

export function SellerReviewActionDialog({
  open,
  onOpenChange,
  action,
  application,
  submitting = false,
  onConfirm,
}: SellerReviewActionDialogProps) {
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const config = useMemo(() => (action ? ACTION_CONFIGS[action] : null), [action]);

  if (!config || !application) return null;

  const reasonId = `seller-review-${application.id}-reason`;
  const noteId = `seller-review-${application.id}-note`;
  const Icon = config.icon;

  async function handleConfirm() {
    if (config?.requireReason && reason.trim().length < 5) return;
    if (config?.requireNote && adminNotes.trim().length < 5) return;
    await onConfirm({ reason: reason.trim(), adminNotes: adminNotes.trim() });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReason("");
      setAdminNotes("");
    }
    onOpenChange(nextOpen);
  }

  const isConfirmDisabled =
    submitting ||
    Boolean(config.requireReason && reason.trim().length < 5) ||
    Boolean(config.requireNote && adminNotes.trim().length < 5);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] p-0 shadow-[0_28px_80px_rgba(6,59,41,0.22)]">
        {/* Color-coded Header Bar */}
        <DialogHeader
          className={cn(
            "border-b px-6 py-5 text-left",
            config.bannerTone === "rose" &&
              "border-rose-200 bg-[color-mix(in_srgb,var(--admin-escalation)_12%,var(--admin-surface-cream))]",
            config.bannerTone === "amber" &&
              "border-amber-200 bg-[color-mix(in_srgb,var(--admin-ember)_12%,var(--admin-surface-cream))]",
            config.bannerTone === "emerald" &&
              "border-emerald-200 bg-[color-mix(in_srgb,var(--admin-canopy)_12%,var(--admin-surface-cream))]",
            config.bannerTone === "sky" && "border-sky-200 bg-sky-50",
            config.bannerTone === "zinc" && "border-zinc-200 bg-zinc-100",
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                config.bannerTone === "rose" && "bg-rose-100 text-[var(--admin-escalation)]",
                config.bannerTone === "amber" && "bg-amber-100 text-[var(--admin-ember)]",
                config.bannerTone === "emerald" && "bg-emerald-100 text-[var(--admin-canopy)]",
                config.bannerTone === "sky" && "bg-sky-100 text-sky-800",
                config.bannerTone === "zinc" && "bg-zinc-200 text-zinc-800",
              )}
            >
              <Icon className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-black text-[var(--admin-ink)]">
                {config.title}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-[var(--admin-ink-soft)]">
                {config.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {/* Action Context Guidance Banner */}
          <div
            className={cn(
              "rounded-xl border p-3.5 text-xs leading-5",
              config.bannerTone === "rose" && "border-rose-200 bg-rose-50/70 text-rose-950",
              config.bannerTone === "amber" && "border-amber-200 bg-amber-50/70 text-amber-950",
              config.bannerTone === "emerald" && "border-emerald-200 bg-emerald-50/70 text-emerald-950",
              config.bannerTone === "sky" && "border-sky-200 bg-sky-50/70 text-sky-950",
            )}
          >
            <p className="font-bold">{config.bannerTitle}</p>
            <p className="mt-0.5 font-medium">{config.bannerDescription}</p>
          </div>

          {/* Seller Application Identity Snippet */}
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[var(--admin-surface-mist)] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={application.status} />
              <span className="rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)] bg-[var(--admin-surface-cream)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--admin-ink-soft)]">
                {getSellerTypeLabel(application.sellerType)}
              </span>
            </div>
            <p className="mt-2 text-base font-black tracking-[-0.02em] text-[var(--admin-canopy-deep)]">
              {getApplicationPrimaryName(application)}
            </p>
            <p className="text-xs font-semibold text-[var(--admin-ink-soft)]">
              Applicant: {application.ownerFullName}
            </p>
          </div>

          {/* User-facing Reason Textarea */}
          {config.reasonLabel ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={reasonId}
                  className="text-[11px] font-black uppercase tracking-wider text-[var(--admin-ink)]"
                >
                  {config.reasonLabel}
                </label>
                {config.requireReason ? (
                  <span className="text-[10px] font-bold text-[var(--admin-escalation)]">
                    Required (min 5 chars)
                  </span>
                ) : null}
              </div>
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={config.reasonPlaceholder}
                className={cn(
                  "min-h-24 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-white text-xs font-medium leading-relaxed text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-2",
                  config.bannerTone === "rose" && "focus-visible:ring-[var(--admin-escalation)]",
                  config.bannerTone === "amber" && "focus-visible:ring-[var(--admin-ember)]",
                  config.bannerTone === "emerald" && "focus-visible:ring-[var(--admin-canopy)]",
                )}
              />
            </div>
          ) : null}

          {/* Admin Internal Notes Input */}
          {config.noteLabel ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={noteId}
                  className="text-[11px] font-black uppercase tracking-wider text-[var(--admin-ink-soft)]"
                >
                  {config.noteLabel}
                </label>
                {config.requireNote ? (
                  <span className="text-[10px] font-bold text-[var(--admin-escalation)]">
                    Required (min 5 chars)
                  </span>
                ) : null}
              </div>
              {config.requireNote ? (
                <Textarea
                  id={noteId}
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  placeholder={config.notePlaceholder}
                  className="min-h-20 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-white text-xs font-medium leading-relaxed text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)]"
                />
              ) : (
                <Input
                  id={noteId}
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  placeholder={config.notePlaceholder}
                  className="h-10 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-white text-xs font-medium text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)]"
                />
              )}
            </div>
          ) : null}
        </div>

        {/* Action Controls Footer */}
        <DialogFooter className="gap-2 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[var(--admin-surface-mist)] px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="h-10 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] px-4 text-xs font-bold text-[var(--admin-ink)] hover:bg-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn("h-10 rounded-xl px-4 text-xs shadow-sm", config.confirmClassName)}
          >
            {submitting ? "Processing..." : config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
