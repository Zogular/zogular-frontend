"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, RefreshCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getDemoVerificationEmail, resendVerificationEmail } from "@/services/auth";
import { appendNextPath, getAuthRedirectIntent, sanitizeInternalNextPath } from "@/services/auth-intent";

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = useMemo(
    () => searchParams.get("email") ?? getDemoVerificationEmail(),
    [searchParams],
  );
  const nextPath = useMemo(
    () => sanitizeInternalNextPath(searchParams.get("next")) ?? getAuthRedirectIntent(),
    [searchParams],
  );
  const loginHref = useMemo(() => {
    const baseHref = appendNextPath("/auth/login", nextPath);
    if (!email) return baseHref;
    return `${baseHref}${baseHref.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`;
  }, [email, nextPath]);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) {
      setError("Enter your email on the login page to request a new verification link.");
      return;
    }

    try {
      setIsResending(true);
      setError(null);
      const result = await resendVerificationEmail(email);
      setMessage(result.message);
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main
      className="relative h-screen w-full overflow-hidden bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="relative z-10 flex min-h-screen flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Link href={appendNextPath("/auth/login", nextPath)}>
          <Button aria-label="Back to login" variant="ghost" size="icon" className="absolute left-4 top-4 z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>
            <div className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/15 text-emerald-200 lg:mx-0">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                Verify your email
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">
                We created your account, but the backend keeps it locked until you open the verification link sent to {email ? <span className="font-bold text-white">{email}</span> : "your email"}.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-medium text-zinc-300 backdrop-blur-md">
            <p>After verification, return to sign in with your email and password.</p>
            <p>If the email is not in your inbox, check spam or request a new link.</p>
          </div>

          {message ? <p className="mt-4 text-xs font-medium text-emerald-300">{message}</p> : null}
          {error ? <p className="mt-4 text-xs font-medium text-red-300">{error}</p> : null}

          <div className="mt-6 grid gap-3">
            <Button
              type="button"
              disabled={isResending}
              onClick={handleResend}
              className="h-11 rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
            >
              {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              {isResending ? "Sending..." : "Resend verification email"}
            </Button>
            <Link href={loginHref}>
              <Button variant="outline" className="h-11 w-full rounded-xl border-white/10 bg-white/5 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:text-white">
                Go to login
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Link href="/">
          <Button aria-label="Close verification page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
            <X className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </main>
  );
}
