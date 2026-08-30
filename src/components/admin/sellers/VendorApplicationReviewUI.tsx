"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CheckCheck,
  Clock3,
  FileWarning,
  HandCoins,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAvailableVendorActions } from "@/features/admin-sellers/lib/vendor-action-availability";
import { cn } from "@/lib/utils";
import type { SellerApplicationStatus, SellerType, VendorApplication } from "@/types/seller";
import type { SellerReviewApplication } from "@/features/admin-sellers/types/seller-review.types";

import type { VendorApplicationAdminAction } from "@/features/admin-sellers/types/admin-seller.types";

const STATUS_META: Record<
  SellerApplicationStatus,
  {
    label: string;
    tone: string;
    chip: string;
    icon: React.ComponentType<{ className?: string }>;
    summary: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    tone: "text-zinc-600",
    chip: "border-zinc-300/70 bg-zinc-100/90 text-zinc-600",
    icon: FileWarning,
    summary: "Started but not submitted for review.",
  },
  SUBMITTED: {
    label: "Pending review",
    tone: "text-amber-700",
    chip: "border-amber-300/80 bg-amber-50 text-amber-700",
    icon: Clock3,
    summary: "Application submitted and waiting for admin review.",
  },
  NEEDS_INFO: {
    label: "More info needed",
    tone: "text-orange-700",
    chip: "border-orange-300/80 bg-orange-50 text-orange-700",
    icon: AlertTriangle,
    summary: "The seller has been asked to update their application before review can continue.",
  },
  PROVISIONAL: {
    label: "Provisional",
    tone: "text-sky-700",
    chip: "border-sky-300/80 bg-sky-50 text-sky-700",
    icon: ShieldCheck,
    summary: "Seller has provisional access. Draft product creation is open while full approval is pending.",
  },
  APPROVED: {
    label: "Approved",
    tone: "text-[#009E49]",
    chip: "border-emerald-300/80 bg-emerald-50 text-[#009E49]",
    icon: CheckCheck,
    summary: "Seller is fully approved. All selling capabilities are active.",
  },
  RESTRICTED: {
    label: "Restricted",
    tone: "text-orange-700",
    chip: "border-orange-300/80 bg-orange-50 text-orange-700",
    icon: ShieldAlert,
    summary: "Seller account is restricted. Key capabilities are limited but the store remains visible.",
  },
  SUSPENDED: {
    label: "Suspended",
    tone: "text-rose-600",
    chip: "border-rose-300/80 bg-rose-50 text-rose-600",
    icon: Ban,
    summary: "Seller is suspended. Selling actions are blocked.",
  },
  REJECTED: {
    label: "Rejected",
    tone: "text-rose-600",
    chip: "border-rose-300/80 bg-rose-50 text-rose-600",
    icon: Ban,
    summary: "Application has been rejected. The seller cannot proceed without a new application path.",
  },
};

const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  INDIVIDUAL: "Individual seller",
  REGISTERED_BUSINESS: "Registered business",
};

const ACTION_COPY: Record<
  VendorApplicationAdminAction,
  {
    title: string;
    description: string;
    confirmLabel: string;
    confirmClassName: string;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    noteLabel?: string;
    notePlaceholder?: string;
    requireReason?: boolean;
    requireNote?: boolean;
  }
