"use client";

import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getPostLoginRedirectPath, getStoredAuthSession, login } from "@/services/auth";
import {
  appendNextPath,
  clearAuthRedirectIntent,
  getAuthRedirectIntent,
  sanitizeInternalNextPath,
  storeAuthRedirectIntent,
} from "@/services/auth-intent";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeInternalNextPath(searchParams.get("next")) ?? getAuthRedirectIntent();
  const emailParam = searchParams.get("email");
  const registered = searchParams.get("registered") === "1";
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    storeAuthRedirectIntent(nextPath);
  }, [nextPath]);

  useEffect(() => {
    const existingSession = getStoredAuthSession();
    if (!existingSession) return;

    const redirectPath = getPostLoginRedirectPath(existingSession.user, nextPath);
    router.replace(redirectPath);
  }, [nextPath, router]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
    if (registered) {
      setSuccess("Account created. Please verify your email before signing in.");
    }
  }, [emailParam, registered]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      const session = await login({ email, password });
      setSuccess("Signed in successfully. Redirecting...");
      clearAuthRedirectIntent();

      const redirectPath = getPostLoginRedirectPath(session.user, nextPath);
      router.replace(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in.");
      setSuccess(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="relative h-screen w-full overflow-hidden bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="relative z-10 flex min-h-screen flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Link href="/">
          <Button aria-label="Go back" variant="ghost" size="icon" className="absolute left-4 top-4 z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                Welcome back
              </h1>
              <p className="text-xs font-medium text-zinc-300 md:text-sm">
                Sign in to continue shopping.
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="banda@example.com"
                className="h-10 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Password</label>
                <Link href="/auth/forgot-password" className="text-[11px] font-bold text-[#FF6B00] transition-all hover:text-[#e66000] hover:underline">
                  Forgot password?
                </Link>
              </div>
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-zinc-200 transition-colors hover:bg-black/35 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? <p className="text-xs font-medium text-red-300">{error}</p> : null}
            {success ? <p className="text-xs font-medium text-emerald-300">{success}</p> : null}

            <Button
              disabled={isSubmitting || !email || !password}
              className="mt-4 h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Signing In..." : "Continue to your account"}
            </Button>
          </form>

          <div className="my-6 flex items-center text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            <div className="flex-1 border-b border-white/10"></div>
            <span className="px-3">Or continue with</span>
            <div className="flex-1 border-b border-white/10"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-10 w-full rounded-xl border-white/10 bg-white/5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:text-white">
              <svg className="mr-2 h-3.5 w-3.5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </Button>

            <Button variant="outline" className="h-10 w-full rounded-xl border-white/10 bg-white/5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:text-white">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 11.2 192.9 11.2 284c0 109.1 53.4 209 116.3 209 30.1 0 54.4-19.6 86.4-19.6 32.7 0 51.5 19.6 86.4 19.6 44.7 0 86-77 101.3-124.6l1.3-3.4c-47-19.7-65.7-56-65.7-96.3zm-79.6-118.8c18-22.3 31.7-53.1 31.7-83.6 0-14.8-1.5-28.8-4.5-42.5-23.7 2.3-51.5 17-68.6 37.6-16 19.1-29.3 50.8-29.3 80.7 0 15 1.7 29.3 4.8 41.7 24.3 1.3 50-16.1 66-33.9z" />
              </svg>
              Apple
            </Button>
          </div>

          <p className="mt-8 text-center text-xs font-medium text-zinc-300">
            Don&apos;t have an account?{" "}
            <Link href={appendNextPath("/auth/register", nextPath)} className="font-extrabold text-[#FF6B00] underline-offset-4 drop-shadow-md hover:text-[#e66000] hover:underline">
              Sign up
            </Link>
          </p>

          <p className="mt-3 text-center text-xs font-medium text-zinc-400">
            Want to sell?{" "}
            <Link href="/seller/login" className="font-bold text-zinc-300 hover:text-white hover:underline">
              Seller sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Link href="/">
          <Button aria-label="Close login page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
            <X className="h-5 w-5" />
          </Button>
        </Link>

        <div className="max-w-lg">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-lg xl:text-5xl">
            Powering Zambia&apos;s Online Marketplace.
          </h2>
          <p className="text-base font-medium text-zinc-200 drop-shadow-md xl:text-lg">
            Track orders, save addresses, and checkout faster. Join thousands of shoppers on the fastest growing e-commerce platform in Lusaka.
          </p>
        </div>
      </div>
    </main>
  );
}
