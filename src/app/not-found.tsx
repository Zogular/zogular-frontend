import Link from "next/link";
import { PackageOpen, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f4fbf6] px-6 text-center">
      
      {/* 🔥 Animated Background Layer */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        
        {/* soft gradient blobs */}
        <div className="absolute -left-20 top-0 h-80 w-80 animate-[float_12s_ease-in-out_infinite] rounded-full bg-[#009E49]/10 blur-3xl" />
        <div className="absolute right-0 top-10 h-96 w-96 animate-[float_16s_ease-in-out_infinite] rounded-full bg-[#FF6B00]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 animate-[float_20s_ease-in-out_infinite] rounded-full bg-blue-400/10 blur-3xl" />

        {/* subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-size-[40px_40px]" />
      </div>

      {/* EXISTING ANIMATION BLOCK */}
      <div className="relative mb-8 flex h-48 w-48 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-[#FF6B00]/20 opacity-75 duration-1000" />
        <div className="absolute inset-8 animate-pulse rounded-full bg-[#009E49]/20" />

        <div className="relative animate-bounce rounded-3xl border border-white/50 bg-white/80 p-5 shadow-2xl backdrop-blur-md">
          <PackageOpen className="h-14 w-14 text-[#FF6B00]" />
        </div>
      </div>

      <h1 className="mb-2 text-4xl font-black tracking-tighter text-zinc-900 md:text-5xl">
        404 - Lost in Transit
      </h1>

      <p className="mb-8 max-w-md text-sm font-medium leading-relaxed text-zinc-500 md:text-base">
        Looks like this page or product is still being built, or the link you followed is broken. Let&apos;s get you back to Zogular.
      </p>

      <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#009E49] px-6 font-bold text-white shadow-lg shadow-[#009E49]/20 transition-all hover:scale-[1.02] hover:bg-[#00853d]"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>

        <Link
          href="/categories"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50"
        >
          <Search className="h-4 w-4" />
          Browse
        </Link>
      </div>
    </main>
  );
}