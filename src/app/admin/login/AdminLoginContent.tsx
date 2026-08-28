"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api";
import { changeAdminTemporaryPassword, loginAdmin } from "@/services/admin/auth";
import {
  clearAdminVerificationRecoveryContext,
  createAdminVerificationRecoveryContext,
  getAdminVerificationRecoveryPath,
  storeAdminVerificationRecoveryContext,
} from "@/services/admin/verification-recovery";
import { appendNextPath } from "@/services/auth-intent";
import { isEmailVerificationRequiredError } from "@/services/auth";

type SignInState =
  | "idle"
  | "verifying"
  | "signed_in"
  | "error"
  | "verification_required"
  | "change_password_required"
  | "changing_password";

interface TemporaryPasswordContext {
  userId: string;
  currentPassword: string;
}

function getAdminLoginErrorMessage(error: unknown): string {
  if (isEmailVerificationRequiredError(error)) return "Verify your email to continue to admin.";
  if (error instanceof ApiError) {
    if (error.status === 400) return "Enter your admin email and password.";
    if (error.status === 401) return "Check your admin email and password and try again.";
    if (error.status === 403) return "This account cannot access Zogular admin.";
    if (error.status === 429) return "Too many attempts. Wait a moment, then try again.";
    return "Admin sign-in is unavailable right now. Try again.";
  }
  return "Admin sign-in failed. Check your details and try again.";
}

function getTemporaryPasswordErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 422) return "Check the new password details and try again.";
    if (error.status === 401 || error.status === 403) return "The temporary sign-in details could not be confirmed. Sign in again.";
    if (error.status === 404) return "This password setup is no longer available. Sign in again.";
    if (error.status === 429) return "Too many attempts. Wait a moment, then try again.";
    return "Password setup is unavailable right now. Try again.";
  }
  return "Password setup is unavailable right now. Try again.";
}

