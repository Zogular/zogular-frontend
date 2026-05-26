"use client";

import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { register } from "@/services/auth";

export default function RegisterPage() {
  const router = useRouter();
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const result = await register(form);
      router.push(result.nextPath ?? "/auth/permissions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
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
          <div className="mb-6 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                Create an Account
              </h1>
              <p className="text-xs font-medium text-zinc-300 md:text-sm">
                Connecting buyers and sellers across Zambia.
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
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
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="my-5 flex items-center text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            <div className="flex-1 border-b border-white/10"></div>
            <span className="px-3">Or continue with</span>
            <div className="flex-1 border-b border-white/10"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-10 w-full rounded-xl border-white/10 bg-white/5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:text-white">
              <svg className="mr-2 h-3.5 w-3.5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </Button>

            <Button variant="outline" className="h-10 w-full rounded-xl border-white/10 bg-white/5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:text-white">
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple
            </Button>
          </div>

          <p className="mt-6 text-center text-xs font-medium text-zinc-300">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-extrabold text-[#FF6B00] underline-offset-4 drop-shadow-md hover:text-[#e66000] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <Link href="/">
          <Button aria-label="Close registration page" variant="ghost" size="icon" className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40">
            <X className="h-5 w-5" />
          </Button>
        </Link>

        <div className="max-w-lg rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-md">
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
