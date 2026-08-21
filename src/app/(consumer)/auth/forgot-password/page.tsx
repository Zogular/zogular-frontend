"use client";

import Link from "next/link";
import { ArrowLeft, X, Mail, Loader2 } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  clearPasswordRecoveryState,
  getPasswordRecoveryErrorMessage,
  requestPasswordReset,
} from "@/services/auth";
import { appendNextPath, sanitizeInternalNextPath } from "@/services/auth-intent";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeInternalNextPath(searchParams.get("next"));
  const loginPath = nextPath?.startsWith("/seller") ? "/seller/login" : "/auth/login";
  const loginHref = appendNextPath(loginPath, nextPath);
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitPendingRef = useRef(false);

  useEffect(() => {
    clearPasswordRecoveryState();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitPendingRef.current) return;
    try {
      submitPendingRef.current = true;
      setIsSubmitting(true);
      setError(null);
      const result = await requestPasswordReset({ email, next: nextPath });
      router.push(result.nextPath ?? "/auth/verify-code");
    } catch (err) {
      setError(getPasswordRecoveryErrorMessage(err, "request"));
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
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="auth-panel relative z-10 flex flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Button asChild data-auth-back aria-label="Go back" variant="ghost" size="icon" className="absolute z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
          <Link href={loginHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                Reset password
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">
                Enter your email address and we&apos;ll send you a 6-digit OTP code to reset your password.
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="recovery-email" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Email address</label>
              <div className="relative">
                <Input
                  id="recovery-email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="banda@example.com"
                  className="h-11 rounded-xl border-white/10 bg-white/5 pl-10 text-base text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49] md:text-sm"
                />
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              </div>
            </div>

            {error ? <p role="alert" className="text-xs font-medium text-red-300">{error}</p> : null}

            <Button
              disabled={isSubmitting || !email}
              className="h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Sending Code..." : "Send OTP Code"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs font-medium text-zinc-300">
            Remember your password?{" "}
            <Link href={loginHref} className="font-extrabold text-[#FF6B00] underline-offset-4 drop-shadow-md hover:text-[#e66000] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Button asChild aria-label="Close password reset page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
          <Link href="/">
            <X className="h-5 w-5" />
          </Link>
        </Button>

        <div className="max-w-lg">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-lg xl:text-5xl">
            Powering Zambia&apos;s Online Marketplace.
          </h2>
          <p className="text-base font-medium text-zinc-200 drop-shadow-md xl:text-lg">
            Reset your password and return to your account.
          </p>
        </div>
      </div>
    </main>
  );
}
