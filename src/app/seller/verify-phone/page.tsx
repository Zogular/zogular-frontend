"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser, getStoredAuthSession, sendPhoneOtp, verifyPhoneOtp } from "@/services/auth";

const RESEND_SECONDS = 60;

function formatPhoneInput(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export default function SellerVerifyPhonePage() {
  const storedUser = getStoredAuthSession()?.user ?? null;
  const [user, setUser] = useState(storedUser);
  const [phone, setPhone] = useState(storedUser?.phone ?? "");
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [verifiedThisSession, setVerifiedThisSession] = useState(false);
  const phoneVerified = Boolean(user?.phoneVerifiedAt) || verifiedThisSession;

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((nextUser) => {
        if (!active) return;
        setUser(nextUser);
        setPhone((current) => (current.trim() ? current : nextUser.phone ?? current));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;

    const timeout = window.setTimeout(() => {
      setResendSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [resendSecondsLeft]);

  const canResend = resendSecondsLeft === 0 && !isSending && !phoneVerified;
  const helperMessage = useMemo(() => {
    if (phoneVerified) {
      return "Your phone number is confirmed and ready.";
    }
    return "Use a Zambia mobile number like +260971234567, 0971234567, or 0771234567.";
  }, [phoneVerified]);

  const handleSendOtp = async () => {
    try {
      setIsSending(true);
      setErrorMessage(null);
      setStatusMessage(null);
      const result = await sendPhoneOtp(phone);
      setStatusMessage(result.message);
      if (result.developmentCode) {
        setCode(result.developmentCode);
      }
      setResendSecondsLeft(RESEND_SECONDS);
      toast.success(result.message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send phone verification code.";
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
      // verifyPhoneOtp() already calls getCurrentUser() internally to update the
      // stored session — fetch the refreshed user and reflect it in local state.
      const refreshedUser = await getCurrentUser().catch(() => null);
      if (refreshedUser) {
        setUser(refreshedUser);
      }
      setVerifiedThisSession(true);
      setStatusMessage(result.message);
      toast.success(result.message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify phone code.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.84))] shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="border-b border-zinc-200/70 bg-[radial-gradient(circle_at_top,rgba(0,158,73,0.14),transparent_60%)] px-6 py-6 md:px-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#009E49]">Phone Verification</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">Verify the seller phone number.</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                We will send a 6-digit code to the number you want to use for your seller account.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm">
              Status:{" "}
              <span className={phoneVerified ? "font-black text-emerald-700" : "font-black text-amber-700"}>
                {phoneVerified ? "Verified" : "Verification needed"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm md:p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-[#009E49]">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-zinc-950">Send verification code</h2>
                  <p className="mt-1 text-sm font-medium leading-6 text-zinc-600">{helperMessage}</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Phone number</span>
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
                    placeholder="+260971234567"
                    className="h-12 rounded-xl border-zinc-200 bg-white text-sm"
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={handleSendOtp}
                    disabled={!phone.trim() || !canResend}
                    className="h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]"
                  >
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    {isSending ? "Sending..." : resendSecondsLeft > 0 ? `Resend in ${resendSecondsLeft}s` : "Send OTP"}
                  </Button>
                  <Link href="/seller/onboarding">
                    <Button variant="outline" className="h-11 w-full rounded-xl border-zinc-200 bg-white px-5 font-bold sm:w-auto">
                      Back to onboarding
                    </Button>
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm md:p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-[#009E49]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-zinc-950">Verify OTP</h2>
                  <p className="mt-1 text-sm font-medium leading-6 text-zinc-600">
                    Enter the 6-digit code sent to your phone.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">6-digit code</span>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="123456"
                    className="h-12 rounded-xl border-zinc-200 bg-white text-sm tracking-[0.35em]"
                  />
                </label>

                {statusMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-800">
                    {statusMessage}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-semibold text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <Button
                  onClick={handleVerifyOtp}
                  disabled={!phone.trim() || code.length !== 6 || isVerifying || phoneVerified}
                  className="h-11 rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800"
                >
                  {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {phoneVerified ? "Phone verified" : isVerifying ? "Verifying..." : "Verify phone"}
                </Button>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Phone formats</p>
              <div className="mt-4 space-y-3 text-sm font-semibold text-zinc-700">
                <p className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">+260971234567</p>
                <p className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">0971234567</p>
                <p className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">0771234567</p>
              </div>
            </div>

            {process.env.NODE_ENV !== "production" && code && (
              <div className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Development Code</p>
                <div className="mt-4 break-all rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {code}
                </div>
              </div>
            )}

            <div className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">What happens next</p>
              <div className="mt-4 space-y-3 text-sm font-medium leading-6 text-zinc-600">
                <p>You can keep saving your application while this step is still pending.</p>
                <p>You will need both email and phone verification before you can send your application for review.</p>
                <p>Once your phone is confirmed, you can go back and finish your application.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