> = {
  "approve-approved": {
    title: "Approve seller",
    description: "This grants full seller approval. Product review still remains separate.",
    confirmLabel: "Approve as approved",
    confirmClassName: "bg-[#009E49] text-white hover:bg-[#00853d]",
    noteLabel: "Admin notes",
    notePlaceholder: "Optional internal note for this approval",
  },
  "approve-provisional": {
    title: "Grant provisional access",
    description:
      "This opens limited seller capability. Draft product creation can be allowed while final approval is pending.",
    confirmLabel: "Approve as provisional",
    confirmClassName: "bg-sky-600 text-white hover:bg-sky-700",
    noteLabel: "Admin notes",
    notePlaceholder: "Optional note explaining why provisional access was granted",
  },
  "needs-info": {
    title: "Request more information",
    description:
      "The seller will be moved to NEEDS_INFO and should update the application before review continues.",
    confirmLabel: "Send needs-info request",
    confirmClassName: "bg-orange-600 text-white hover:bg-orange-700",
    reasonLabel: "Needs-info reason",
    reasonPlaceholder: "Explain exactly what the seller must update",
    noteLabel: "Admin notes",
    notePlaceholder: "Optional internal note",
    requireReason: true,
  },
  reject: {
    title: "Reject application",
    description:
      "This is a high-impact action. The seller will see the rejection reason and selling capability remains blocked.",
    confirmLabel: "Reject application",
    confirmClassName: "bg-rose-600 text-white hover:bg-rose-700",
    reasonLabel: "Rejection reason",
    reasonPlaceholder: "State the rejection reason clearly",
    noteLabel: "Admin notes",
    notePlaceholder: "Optional internal note",
    requireReason: true,
  },
  restrict: {
    title: "Restrict seller",
    description:
      "Restriction keeps the seller shell available while limiting important seller capabilities. Admin note is required.",
    confirmLabel: "Restrict seller",
    confirmClassName: "bg-amber-600 text-white hover:bg-amber-700",
    noteLabel: "Restriction note",
    notePlaceholder: "Explain why the seller is being restricted",
    requireNote: true,
  },
  suspend: {
    title: "Suspend seller",
    description:
      "Suspension blocks seller actions. This is a high-impact action and requires a clear admin note.",
    confirmLabel: "Suspend seller",
    confirmClassName: "bg-zinc-950 text-white hover:bg-zinc-800",
    noteLabel: "Suspension note",
    notePlaceholder: "Explain why the seller is being suspended",
    requireNote: true,
  },
};

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat("en-ZM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getStatusMeta(status: SellerApplicationStatus) {
  return STATUS_META[status];
}

export function getSellerTypeLabel(type: SellerType) {
  return SELLER_TYPE_LABELS[type];
}

type ReviewDialogApplication = Pick<
  SellerReviewApplication,
  "id" | "status" | "sellerType" | "ownerFullName" | "storeName" | "legalBusinessName"
> & { businessName?: string };

export function getApplicationPrimaryName(
  application: Pick<VendorApplication, "storeName" | "legalBusinessName" | "businessName"> | ReviewDialogApplication,
) {
  return application.storeName || application.legalBusinessName || application.businessName || "Untitled seller";
}

export function getApplicationLocation(application: VendorApplication) {
  return [application.district, application.businessAddress].filter(Boolean).join(", ");
}

export function matchesApplicationSearch(application: VendorApplication, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    application.storeName,
    application.ownerFullName,
    application.businessPhone,
    application.businessEmail,
    application.user?.telephone,
    application.user?.email,
    application.legalBusinessName,
    application.businessName,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function StatusBadge({ status }: { status: SellerApplicationStatus }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
        meta.chip,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function SellerTypeBadge({ sellerType }: { sellerType: SellerType }) {
  return (
    <span className="inline-flex rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
      {getSellerTypeLabel(sellerType)}
    </span>
  );
}

export function DocumentCard({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const hasValue = Boolean(value?.trim());

  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/72 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      {hasValue ? (
        <a
          href={value!}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-3.5 py-3 text-sm font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100/80"
        >
          <span className="truncate">{value}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0" />
        </a>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm font-bold text-zinc-400">
          Not provided yet
        </div>
      )}
    </div>
  );
}

export function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.2rem] border border-white/60 bg-white/65 px-3.5 py-3 backdrop-blur-xl">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-emerald-300 shadow-md shadow-zinc-950/10">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <p className="mt-1 break-words text-sm font-bold text-zinc-900">{value || "Unavailable"}</p>
      </div>
    </div>
  );
}

