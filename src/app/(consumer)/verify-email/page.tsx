"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { verifyEmailToken } from "@/services/auth";
import type { AuthActionResult } from "@/types/auth";
import { appendNextPath, getAuthRedirectIntent, sanitizeInternalNextPath } from "@/services/auth-intent";
import {
  clearAdminVerificationRecoveryContext,
  getAdminLoginPath,
  getAdminVerificationRecoveryPath,
  sanitizeAdminNextPath,
} from "@/services/admin/verification-recovery";

type VerifyState = "loading" | "success" | "error";

const emailVerificationRequests = new Map<string, Promise<AuthActionResult>>();

function verifyEmailTokenOnce(token: string): Promise<AuthActionResult> {
  const existingRequest = emailVerificationRequests.get(token);
  if (existingRequest) return existingRequest;

  const request = verifyEmailToken(token).catch((error: unknown) => {
    emailVerificationRequests.delete(token);
    throw error;
  });
  emailVerificationRequests.set(token, request);

  return request;
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

function getVerificationFailureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = getErrorCode(error.details);
    if (code === "VERIFICATION_TOKEN_EXPIRED") {
      return "This verification link has expired. Request a new link and try again.";
    }
    if (
      code === "VERIFICATION_TOKEN_REQUIRED" ||
      code === "VERIFICATION_TOKEN_INVALID" ||
      error.status === 400
    ) {
      return "This verification link is invalid or has already been used.";
    }
    if (error.status === 429) {
      return "Too many attempts. Wait a moment, then try again.";
    }
  }

  return "We could not verify this email right now. Try again.";
}

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const rawNextPath = searchParams.get("next");
  const adminNextPath = sanitizeAdminNextPath(rawNextPath);
  const nextPath = adminNextPath ?? sanitizeInternalNextPath(rawNextPath) ?? getAuthRedirectIntent();
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const verifiedTokenRef = useRef<string | null>(null);

  const isAdminFlow = Boolean(adminNextPath);
  const isSellerFlow = nextPath?.startsWith("/seller");
  const loginHref = isAdminFlow
    ? getAdminLoginPath(adminNextPath)
    : isSellerFlow
    ? appendNextPath("/seller/login", nextPath)
    : appendNextPath("/auth/login", nextPath);
  const adminRecoveryHref = isAdminFlow ? getAdminVerificationRecoveryPath(adminNextPath) : null;

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!token) {
        setState("error");
        setMessage("This verification link is missing or incomplete.");
        return;
      }

      if (verifiedTokenRef.current === token) {
        setState("success");
        setMessage("Email verified successfully. You can now sign in.");
        return;
      }
      verifiedTokenRef.current = token;

      try {
        const result = await verifyEmailTokenOnce(token);
        if (!active) return;
        if (isAdminFlow) clearAdminVerificationRecoveryContext();
        setState("success");
        setMessage(result.message);
      } catch (err) {
        if (!active) return;
        setState("error");
        setMessage(getVerificationFailureMessage(err));
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [isAdminFlow, token]);

  const isSuccess = state === "success";
  const isLoading = state === "loading";

  return (
    <main
      className="auth-viewport relative w-full bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="auth-panel relative z-10 flex flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>
            <div className="space-y-3">
              {isAdminFlow ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  Admin
                </div>
              ) : null}
              {isSellerFlow ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  Seller Portal
                </div>
              ) : null}
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border lg:mx-0 ${isSuccess ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200" : state === "error" ? "border-red-300/30 bg-red-400/15 text-red-200" : "border-white/10 bg-white/10 text-white"}`}>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : isSuccess ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                {isLoading ? "Verifying email" : isSuccess ? "Email verified" : "Verification failed"}
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">{message}</p>
            </div>
          </div>

          <Link href={loginHref}>
            <Button
              disabled={isLoading}
              className="h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
            >
              {isSuccess
                ? isAdminFlow
                  ? "Continue to admin sign in"
                  : isSellerFlow
                  ? "Continue to seller sign in"
                  : "Continue to login"
                : "Back to login"}
            </Button>
          </Link>
          {adminRecoveryHref && !isLoading && !isSuccess ? (
            <Link href={adminRecoveryHref} className="mt-4 block rounded-sm text-center text-sm font-bold text-zinc-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white">
              Request a new admin verification link
            </Link>
          ) : null}
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
