"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, MailCheck, RefreshCcw, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { resendVerificationEmail } from "@/services/auth";
import { getStoredLastAuthEmail } from "@/services/auth-session";
import { appendNextPath, getAuthRedirectIntent, sanitizeInternalNextPath } from "@/services/auth-intent";
import { useAccountVerification } from "@/hooks/use-account-verification";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";

const SELLER_ONBOARDING_FALLBACK = "/seller/onboarding?start=1";
const RESEND_COOLDOWN_SECONDS = 60;

export default function SellerCheckEmailPage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <SellerCheckEmailContent />
    </Suspense>
  );
}

function SellerCheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDeliveryFailed = searchParams.get("delivery") === "failed";
  const { user, loadState, emailVerified } = useAccountVerification();
  const [storedEmail, setStoredEmail] = useState<string>("");
  const email = user?.email ?? storedEmail;
  const nextPath = useMemo(
    () =>
      sanitizeInternalNextPath(searchParams.get("next")) ??
      getAuthRedirectIntent() ??
      SELLER_ONBOARDING_FALLBACK,
    [searchParams],
  );
  const loginHref = useMemo(() => appendNextPath("/seller/login", nextPath), [nextPath]);
  const continueHref = nextPath ?? SELLER_ONBOARDING_FALLBACK;
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    setStoredEmail(getStoredLastAuthEmail() ?? "");
  }, []);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timeout = window.setTimeout(
      () => setResendSecondsLeft((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timeout);
  }, [resendSecondsLeft]);

  const handleResend = async () => {
    if (emailVerified) {
      router.push(continueHref);
      return;
    }

    if (!email) {
      setError("Enter your email on the sign-in page to request another verification email.");
      return;
    }

    try {
      setIsResending(true);
      setError(null);
      setMessage(null);
      const result = await resendVerificationEmail(email, nextPath);
      if (result.emailSent === false) {
        setError(result.message);
      } else {
        setMessage(result.message);
        setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      }
      if (result.nextPath?.startsWith("/verify-email")) {
        router.push(result.nextPath);
      }
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main
      className="auth-viewport relative w-full bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="auth-panel relative z-10 flex flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Button asChild aria-label="Back to seller login" variant="ghost" size="icon" className="absolute left-4 top-4 z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
          <Link href={emailVerified ? continueHref : appendNextPath("/seller/login", nextPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                Seller Portal
              </div>
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border lg:mx-0 ${
                isDeliveryFailed && !emailVerified
                  ? "border-amber-300/30 bg-amber-400/15 text-amber-200"
                  : "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
              }`}>
                {emailVerified ? <CheckCircle2 className="h-6 w-6" /> : isDeliveryFailed ? <AlertCircle className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                {emailVerified ? "Email already verified" : isDeliveryFailed ? "Verification email pending" : "Verify your email"}
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">
                {emailVerified ? (
                  <>
                    <span className="font-bold text-white">{email}</span> is already confirmed for this seller account.
                  </>
                ) : isDeliveryFailed ? (
                  <>Your seller account was created, but we could not send the verification email. Try sending it again.</>
                ) : (
                  <>
                    Open the email we sent to{" "}
                    {email ? <span className="font-bold text-white">{email}</span> : "your email"} to continue.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-medium text-zinc-300 backdrop-blur-md">
            {emailVerified ? (
              <p>No further email action is needed. Continue to seller onboarding.</p>
            ) : (
              <>
                <p>After confirming your email, sign in and you&apos;ll be taken to seller onboarding.</p>
                <p>If you do not see the email, check spam or request a new one.</p>
              </>
            )}
          </div>

          {message ? <p className="mt-4 text-xs font-medium text-emerald-300">{message}</p> : null}
          {error ? <p className="mt-4 text-xs font-medium text-red-300">{error}</p> : null}
          {loadState === "unavailable" ? (
            <p className="mt-4 text-xs font-medium text-amber-200">
              We could not refresh your account verification status. Please try again.
            </p>
          ) : null}

          <div className="mt-6 grid gap-3">
            {emailVerified ? (
              <Button asChild className="h-11 rounded-xl bg-[#009E49] text-base font-extrabold text-white hover:bg-[#00853d]">
                <Link href={continueHref}>Continue to onboarding</Link>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={isResending || loadState === "loading" || resendSecondsLeft > 0}
                  onClick={handleResend}
                  className="h-11 rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
                >
                  {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  {isResending ? "Sending..." : resendSecondsLeft > 0 ? `Resend in ${resendSecondsLeft}s` : "Resend verification email"}
                </Button>
                <Button asChild variant="outline" className="h-11 w-full rounded-xl border-white/10 bg-white/5 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:text-white">
                  <Link href={loginHref}>Go to seller sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Button asChild aria-label="Back to sell page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
          <Link href={continueHref}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </main>
  );
}