export function ReasonBanner({
  title,
  body,
  tone = "warning",
}: {
  title: string;
  body: string;
  tone?: "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200/70 bg-rose-50/85 text-rose-800"
      : tone === "neutral"
        ? "border-zinc-200/70 bg-zinc-50/90 text-zinc-800"
        : "border-orange-200/70 bg-orange-50/85 text-orange-800";

  return (
    <div className={cn("rounded-[1.45rem] border p-4", toneClass)}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em]">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6">{body}</p>
    </div>
  );
}

export function DetailStatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.45rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(240,253,244,0.74))] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <p className="mt-2 text-xl font-black tracking-[-0.03em] text-zinc-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-zinc-500">{note}</p>
    </div>
  );
}

interface SellerReviewActionDialogProps {
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

  const copy = useMemo(() => (action ? ACTION_COPY[action] : null), [action]);

  if (!copy || !application) return null;
  const actionCopy = copy;
  const reasonId = `seller-review-${application.id}-reason`;
  const noteId = `seller-review-${application.id}-note`;

  async function handleConfirm() {
    if (actionCopy.requireReason && reason.trim().length < 5) return;
    if (actionCopy.requireNote && adminNotes.trim().length < 5) return;
    await onConfirm({ reason: reason.trim(), adminNotes: adminNotes.trim() });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReason("");
      setAdminNotes("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl rounded-[1.9rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-0 shadow-[0_28px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
        <DialogHeader className="border-b border-zinc-100 bg-zinc-950 px-6 py-5 text-white">
          <DialogTitle className="text-xl font-black text-white">{actionCopy.title}</DialogTitle>
          <DialogDescription className="text-sm font-semibold text-zinc-400">
            {actionCopy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-[1.45rem] border border-emerald-200/60 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.85))] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={application.status} />
              <SellerTypeBadge sellerType={application.sellerType} />
            </div>
            <p className="mt-3 text-lg font-black tracking-[-0.03em] text-zinc-950">
              {getApplicationPrimaryName(application)}
            </p>
            <p className="mt-1 text-sm font-bold text-zinc-500">{application.ownerFullName}</p>
          </div>

          {actionCopy.reasonLabel ? (
            <div className="space-y-2">
              <label htmlFor={reasonId} className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                {actionCopy.reasonLabel}
              </label>
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={actionCopy.reasonPlaceholder}
                className="min-h-28 rounded-[1.2rem] border-zinc-200 bg-white text-sm font-medium"
              />
            </div>
          ) : null}

