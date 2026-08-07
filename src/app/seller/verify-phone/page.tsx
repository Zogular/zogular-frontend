"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Phone,
  RefreshCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api";
import { appendNextPath, sanitizeInternalNextPath } from "@/services/auth-intent";
import { sendPhoneOtp, verifyPhoneOtp } from "@/services/auth";
import { useAccountVerification } from "@/hooks/use-account-verification";

const RESEND_SECONDS = 60;
const ONBOARDING_FALLBACK = "/seller/onboarding";

function formatPhoneInput(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export default function SellerVerifyPhonePage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <SellerVerifyPhoneContent />
    </Suspense>
  );
}

function SellerVerifyPhoneContent() {
  const searchParams = useSearchParams();
  const { user, loadState, phoneVerified: backendPhoneVerified, refresh } = useAccountVerification();
  const nextPath = useMemo(
    () => sanitizeInternalNextPath(searchParams.get("next")) ?? ONBOARDING_FALLBACK,
    [searchParams],
  );
  const loginHref = useMemo(
    () => appendNextPath("/seller/login", nextPath),
    [nextPath],
  );
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const phoneVerified = backendPhoneVerified;

  useEffect(() => {
    setPhone((current) => (current.trim() ? current : user?.phone ?? ""));
  }, [user?.phone]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;

    const timeout = window.setTimeout(() => {
      setResendSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [resendSecondsLeft]);

  const canSend =
    Boolean(phone.trim()) &&
    !isSending &&
    !phoneVerified &&
    loadState !== "loading" &&
    loadState !== "unavailable" &&
    loadState !== "unauthenticated";

  const handleSendOtp = async () => {
    try {
      setIsSending(true);
      setErrorMessage(null);
      setStatusMessage(null);
      const result = await sendPhoneOtp(phone);
      setCodeSent(true);
      setStatusMessage(result.message);
      setResendSecondsLeft(RESEND_SECONDS);
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof ApiError && error.status === 404
        ? "Phone verification is not available right now. Please try again later."
        : error instanceof Error
          ? error.message
          : "We could not send the verification code.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setIsVerifying(true);
      setErrorMessage(null);
      setStatusMessage(null);
      const result = await verifyPhoneOtp(phone, code);
      const refreshedUser = await refresh();
      const confirmed = Boolean(refreshedUser?.phoneVerifiedAt);

      if (!confirmed) {
        throw new Error("Your code was accepted, but we could not confirm the updated account status. Please try again.");
      }

      setStatusMessage(result.message);
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof ApiError && error.status === 404
        ? "Phone verification is not available right now. Please try again later."
        : error instanceof Error
          ? error.message
          : "We could not verify that code.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangeNumber = () => {
    setCodeSent(false);
    setCode("");
    setStatusMessage(null);
    setErrorMessage(null);
  };

  return (
    <main
      className="auth-viewport relative w-full bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')",
      }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40" />

      <div className="auth-panel relative z-10 flex flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Button
          asChild
          aria-label="Back to seller onboarding"
          variant="ghost"
          size="icon"
          className="absolute left-4 top-4 z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 hover:text-white"
        >
          <Link href={nextPath}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-7 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                Seller Portal
              </div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/15 text-emerald-200 lg:mx-0">
                {phoneVerified ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : codeSent ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <Phone className="h-6 w-6" />
                )}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm md:text-3xl">
                {phoneVerified
                  ? "Phone number verified"
                  : codeSent
                    ? "Enter your verification code"
                    : "Verify your phone number"}
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">
                {phoneVerified
                  ? `${user?.phone ?? phone} is confirmed for this seller account.`
                  : codeSent
                    ? `Enter the 6-digit code sent to ${phone}.`
                    : "We will send a 6-digit code to your Zambia mobile number."}
              </p>
            </div>
          </div>

          {loadState === "loading" ? (
            <div className="space-y-3" aria-label="Loading phone verification">
              <div className="h-12 animate-pulse rounded-xl bg-white/8" />
              <div className="h-11 animate-pulse rounded-xl bg-white/10" />
            </div>
          ) : phoneVerified ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-xs font-medium leading-5 text-emerald-100">
                No further phone action is needed. Continue your seller application.
              </div>
              <Button asChild className="h-11 w-full rounded-xl bg-[#009E49] text-base font-extrabold text-white hover:bg-[#00853d]">
                <Link href={nextPath}>Continue to onboarding</Link>
              </Button>
            </div>
          ) : loadState === "unauthenticated" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-xs font-medium leading-5 text-amber-100">
                Sign in to verify the phone number connected to your seller account.
              </div>
              <Button asChild className="h-11 w-full rounded-xl bg-[#009E49] text-base font-extrabold text-white hover:bg-[#00853d]">
                <Link href={loginHref}>Go to seller sign in</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {!codeSent ? (
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300">
                    Phone number
                  </span>
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+260971234567"
                    className="h-12 rounded-xl border-white/15 bg-white/8 text-base text-white placeholder:text-zinc-500 focus-visible:border-emerald-400/50 focus-visible:ring-emerald-400/20"
                  />
                  <span className="block text-[11px] font-medium text-zinc-400">
                    Use +260 or a local number beginning with 09 or 07.
                  </span>
                </label>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300">
                    6-digit code
                  </span>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="h-12 rounded-xl border-white/15 bg-white/8 text-center text-lg font-black tracking-[0.35em] text-white placeholder:text-zinc-500 focus-visible:border-emerald-400/50 focus-visible:ring-emerald-400/20"
                  />
                </label>
              )}

              {statusMessage ? (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs font-semibold leading-5 text-emerald-100">
                  {statusMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-xs font-semibold leading-5 text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              {loadState === "unavailable" ? (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs font-semibold leading-5 text-amber-100">
                  We could not refresh your account status. Check your connection and try again.
                </div>
              ) : null}

              {!codeSent ? (
                <Button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={!canSend}
                  className="h-11 w-full rounded-xl bg-[#009E49] text-base font-extrabold text-white hover:bg-[#00853d]"
                >
                  {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                  {isSending ? "Sending code..." : "Send verification code"}
                </Button>
              ) : (
                <div className="grid gap-3">
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={code.length !== 6 || isVerifying}
                    className="h-11 w-full rounded-xl bg-[#009E49] text-base font-extrabold text-white hover:bg-[#00853d]"
                  >
                    {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    {isVerifying ? "Verifying..." : "Verify phone"}
                  </Button>

                  <div className="flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleChangeNumber}
                      className="h-11 px-1 text-xs font-bold text-zinc-300 hover:bg-transparent hover:text-white"
                    >
                      Change number
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleSendOtp}
                      disabled={resendSecondsLeft > 0 || isSending}
                      className="h-11 px-1 text-xs font-bold text-emerald-300 hover:bg-transparent hover:text-emerald-200"
                    >
                      {isSending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {resendSecondsLeft > 0 ? `Resend in ${resendSecondsLeft}s` : "Resend code"}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Button
          asChild
          aria-label="Close phone verification"
          variant="ghost"
          size="icon"
          className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40 hover:text-white"
        >
          <Link href={nextPath}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
