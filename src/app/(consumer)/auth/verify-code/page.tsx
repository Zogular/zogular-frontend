"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, ShieldAlert, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  clearPasswordRecoveryState,
  getPasswordRecoveryErrorMessage,
  getPasswordRecoveryIntent,
  maskPasswordRecoveryEmail,
  verifyResetCode,
} from "@/services/auth";
import type { PasswordRecoveryIntent } from "@/services/auth-session";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";
import { appendNextPath, sanitizeInternalNextPath } from "@/services/auth-intent";

export default function VerifyCodePage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <VerifyCodeContent />
    </Suspense>
  );
}

function VerifyCodeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNextPath = sanitizeInternalNextPath(searchParams.get("next"));
  const [intent, setIntent] = useState<PasswordRecoveryIntent | null | undefined>(undefined);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submitPendingRef = useRef(false);

  useEffect(() => {
    setIntent(getPasswordRecoveryIntent());
  }, []);

  if (intent === undefined) return <AuthLoadingSkeleton />;

  const nextPath = intent?.nextPath ?? requestedNextPath;
  const restartHref = appendNextPath("/auth/forgot-password", nextPath);

  if (!intent || intent.stage !== "code-requested") {
    return (
      <RecoveryRestartState
        description="Start password recovery again so we can send a fresh code to the email address you choose."
        restartHref={restartHref}
        closeHref={nextPath ?? "/"}
      />
    );
  }

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const nextOtp = [...otp];
    nextOtp[index] = value.slice(-1);
    setOtp(nextOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitPendingRef.current) return;
    const code = otp.join("");
    try {
      submitPendingRef.current = true;
      setIsSubmitting(true);
      setError(null);
      const result = await verifyResetCode({ email: intent.email, code, next: intent.nextPath });
      router.push(result.nextPath ?? "/auth/reset-password");
    } catch (caughtError) {
      setError(getPasswordRecoveryErrorMessage(caughtError, "verify"));
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
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">Verify your code</h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">
                Enter the 6-digit code sent to <span className="font-bold text-white">{maskPasswordRecoveryEmail(intent.email)}</span>.
              </p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { inputRefs.current[index] = element; }}
                  aria-label={`Verification code digit ${index + 1}`}
                  autoFocus={index === 0}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  className="h-12 min-w-0 w-full rounded-xl border border-white/10 bg-white/5 text-center text-xl font-bold text-white shadow-inner backdrop-blur-md transition-all focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#009E49] sm:h-14"
                />
              ))}
            </div>

            {error ? <p role="alert" className="text-xs font-medium text-red-300">{error}</p> : null}

            <Button disabled={isSubmitting || otp.some((digit) => !digit)} className="h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Verifying..." : "Verify Code"}
            </Button>
          </form>

          <div className="mt-8 space-y-2 text-center">
            <p className="text-xs font-medium text-zinc-300">Didn&apos;t receive the code?</p>
            <Link href={restartHref} onClick={clearPasswordRecoveryState} className="text-xs font-extrabold text-[#FF6B00] underline-offset-4 transition-all drop-shadow-md hover:text-[#e66000] hover:underline">
              Request a new code
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Button asChild aria-label="Close verification page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
          <Link href={nextPath ?? "/"}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
        <div className="max-w-lg">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-lg xl:text-5xl">Powering Zambia&apos;s Online Marketplace.</h2>
          <p className="text-base font-medium text-zinc-200 drop-shadow-md xl:text-lg">Enter your code to continue securely.</p>
        </div>
      </div>
    </main>
  );
}

function RecoveryRestartState({ description, restartHref, closeHref }: { description: string; restartHref: string; closeHref: string }) {
  return (
    <main className="auth-viewport relative flex w-full items-center justify-center bg-zinc-950 px-4">
      <section data-testid="password-recovery-restart" className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/8 p-6 text-center text-white shadow-2xl backdrop-blur-2xl sm:p-8">
        <ShieldAlert aria-hidden="true" className="mx-auto h-8 w-8 text-amber-300" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Restart password recovery</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-zinc-300">{description}</p>
        <Link href={restartHref} onClick={clearPasswordRecoveryState} className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#009E49] px-5 text-sm font-bold text-white outline-none hover:bg-[#00853d] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">
          Start again
        </Link>
        <Link href={closeHref} className="mx-auto mt-4 block w-fit rounded-sm text-sm font-bold text-zinc-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white">
          Return to Zogular
        </Link>
      </section>
    </main>
  );
}
