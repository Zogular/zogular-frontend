"use client";

import {
  ArrowUpRight,
  HandCoins,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VendorApplication } from "@/types/seller";

import {
  getApplicationLocation,
  getApplicationPrimaryName,
} from "@/features/admin-sellers/lib/seller-formatters";

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
