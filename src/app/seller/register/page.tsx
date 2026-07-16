"use client";

import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, X, Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { register } from "@/services/auth";
import {
  appendNextPath,
  sanitizeInternalNextPath,
  storeAuthRedirectIntent,
} from "@/services/auth-intent";

const SELLER_ONBOARDING_FALLBACK = "/seller/onboarding?start=1";

export default function SellerRegisterPage() {
  return (
    <Suspense fallback={<SellerRegisterFallback />}>
      <SellerRegisterContent />
    </Suspense>
  );
}

function SellerRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath =
    sanitizeInternalNextPath(searchParams.get("next")) ?? SELLER_ONBOARDING_FALLBACK;
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    storeAuthRedirectIntent(nextPath);
  }, [nextPath]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      // Pass nextPath so check-email can carry seller context forward
      const result = await register({ ...form, next: nextPath });
      router.push(
        result.nextPath ??
          appendNextPath(
            `/seller/check-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`,
            nextPath,
          ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="relative min-h-dvh w-full overflow-x-hidden bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="relative z-10 flex min-h-dvh flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Link href="/sell">
          <Button aria-label="Back to Sell page" variant="ghost" size="icon" className="absolute left-4 top-4 z-20 h-8 w-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-6 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>

            <div className="space-y-1">
              {/* Seller context badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                Seller Portal
              </div>
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                Create your seller account
              </h1>
              <p className="text-xs font-medium text-zinc-300 md:text-sm">
                Set up your ZOGULAR account first, then continue to seller onboarding.
              </p>
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">First Name</label>
                <Input value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} placeholder="John" className="h-10 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Last Name</label>
                <Input value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} placeholder="Banda" className="h-10 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Email Address</label>
              <Input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="john@example.com" className="h-10 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">WhatsApp / Phone</label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-bold tracking-tight text-white shadow-inner backdrop-blur-md">
                  +260
                </div>
                <Input type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="97 123 4567" className="h-10 flex-1 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
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

            <Button
              disabled={isSubmitting || Object.values(form).some((value) => !value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Creating account..." : "Start your seller application"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs font-medium text-zinc-300">
            Already have an account?{" "}
            <Link
              href={appendNextPath("/seller/login", nextPath)}
              className="font-extrabold text-[#FF6B00] underline-offset-4 drop-shadow-md hover:text-[#e66000] hover:underline"
            >
              Sign in to sell
            </Link>
          </p>

          <p className="mt-3 text-center text-xs font-medium text-zinc-400">
            Shopping instead?{" "}
            <Link href="/auth/register" className="font-bold text-zinc-300 hover:text-white hover:underline">
              Create a customer account
            </Link>
          </p>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Link href="/sell">
          <Button aria-label="Close seller registration" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
            <X className="h-5 w-5" />
          </Button>
        </Link>

        <div className="max-w-lg">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-lg xl:text-5xl">
            Start with a trusted seller account.
          </h2>
          <p className="text-base font-medium text-zinc-200 drop-shadow-md xl:text-lg">
            Verify your email, sign in, and complete the seller application before selling begins.
          </p>
        </div>
      </div>
    </main>
  );
}

function SellerRegisterFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#101010] p-6 text-white">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading seller account...
      </div>
    </main>
  );
}
