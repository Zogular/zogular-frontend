import Link from "next/link";
import { CheckCircle2, Mail, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

function TrustRow({
  label,
  description,
  verified,
  unavailable = false,
  icon,
  ctaHref,
  ctaLabel,
}: {
  label: string;
  description: string;
  verified: boolean;
  unavailable?: boolean;
  icon: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/85 p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
            verified
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-amber-200 bg-amber-50 text-amber-700",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-zinc-950">{label}</p>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                verified
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700",
              )}
            >
              {verified ? "Verified" : unavailable ? "Backend Follow-up" : "Unverified"}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{description}</p>
          {!verified && ctaHref && ctaLabel && !unavailable ? (
            <div className="mt-3">
              <Link href={ctaHref}>
                <Button className="h-9 rounded-xl bg-[#009E49] px-4 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-[#00853d]">
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
  phoneVerificationAvailable,
  compact = false,
}: {
  user: AuthUser | null;
  phoneVerificationAvailable: boolean;
  compact?: boolean;
}) {
  const emailVerified = Boolean(user?.emailVerified);
  const phoneVerified = Boolean(user?.phoneVerifiedAt);

  return (
    <section className={cn("rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm", compact ? "space-y-3" : "space-y-4")}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-[#009E49]">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Trust Checklist</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-zinc-950">Seller verification before final submit</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
            Draft saving stays open without trust completion. Final seller submission should move only after your email and phone trust checks are complete.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <TrustRow
          label="Email verification"
          description={
            emailVerified
              ? "Your account email is already verified and ready for seller trust review."
              : "Verify your email first so the seller application can move through the correct trust path."
          }
          verified={emailVerified}
          icon={emailVerified ? <CheckCircle2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          ctaHref={user?.email ? `/auth/check-email?email=${encodeURIComponent(user.email)}&next=${encodeURIComponent("/seller/onboarding")}` : "/auth/check-email"}
          ctaLabel="Verify email"
        />

        <TrustRow
          label="Phone verification"
          description={
            phoneVerificationAvailable
              ? phoneVerified
                ? "Your phone number has been verified for seller trust and Zambia payout readiness."
                : "Verify a Zambian phone number before the seller application can become fully trust-based."
              : "Phone OTP flow is wired on the frontend, but the backend session payload does not expose phoneVerifiedAt yet, so verification state cannot be confirmed reliably after refresh."
          }
          verified={phoneVerified}
          unavailable={!phoneVerificationAvailable}
          icon={phoneVerified ? <CheckCircle2 className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
          ctaHref="/seller/verify-phone"
          ctaLabel="Verify phone"
        />
      </div>
    </section>
  );
}
