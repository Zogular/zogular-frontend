import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreNotFound() {
  return (
    <main className="min-h-[60svh] bg-[#f4fbf6] px-4 py-12 md:px-6 md:py-16">
      <section className="mx-auto flex max-w-2xl flex-col items-center border-y border-zinc-200 bg-white px-5 py-10 text-center md:py-12">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#007d3a]">
          <Store className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-zinc-950">Store unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
          This store is not available.
        </p>
        <Button asChild className="mt-5 min-h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#007d3a]">
          <Link href="/products">Browse products</Link>
        </Button>
      </section>
    </main>
  );
}
