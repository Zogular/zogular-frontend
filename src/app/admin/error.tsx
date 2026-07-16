"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminProtectedError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f7f6] px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm md:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-zinc-950">Admin access could not be verified</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
          Zogular could not reach the backend session authority. Your session has not been treated as signed out.
        </p>
        <Button onClick={reset} className="mt-6 h-11 rounded-xl bg-zinc-950 px-6 font-bold text-white hover:bg-zinc-800">
          Retry verification
        </Button>
      </section>
    </main>
  );
}
