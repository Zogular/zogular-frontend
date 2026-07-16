"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConsumerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4fbf6] px-4 py-12">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white p-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-6 w-6" /></div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-zinc-950">Marketplace data is temporarily unavailable</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">Zogular could not load this backend-backed page. No empty catalog or missing product result has been assumed.</p>
        <Button onClick={reset} className="mt-6 h-11 rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
      </section>
    </main>
  );
}