export default function AdminLoginContent({ nextPath }: { nextPath: string | null }) {
  const router = useRouter();
  const statusRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signInState, setSignInState] = useState<SignInState>("idle");
  const [message, setMessage] = useState("Use your authorized Zogular admin credentials.");
  const [verificationRecoveryHref, setVerificationRecoveryHref] = useState<string | null>(null);
  const [temporaryPasswordContext, setTemporaryPasswordContext] = useState<TemporaryPasswordContext | null>(null);
  const forgotPasswordHref = appendNextPath("/auth/forgot-password", nextPath ?? "/admin/dashboard");

  useEffect(() => {
    if (signInState === "idle") return;
    statusRef.current?.focus();
  }, [signInState, message]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setSignInState("error");
      setMessage("Enter your admin email and password.");
      return;
    }

    setIsLoading(true);
    setSignInState("verifying");
    setMessage("Checking your admin sign in…");
    setVerificationRecoveryHref(null);

    try {
      const session = await loginAdmin({ email, password, nextPath });
      if ("status" in session && session.status === "pending" && session.action === "CHANGE_PASSWORD_REQUIRED") {
        setTemporaryPasswordContext({ userId: session.userId, currentPassword: password });
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSignInState("change_password_required");
        setMessage("Set a private password to continue.");
        return;
      }

      if (session.success) {
        clearAdminVerificationRecoveryContext();
        setTemporaryPasswordContext(null);
        setSignInState("signed_in");
        setMessage("Signed in. Opening admin dashboard…");
        toast.success(session.message);
        router.replace(session.nextPath);
      }
    } catch (error) {
      setMessage(getAdminLoginErrorMessage(error));
      if (isEmailVerificationRequiredError(error)) {
        try {
          const context = createAdminVerificationRecoveryContext(email, nextPath);
          if (storeAdminVerificationRecoveryContext(context)) {
            setVerificationRecoveryHref(getAdminVerificationRecoveryPath(context.nextPath));
          }
        } catch {
          setVerificationRecoveryHref(null);
        }
        setSignInState("verification_required");
      } else {
        setSignInState("error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeTemporaryPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!temporaryPasswordContext || isLoading) return;
    if (!newPassword || !confirmPassword) {
      setSignInState("change_password_required");
      setMessage("Enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSignInState("change_password_required");
      setMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setSignInState("changing_password");
    setMessage("Updating your admin password…");

    try {
      const result = await changeAdminTemporaryPassword({
        userId: temporaryPasswordContext.userId,
        currentPassword: temporaryPasswordContext.currentPassword,
        newPassword,
        confirmPassword,
      });
      setTemporaryPasswordContext(null);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSignInState("idle");
      setMessage(result.message);
    } catch (error) {
      setSignInState("change_password_required");
      setMessage(getTemporaryPasswordErrorMessage(error));
      if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
        setTemporaryPasswordContext(null);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSignInState("error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-centered-auth className="auth-viewport relative flex items-center justify-center bg-zinc-950 px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,158,73,0.18),transparent_32rem),linear-gradient(135deg,rgba(24,24,27,0.55),rgba(9,9,11,0.95))]" />

      <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-400 via-amber-300 to-indigo-400" />
          <div className="mb-8 text-center">
            <BrandLogo variant="dark" className="mb-5 justify-center" imageClassName="h-12 w-auto drop-shadow-md" priority />
            <h1 className="text-2xl font-black tracking-tight text-white">Zogular <span className="text-emerald-300">Admin</span></h1>
            <p className="mt-2 text-sm font-medium text-zinc-400">Secure sign in for authorized administrators.</p>
          </div>

          <div
            ref={statusRef}
            tabIndex={-1}
            role={signInState === "error" || signInState === "verification_required" || signInState === "change_password_required" ? "alert" : "status"}
            aria-live="polite"
            className="mb-5 rounded-2xl border border-white/10 bg-white/7 p-3 text-xs font-bold text-zinc-300 outline-none"
          >
            {message}
          </div>

          {temporaryPasswordContext ? (
            <form onSubmit={handleChangeTemporaryPassword} className="space-y-4">
              <PasswordField
                id="admin-new-password"
                label="New password"
                autoComplete="new-password"
                placeholder="Choose a private password"
                value={newPassword}
                visible={showNewPassword}
                showLabel="Show new admin password"
                hideLabel="Hide new admin password"
                onChange={setNewPassword}
                onToggle={() => setShowNewPassword((current) => !current)}
              />
              <PasswordField
                id="admin-confirm-password"
                label="Confirm password"
                autoComplete="new-password"
                placeholder="Repeat private password"
                value={confirmPassword}
                visible={showConfirmPassword}
                showLabel="Show confirmed admin password"
                hideLabel="Hide confirmed admin password"
                onChange={setConfirmPassword}
                onToggle={() => setShowConfirmPassword((current) => !current)}
              />
              <Button type="submit" disabled={isLoading || !newPassword || !confirmPassword} className="h-14 w-full rounded-2xl bg-white text-sm font-black text-zinc-950 shadow-xl shadow-black/20 transition-all hover:bg-emerald-50 active:scale-95 disabled:opacity-60">
                {signInState === "changing_password" ? "Updating…" : "Set private password"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Admin email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@zogular.com" className="h-14 rounded-2xl border-white/10 bg-white/10 pl-11 text-sm font-bold text-white shadow-inner placeholder:text-zinc-500 focus-visible:ring-emerald-300" />
                </div>
              </div>

              <PasswordField
                id="admin-password"
                label="Password"
                autoComplete="current-password"
                placeholder="Enter admin password"
                value={password}
                visible={showPassword}
                showLabel="Show admin password"
                hideLabel="Hide admin password"
                onChange={setPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-zinc-500">Need access help?</span>
                <Link href={forgotPasswordHref} className="rounded-sm text-[11px] font-bold text-[#FF6B00] underline-offset-4 hover:text-[#e66000] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                  Forgot password?
                </Link>
              </div>

              {verificationRecoveryHref ? (
                <Button asChild variant="outline" className="h-11 w-full rounded-xl border-amber-300/30 bg-amber-300/10 text-sm font-bold text-amber-100 hover:bg-amber-300/15 hover:text-white">
                  <Link href={verificationRecoveryHref}>Resend verification email</Link>
                </Button>
              ) : null}

              <div className="pt-2">
                <Button type="submit" aria-label="Sign in to admin" disabled={isLoading} className="h-14 w-full rounded-2xl bg-white text-sm font-black text-zinc-950 shadow-xl shadow-black/20 transition-all hover:bg-emerald-50 active:scale-95 disabled:opacity-60">
                  {isLoading ? "Checking…" : <span className="flex items-center">Sign in <ArrowRight className="ml-2 h-4 w-4" /></span>}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
  value,
  visible,
  showLabel,
  hideLabel,
  onChange,
  onToggle,
}: {
  id: string;
  label: string;
  autoComplete: string;
  placeholder: string;
  value: string;
  visible: boolean;
  showLabel: string;
  hideLabel: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <Input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-14 rounded-2xl border-white/10 bg-white/10 pl-11 pr-12 text-sm font-bold text-white shadow-inner placeholder:text-zinc-500 focus-visible:ring-emerald-300" />
        <button
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          onClick={onToggle}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-zinc-200 transition-colors hover:bg-black/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
