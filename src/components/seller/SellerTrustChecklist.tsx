import Link from "next/link";
import { CheckCircle2, Mail, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

function TrustRow({
  label,
  description,
  verified,
  icon,
  ctaHref,
  ctaLabel,
}: {
  label: string;
  description: string;
  verified: boolean;
  icon: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/55 bg-[linear-gradient(180deg,rgba(255,250,242,0.88),rgba(248,242,231,0.72))] p-3.5 shadow-[0_16px_34px_rgba(34,24,10,0.06)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-inner",
            verified
              ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-700"
              : "border-amber-200/80 bg-amber-50/90 text-amber-800",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black tracking-tight text-[#24170c]">{label}</p>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                verified
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700",
              )}
            >
              {verified ? "Verified" : "Pending"}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6b5a46]">{description}</p>
          {!verified && ctaHref && ctaLabel ? (
            <div className="mt-3">
              <Link href={ctaHref}>
                <Button className="h-8 rounded-xl bg-[#0f8c48] px-3.5 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-[#0d7a3f]">
                  {ctaLabel}
                </Button>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SellerTrustChecklist({
  user,
  compact = false,
}: {
  user: AuthUser | null;
  compact?: boolean;
}) {
  const emailVerified = Boolean(user?.emailVerified);
  const phoneVerified = Boolean(user?.phoneVerifiedAt);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[1.8rem] border border-white/60 bg-[linear-gradient(145deg,rgba(255,250,243,0.92),rgba(245,238,226,0.84))] shadow-[0_26px_60px_rgba(42,30,17,0.08)] backdrop-blur-xl",
        compact ? "p-4" : "p-5 md:p-6",
      )}
    >
      <div className="rounded-[1.45rem] border border-white/55 bg-[radial-gradient(circle_at_top_left,rgba(197,140,59,0.12),transparent_46%),linear-gradient(180deg,rgba(255,255,255,0.54),rgba(255,255,255,0.16))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-white/70 bg-white/65 text-[#0f8c48] shadow-[0_10px_22px_rgba(15,140,72,0.12)]">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6a32]">Trust Controls</p>
            <h2 className="mt-1 text-base font-black tracking-tight text-[#24170c] md:text-lg">
              Before you send for review
            </h2>
            <p className="mt-1.5 text-[12px] font-medium leading-5 text-[#6b5a46]">
              You can keep saving your details as you go. Submit only after these checks are complete.
            </p>
          </div>
        </div>
      </div>

      <div className={cn("mt-3 grid gap-3", compact ? "grid-cols-1" : "md:grid-cols-2")}>
        <TrustRow
          label="Email verification"
          description={
            emailVerified
              ? "Your email is confirmed and ready."
              : "Confirm your email before you send your application for review."
          }
          verified={emailVerified}
          icon={emailVerified ? <CheckCircle2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          ctaHref="/auth/check-email?next=/seller/onboarding"
          ctaLabel="Verify email"
        />

        <TrustRow
          label="Phone verification"
          description={
            phoneVerified
              ? "Your phone number is confirmed and ready."
              : "Confirm your phone number before you send your application for review."
          }
          verified={phoneVerified}
          icon={phoneVerified ? <CheckCircle2 className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
          ctaHref="/seller/verify-phone"
          ctaLabel="Verify phone"
        />
      </div>
    </section>
  );
}
