"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, MailCheck, RefreshCcw } from "lucide-react";
import { ApiError } from "@/services/api";
import { resendVerificationEmail } from "@/services/auth";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  clearAdminVerificationRecoveryContext,
  getAdminLoginPath,
  getAdminVerificationRecoveryContext,
  type AdminVerificationRecoveryContext,
} from "@/services/admin/verification-recovery";

const RESEND_COOLDOWN_SECONDS = 60;

function getResendFailureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = getErrorCode(error.details);
    if (code === "EMAIL_ALREADY_VERIFIED" || error.status === 400) {
      return "This email is already verified. Sign in again to continue.";
    }
    if (error.status === 429) {
      return "Too many attempts. Wait a moment, then try again.";
    }
  }

  return "We could not send a verification email right now. Try again.";
}

function getErrorCode(payload: unknown): string | null {
  const queue: unknown[] = [payload];
  const seen = new Set<Record<string, unknown>>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || Array.isArray(current)) continue;
    const record = current as Record<string, unknown>;
    if (seen.has(record)) continue;
    seen.add(record);
    for (const key of ["code", "errorCode", "reason", "action"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
    }
    for (const key of ["data", "payload", "result", "error"]) {
      if (key in record) queue.push(record[key]);
    }
  }
  return null;
}

export default function AdminCheckEmailPage() {
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const [context, setContext] = useState<AdminVerificationRecoveryContext | null | undefined>(undefined);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const loginHref = useMemo(() => getAdminLoginPath(context?.nextPath), [context?.nextPath]);

  useEffect(() => {
    setContext(getAdminVerificationRecoveryContext());
  }, []);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timeout = window.setTimeout(
      () => setResendSecondsLeft((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timeout);
  }, [resendSecondsLeft]);

  useEffect(() => {
    if (message || error || context === null) statusRef.current?.focus();
  }, [context, error, message]);

  const handleResend = async () => {
    if (!context || isResending || resendSecondsLeft > 0) return;

    try {
      setIsResending(true);
      setError(null);
      setMessage(null);
      const result = await resendVerificationEmail(context.email, context.nextPath, { rememberEmail: false });
      if (result.emailSent === false) {
        setError("We could not send a verification email right now. Try again.");
      } else {
        setMessage("If this admin account can be verified, a new link has been sent.");
        setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      }
    } catch (caughtError) {
      setMessage(null);
      setError(getResendFailureMessage(caughtError));
    } finally {
      setIsResending(false);
    }
  };

  if (context === undefined) {
    return <AdminCheckEmailShell title="Checking verification" body="Preparing email verification…" loading />;
  }

  if (!context) {
    return (
      <AdminCheckEmailShell
        title="Return to admin sign in"
        body="Start from admin sign in so Zogular can send a fresh verification link to the email address you enter."
        alert
      >
        <Button asChild className="h-11 w-full rounded-xl bg-white text-sm font-black text-zinc-950 hover:bg-emerald-50">
          <Link href="/admin/login">Go to admin sign in</Link>
        </Button>
      </AdminCheckEmailShell>
    );
  }

  return (
    <AdminCheckEmailShell
      title="Verify your admin email"
      body="Open the verification email for this admin sign in. You can request a new link if needed."
    >
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-medium leading-5 text-zinc-300">
        <p>For privacy, this page does not show the full email address.</p>
        <p>If the email is eligible, Zogular will send a verification link.</p>
      </div>

      {message ? <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="text-xs font-medium text-emerald-300 outline-none">{message}</p> : null}
      {error ? <p ref={statusRef} tabIndex={-1} role="alert" className="text-xs font-medium text-amber-200 outline-none">{error}</p> : null}

      <div className="grid gap-3">
        <Button
          type="button"
          disabled={isResending || resendSecondsLeft > 0}
          onClick={handleResend}
          className="h-11 rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:bg-[#009E49] disabled:opacity-60"
        >
          {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          {isResending ? "Sending…" : resendSecondsLeft > 0 ? `Resend in ${resendSecondsLeft}s` : "Resend verification email"}
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm font-bold text-white backdrop-blur-md hover:bg-white/10 hover:text-white">
          <Link href={loginHref} onClick={clearAdminVerificationRecoveryContext}>Back to admin sign in</Link>
        </Button>
      </div>
    </AdminCheckEmailShell>
  );
}

function AdminCheckEmailShell({
  title,
  body,
  children,
  alert = false,
  loading = false,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
  alert?: boolean;
  loading?: boolean;
}) {
  return (
    <main data-centered-auth className="auth-viewport relative flex items-center justify-center bg-zinc-950 px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,158,73,0.18),transparent_32rem),linear-gradient(135deg,rgba(24,24,27,0.55),rgba(9,9,11,0.95))]" />
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-6 text-center text-white shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
        <BrandLogo variant="dark" className="mb-6 justify-center" imageClassName="h-10 w-auto drop-shadow-md" priority />
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border ${alert ? "border-amber-300/30 bg-amber-400/15 text-amber-200" : "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"}`}>
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : alert ? <AlertCircle className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
        <p tabIndex={-1} role={alert ? "alert" : "status"} aria-live="polite" className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6 text-zinc-300 outline-none">{body}</p>
        <div className="mt-6 grid gap-4">{children}</div>
      </section>
    </main>
  );
}
