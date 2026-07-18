"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { toast } from "sonner";
import { loginAdmin } from "@/services/admin/auth";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signInState, setSignInState] = useState<"idle" | "verifying" | "mfa_ready" | "error">("idle");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      setSignInState("error");
      return toast.error("Enter your credentials.");
    }

    setIsLoading(true);
    setSignInState("verifying");

    try {
      const session = await loginAdmin({ email, password });
      setSignInState("mfa_ready");
      toast.success(session.message);
      window.location.assign(session.nextPath);
    } catch (error) {
      setSignInState("error");
      toast.error(error instanceof Error ? error.message : "Admin sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-centered-auth className="auth-viewport relative flex items-center justify-center bg-zinc-950 px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,158,73,0.18),transparent_32rem),linear-gradient(135deg,rgba(24,24,27,0.55),rgba(9,9,11,0.95))]" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-400 via-amber-300 to-indigo-400" />

          <div className="mb-8 text-center">
            <BrandLogo variant="dark" className="mb-5 justify-center" imageClassName="h-12 w-auto drop-shadow-md" priority />
            <h1 className="text-2xl font-black tracking-tight text-white">Zogular <span className="text-emerald-300">Admin</span></h1>
            <p className="mt-2 text-sm font-medium text-zinc-400">Secure entry for authorized personnel only.</p>
          </div>

          <div className="mb-5 rounded-2xl border border-white/10 bg-white/7 p-3 text-xs font-bold text-zinc-300">
            {signInState === "error" ? "Sign-in error: the admin gateway could not establish a trusted session." : null}
            {signInState === "verifying" ? "Verifying admin identity with the backend auth boundary..." : null}
            {signInState === "mfa_ready" ? "Privileged session established. Redirecting to dashboard..." : null}
            {signInState === "idle" ? "Use your authorized Zogular admin credentials." : null}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Corporate Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@zogular.com" className="h-14 rounded-2xl border-white/10 bg-white/10 pl-11 text-sm font-bold text-white shadow-inner placeholder:text-zinc-500 focus-visible:ring-emerald-300" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Master Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter admin password" className="h-14 rounded-2xl border-white/10 bg-white/10 pl-11 pr-12 text-sm font-bold text-white shadow-inner placeholder:text-zinc-500 focus-visible:ring-emerald-300" />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide admin password" : "Show admin password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-zinc-200 transition-colors hover:bg-black/35 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" aria-label="Sign in to admin" disabled={isLoading} className="h-14 w-full rounded-2xl bg-white text-sm font-black text-zinc-950 shadow-xl shadow-black/20 transition-all hover:bg-emerald-50 active:scale-95 disabled:opacity-60">
                {isLoading ? "Verifying..." : <span className="flex items-center">Sign In <ArrowRight className="ml-2 h-4 w-4" /></span>}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
