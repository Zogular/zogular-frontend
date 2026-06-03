import { AlertCircle, CheckCircle2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ChecklistItem, SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import Link from "next/link";
import { StatusBadge } from "./shared/status-badge";

export function ApplicationReviewRail({
  viewModel,
  onSave,
  onSubmit,
  saving,
  submitting,
  uploading,
}: {
  viewModel: SellerOnboardingViewModel;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
  uploading: boolean;
}) {
  return (
    <aside className="sticky top-24 space-y-4">
      <ReadinessChecklist items={viewModel.readiness} />
      <TrustControlsCard items={viewModel.trustControls} />
      <MissingItemsCard items={viewModel.missingItems} />
      <SubmitControlCard
        viewModel={viewModel}
        onSave={onSave}
        onSubmit={onSubmit}
        saving={saving}
        submitting={submitting}
        uploading={uploading}
      />
    </aside>
  );
}

function RailCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#E9E1D6] bg-[#FFFCF8] p-5 shadow-[0_18px_48px_rgba(31,26,20,0.06)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8924F]">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-black tracking-tight text-[#1F1A14]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const ready = item.status === "ready" || item.status === "verified";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${ready ? "border-[#CBEBD8] bg-[#E9F8EF]/70" : "border-[#F0DDB7] bg-[#F5EAD5]/55"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#1F1A14]">{item.label}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#6F6A62]">{item.description}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

function ReadinessChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <RailCard eyebrow="Application" title="Checklist">
      <div className="space-y-2.5">
        {items.map((item) => (
          <ChecklistRow key={item.label} item={item} />
        ))}
      </div>
    </RailCard>
  );
}

function TrustControlsCard({ items }: { items: ChecklistItem[] }) {
  return (
    <RailCard eyebrow="Trust checks" title="Account checks">
      <div className="space-y-3">
        {items.map((item) => {
          const isPhone = item.label.toLowerCase().includes("phone");
          const isEmail = item.label.toLowerCase().includes("email");
          const isVerified = item.status === "verified" || item.status === "ready";
          const href = isPhone ? "/seller/verify-phone" : isEmail ? "/auth/check-email" : undefined;
          const ctaLabel = isPhone ? "Verify phone" : isEmail ? "Verify email" : "Verify";

          return (
            <div key={item.label} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#E9F8EF] text-[#0A7A42]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#1F1A14]">{item.label}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-[#6F6A62]">{item.description}</p>
                {!isVerified && href ? (
                  <div className="mt-2">
                    <Link href={href}>
                      <Button variant="outline" size="sm" className="h-7 rounded-lg border-[#D8C9B8] px-3 text-xs font-bold text-[#1F1A14] hover:bg-white">
                        {ctaLabel}
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </RailCard>
  );
}

function MissingItemsCard({ items }: { items: string[] }) {
  return (
    <RailCard eyebrow="Next steps" title="Please complete these items">
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl bg-[#E9F8EF] px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0A7A42]" />
            <p className="text-sm font-bold text-[#1F1A14]">Everything needed is ready.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-2xl bg-[#FBF6EE] px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#B8924F]" />
              <p className="text-sm font-bold text-[#1F1A14]">{item}</p>
            </div>
          ))
        )}
      </div>
    </RailCard>
  );
}

function SubmitControlCard({
  viewModel,
  onSave,
  onSubmit,
  saving,
  submitting,
  uploading,
}: {
  viewModel: SellerOnboardingViewModel;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
  uploading: boolean;
}) {
  const submitDisabled = !viewModel.canSubmit || saving || submitting || uploading;

  return (
    <RailCard eyebrow="Send application" title="Ready to send">
      <div className="rounded-2xl border border-[#E9E1D6] bg-[#FBF6EE] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-[#1F1A14]">{viewModel.statusLabel}</p>
          <StatusBadge status={viewModel.canSubmit ? "ready" : "draft"} label={viewModel.statusLabel} />
        </div>
        <p className="mt-2 text-sm font-medium leading-6 text-[#6F6A62]">
          {viewModel.submitDisabledReason}
        </p>
      </div>
      <Separator className="my-4 bg-[#E9E1D6]" />
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          onClick={onSave}
          disabled={saving || submitting || uploading || !viewModel.canEdit}
          className="h-11 w-full rounded-2xl border-[#D8C9B8] bg-[#FFFCF8] font-black text-[#1F1A14] hover:bg-white"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save progress"}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="h-11 w-full rounded-2xl bg-[#09281C] font-black text-white opacity-100 shadow-none disabled:bg-[#09281C]/35"
        >
          <Send className="mr-2 h-4 w-4" />
          {submitting ? "Sending..." : "Submit for review"}
        </Button>
      </div>
    </RailCard>
  );
}