          {actionCopy.noteLabel ? (
            <div className="space-y-2">
              <label htmlFor={noteId} className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                {actionCopy.noteLabel}
              </label>
              {actionCopy.requireNote ? (
                <Textarea
                  id={noteId}
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  placeholder={actionCopy.notePlaceholder}
                  className="min-h-28 rounded-[1.2rem] border-zinc-200 bg-white text-sm font-medium"
                />
              ) : (
                <Input
                  id={noteId}
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  placeholder={actionCopy.notePlaceholder}
                  className="h-11 rounded-[1.1rem] border-zinc-200 bg-white text-sm font-medium"
                />
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-3 border-t border-zinc-100 px-6 py-5 sm:justify-between">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="min-h-11 rounded-xl border-zinc-200 font-black">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              submitting ||
              (actionCopy.requireReason && reason.trim().length < 5) ||
              (actionCopy.requireNote && adminNotes.trim().length < 5)
            }
            className={cn("min-h-11 rounded-xl font-black", actionCopy.confirmClassName)}
          >
            {actionCopy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export function AdminSellerActionButtons({
  application,
  onOpenAction,
  canApprove,
  canSuspend,
  detailHref,
}: {
  application: VendorApplication;
  onOpenAction: (action: VendorApplicationAdminAction, application: VendorApplication) => void;
  canApprove: boolean;
  canSuspend: boolean;
  detailHref?: string;
}) {
  const availableActions = getAvailableVendorActions(application, canApprove, canSuspend);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {detailHref ? (
        <Button asChild variant="outline" size="sm" className="rounded-xl border-zinc-200 bg-white/80 font-black">
          <Link href={detailHref}>Review</Link>
        </Button>
      ) : null}

      {availableActions.includes("approve-approved") && (
        <Button size="sm" onClick={() => onOpenAction("approve-approved", application)} className="rounded-xl bg-[#009E49] font-black text-white hover:bg-[#00853d]">
          Approve
        </Button>
      )}
      {availableActions.includes("approve-provisional") && (
        <Button size="sm" variant="outline" onClick={() => onOpenAction("approve-provisional", application)} className="rounded-xl border-sky-200 bg-sky-50/80 font-black text-sky-700 hover:bg-sky-100">
          Provisional
        </Button>
      )}
      {availableActions.includes("needs-info") && (
        <Button size="sm" variant="outline" onClick={() => onOpenAction("needs-info", application)} className="rounded-xl border-orange-200 bg-orange-50/80 font-black text-orange-700 hover:bg-orange-100">
          Needs info
        </Button>
      )}
      {availableActions.includes("reject") && (
        <Button size="sm" variant="outline" onClick={() => onOpenAction("reject", application)} className="rounded-xl border-rose-200 bg-rose-50/80 font-black text-rose-700 hover:bg-rose-100">
          Reject
        </Button>
      )}
      {availableActions.includes("restrict") && (
        <Button size="sm" variant="outline" onClick={() => onOpenAction("restrict", application)} className="rounded-xl border-amber-200 bg-amber-50/85 font-black text-amber-700 hover:bg-amber-100">
          Restrict
        </Button>
      )}
      {availableActions.includes("suspend") && (
        <Button size="sm" variant="outline" onClick={() => onOpenAction("suspend", application)} className="rounded-xl border-zinc-200 bg-zinc-950 font-black text-white hover:bg-zinc-800">
          Suspend
        </Button>
      )}
    </div>
  );
}

export function TrustSignal({ verified, label }: { verified: boolean; label: string }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-[1.1rem] border px-3.5 py-2.5",
      verified
        ? "border-emerald-200/80 bg-emerald-50/80 text-[#009E49]"
        : "border-stone-200/80 bg-stone-50 text-stone-500",
    )}>
      <div className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
        verified ? "bg-[#009E49] text-white" : "bg-stone-200 text-stone-500",
      )}>
        {verified ? "✓" : "–"}
      </div>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}

export function SellerIdentityBlock({ application }: { application: VendorApplication }) {
  const emailVerified = application.user?.emailVerified ?? false;
  const phoneVerified = Boolean(application.user?.phoneVerifiedAt);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetaRow icon={Store} label="Store / business" value={getApplicationPrimaryName(application)} />
        <MetaRow icon={ShieldCheck} label="Owner full name" value={application.ownerFullName || "Unavailable"} />
        <MetaRow icon={Phone} label="Business phone" value={application.businessPhone || application.user?.telephone || "Unavailable"} />
        <MetaRow icon={Mail} label="Business email" value={application.businessEmail || application.user?.email || "Unavailable"} />
        <MetaRow icon={MapPin} label="Location" value={getApplicationLocation(application) || "Unavailable"} />
        <MetaRow icon={HandCoins} label="Payout details" value={[application.payoutProvider, application.payoutPhone].filter(Boolean).join(" • ") || "Unavailable"} />
      </div>
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">Account trust signals</p>
        <div className="flex flex-wrap gap-2">
          <TrustSignal verified={emailVerified} label={emailVerified ? "Email verified" : "Email not verified"} />
          <TrustSignal verified={phoneVerified} label={phoneVerified ? "Phone on file" : "Phone not on file"} />
          <TrustSignal verified={Boolean(application.user?.isActive)} label={application.user?.isActive ? "Account active" : "Account inactive"} />
        </div>
      </div>
    </div>
  );
}
