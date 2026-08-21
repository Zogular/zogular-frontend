"use client";

import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldAlert, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  clearPasswordRecoveryState,
  getPasswordRecoveryErrorMessage,
  getPasswordRecoveryIntent,
  getPendingPasswordReset,
  resetPassword,
} from "@/services/auth";
import type { PasswordRecoveryIntent } from "@/services/auth-session";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";
import { appendNextPath, sanitizeInternalNextPath } from "@/services/auth-intent";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNextPath = sanitizeInternalNextPath(searchParams.get("next"));
  const [intent, setIntent] = useState<PasswordRecoveryIntent | null | undefined>(undefined);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitPendingRef = useRef(false);

  useEffect(() => {
    const storedIntent = getPasswordRecoveryIntent();
    setIntent(storedIntent);
    const pendingReset = getPendingPasswordReset();
    if (storedIntent?.stage === "code-verified" && pendingReset?.email === storedIntent.email) {
      setRecoveryCode(pendingReset.code);
    }
  }, []);

  if (intent === undefined) return <AuthLoadingSkeleton />;

  const nextPath = intent?.nextPath ?? requestedNextPath;
  const restartHref = appendNextPath("/auth/forgot-password", nextPath);

  if (!intent || intent.stage !== "code-verified") {
    return <RecoveryRestartState restartHref={restartHref} closeHref={nextPath ?? "/"} />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitPendingRef.current) return;
    if (!/^\d{6}$/.test(recoveryCode)) {
      setError("Enter the 6-digit code sent to your email address.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      submitPendingRef.current = true;
      setIsSubmitting(true);
      setError(null);
      const result = await resetPassword({
        email: intent.email,
        code: recoveryCode,
        password,
        confirmPassword,
        next: intent.nextPath,
      });
      const loginPath = intent.nextPath?.startsWith("/seller") ? "/seller/login" : "/auth/login";
      router.push(result.nextPath ?? appendNextPath(loginPath, intent.nextPath));
    } catch (caughtError) {
      setError(getPasswordRecoveryErrorMessage(caughtError, "reset"));
      if (!getPasswordRecoveryIntent()) setIntent(null);
    } finally {
      submitPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="auth-viewport relative w-full bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40" />
      <div className="auth-panel relative z-10 flex flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Button asChild data-auth-back aria-label="Restart password recovery" variant="ghost" size="icon" className="absolute z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
          <Link href={restartHref} onClick={clearPasswordRecoveryState}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">Set new password</h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">Choose a strong password that you have not used before.</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="recovery-code" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Verification code</label>
              <Input
                id="recovery-code"
                aria-describedby="recovery-code-help"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-10 rounded-xl border-white/10 bg-white/5 text-base tracking-[0.3em] text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49] md:text-sm"
              />
              <p id="recovery-code-help" className="mt-1 text-[10px] text-zinc-400">Re-enter the code after a page reload.</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="new-password" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">New password</label>
              <div className="relative">
                <Input id="new-password" autoComplete="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="h-10 rounded-xl border-white/10 bg-white/5 pr-10 text-base text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49] md:text-sm" />
                <button type="button" aria-label={showPassword ? "Hide new password" : "Show new password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-zinc-200 transition-colors hover:bg-black/35 hover:text-white">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">Must be at least 8 characters.</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm-password" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Confirm password</label>
              <div className="relative">
                <Input id="confirm-password" autoComplete="new-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" className="h-10 rounded-xl border-white/10 bg-white/5 pr-10 text-base text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49] md:text-sm" />
                <button type="button" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-zinc-200 transition-colors hover:bg-black/35 hover:text-white">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? <p role="alert" className="text-xs font-medium text-red-300">{error}</p> : null}

            <Button disabled={isSubmitting || recoveryCode.length !== 6 || !password || !confirmPassword} className="mt-6 h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Resetting password..." : "Reset password"}
            </Button>
          </form>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Button asChild aria-label="Close password reset page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
          <Link href={intent.nextPath ?? "/"}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
        <div className="max-w-lg">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-lg xl:text-5xl">Powering Zambia&apos;s Online Marketplace.</h2>
          <p className="text-base font-medium text-zinc-200 drop-shadow-md xl:text-lg">Choose a new password and return to your account.</p>
        </div>
      </div>
    </main>
  );
}

function RecoveryRestartState({ restartHref, closeHref }: { restartHref: string; closeHref: string }) {
  return (
    <main className="auth-viewport relative flex w-full items-center justify-center bg-zinc-950 px-4">
      <section data-testid="password-recovery-restart" className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/8 p-6 text-center text-white shadow-2xl backdrop-blur-2xl sm:p-8">
        <ShieldAlert aria-hidden="true" className="mx-auto h-8 w-8 text-amber-300" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Restart password recovery</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-zinc-300">Start password recovery again so we can send a fresh code to the email address you choose.</p>
        <Link href={restartHref} onClick={clearPasswordRecoveryState} className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#009E49] px-5 text-sm font-bold text-white outline-none hover:bg-[#00853d] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">Start again</Link>
        <Link href={closeHref} className="mx-auto mt-4 block w-fit rounded-sm text-sm font-bold text-zinc-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white">Return to Zogular</Link>
      </section>
    </main>
  );
}
