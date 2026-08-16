"use client";

import { useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewArrivalsUnavailable() {
  const retryStartedRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  function retry() {
    if (retryStartedRef.current) return;
    retryStartedRef.current = true;
    setIsRetrying(true);
    window.location.reload();
  }

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8 md:pt-12">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-8 rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 md:text-5xl">
            New Arrivals
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-medium text-zinc-500 md:text-base">
            Browse the newest products available on Zogular.
          </p>
        </div>

        <section
          role="alert"
          data-testid="new-arrivals-unavailable"
          className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/70 px-5 py-10 text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-black text-red-950">New arrivals could not load</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-red-800">
            Please try again in a moment.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={retry}
            disabled={isRetrying}
            className="mt-5 min-h-11 rounded-xl border-red-300 px-5 font-bold text-red-800 hover:bg-red-100"
          >
            <RefreshCw className={isRetrying ? "animate-spin" : undefined} aria-hidden="true" />
            {isRetrying ? "Retrying…" : "Retry"}
          </Button>
        </section>
      </div>
    </main>
  );
}
