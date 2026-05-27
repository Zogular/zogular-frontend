"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { verifyEmailToken } from "@/services/auth";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!token) {
        setState("error");
        setMessage("Verification token is missing.");
        return;
      }

      try {
        const result = await verifyEmailToken(token);
        if (!active) return;
        setState("success");
        setMessage(result.message);
      } catch (err) {
        if (!active) return;
        setState("error");
        setMessage(err instanceof Error ? err.message : "Email verification failed.");
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [token]);

  const isSuccess = state === "success";
  const isLoading = state === "loading";

  return (
    <main
      className="relative h-screen w-full overflow-hidden bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="relative z-10 flex min-h-screen flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>
            <div className="space-y-3">
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border lg:mx-0 ${isSuccess ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200" : state === "error" ? "border-red-300/30 bg-red-400/15 text-red-200" : "border-white/10 bg-white/10 text-white"}`}>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : isSuccess ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                {isLoading ? "Verifying email" : isSuccess ? "Email verified" : "Verification failed"}
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">{message}</p>
            </div>
          </div>

          <Link href="/auth/login">
            <Button
              disabled={isLoading}
              className="h-11 w-full rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
            >
              {isSuccess ? "Continue to login" : "Back to login"}
            </Button>
          </Link>
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
