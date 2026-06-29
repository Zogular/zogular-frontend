import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";
import type { VendorApplication } from "@/types/seller";
import {
  getSellerStatusCapabilitySummary,
  getSellerStatusMeta,
} from "@/services/vendor-application";

function statusIcon(status: VendorApplication["status"]) {
  if (status === "APPROVED") return <CheckCircle2 className="h-5 w-5" />;
  if (status === "PROVISIONAL") return <ShieldCheck className="h-5 w-5" />;
  if (status === "NEEDS_INFO" || status === "RESTRICTED") return <AlertTriangle className="h-5 w-5" />;
  if (status === "SUSPENDED" || status === "REJECTED") return <ShieldBan className="h-5 w-5" />;
  if (status === "SUBMITTED") return <Clock3 className="h-5 w-5" />;
  return <Info className="h-5 w-5" />;
}

function toneClass(tone: ReturnType<typeof getSellerStatusMeta>["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50/90 text-emerald-950";
  if (tone === "warning") return "border-amber-200 bg-amber-50/90 text-amber-950";
  if (tone === "danger") return "border-red-200 bg-red-50/90 text-red-950";
  return "border-zinc-200 bg-white/85 text-zinc-950";
}

function eyebrowClass(tone: ReturnType<typeof getSellerStatusMeta>["tone"]) {
  if (tone === "success") return "text-emerald-700";
  if (tone === "warning") return "text-amber-700";
  if (tone === "danger") return "text-red-700";
  return "text-[#009E49]";
}

export function SellerStatusNotice({
  application,
  compact = false,
}: {
  application: VendorApplication;
  compact?: boolean;
}) {
  const meta = getSellerStatusMeta(application.status);
  const capabilitySummary = getSellerStatusCapabilitySummary(application.status);
  const showSupportFallback =
    application.status === "RESTRICTED" ||
    application.status === "SUSPENDED" ||
    application.status === "REJECTED";

  return (
    <section className={cn("rounded-3xl border p-4 shadow-sm backdrop-blur-xl md:p-5", toneClass(meta.tone))}>
      <div className={cn("flex gap-3", compact ? "items-start" : "items-start md:items-center")}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/75 shadow-inner">
          {statusIcon(application.status)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-black uppercase tracking-[0.18em]", eyebrowClass(meta.tone))}>
            {meta.eyebrow}
          </p>
          <h2 className="mt-1 text-base font-black tracking-tight md:text-lg">{meta.title}</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-700">{meta.description}</p>
          <div
            className={cn(
              "mt-4 grid gap-3",
              compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
            )}
          >
            <StatusCapabilityCard
              title="Available now"
              tone={meta.tone}
              items={capabilitySummary.availableNow}
            />
            <StatusCapabilityCard
              title="Still blocked or pending"
              tone={meta.tone}
              items={capabilitySummary.blockedOrPending}
            />
          </div>
          {application.needsInfoReason ? (
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
                What to fix
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-6 text-zinc-800">
                {application.needsInfoReason}
              </p>
            </div>
          ) : null}
          {application.rejectionReason ? (
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">
                Reason
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-6 text-zinc-800">
                {application.rejectionReason}
              </p>
            </div>
          ) : null}
          {application.adminNotes ? (
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Latest note
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-6 text-zinc-800">
                {application.adminNotes}
              </p>
            </div>
          ) : null}
          {meta.ctaHref && meta.ctaLabel ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={meta.ctaHref}>
                <Button className="h-10 rounded-xl bg-[#009E49] px-4 font-bold text-white hover:bg-[#00853d]">
                  {meta.ctaLabel}
                </Button>
              </Link>
              {showSupportFallback ? (
                <a
                  href={`mailto:${BRAND.supportEmail}?subject=Seller%20status%20support`}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/70 bg-white/80 px-4 text-sm font-bold text-zinc-800 shadow-sm transition-colors hover:bg-white"
                >
                  Contact support
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatusCapabilityCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: ReturnType<typeof getSellerStatusMeta>["tone"];
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", eyebrowClass(tone))}>
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
