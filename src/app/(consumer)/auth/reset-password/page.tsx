"use client";

import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, X, Loader2 } from "lucide-react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getDemoVerificationEmail, resetPassword } from "@/services/auth";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";

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
  const email = searchParams.get("email") ?? getDemoVerificationEmail();
  const code = searchParams.get("code") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const result = await resetPassword({
        email,
        code,
        password,
        confirmPassword,
      });
      router.push(result.nextPath ?? "/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
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
        <Link href="/auth/login">
          <Button data-auth-back aria-label="Go back" variant="ghost" size="icon" className="absolute z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                Set new password
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">
                Your new password must be different to previously used passwords.
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">New Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-10 rounded-xl border-white/10 bg-white/5 pr-10 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide new password" : "Show new password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-zinc-200 transition-colors hover:bg-black/35 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">Must be at least 8 characters.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Confirm Password</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-10 rounded-xl border-white/10 bg-white/5 pr-10 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-zinc-200 transition-colors hover:bg-black/35 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? <p className="text-xs font-medium text-red-300">{error}</p> : null}

            <Button
              disabled={isSubmitting || !password || !confirmPassword}
              className="mt-6 h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Resetting Password..." : "Reset Password"}
            </Button>
          </form>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Link href="/">
          <Button aria-label="Close password reset page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
            <X className="h-5 w-5" />
          </Button>
        </Link>

        <div className="max-w-lg">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-lg xl:text-5xl">
            Powering Zambia&apos;s Online Marketplace.
          </h2>
          <p className="text-base font-medium text-zinc-200 drop-shadow-md xl:text-lg">
            Join thousands of sellers and buyers connecting every day on the fastest growing e-commerce platform in Lusaka.
          </p>
        </div>
      </div>
    </main>
  );
}
