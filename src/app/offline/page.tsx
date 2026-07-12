import { Truck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-50 px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200/50 text-zinc-400">
        <Truck className="h-10 w-10" />
      </div>
      <h1 className="mb-2 text-2xl font-black text-zinc-900 tracking-tight">You&apos;re Offline</h1>
      <p className="mb-8 max-w-[280px] text-sm text-zinc-500 font-medium leading-relaxed">
        It looks like you&apos;ve lost your internet connection. Please check your network and try again.
      </p>
      <Button asChild className="rounded-full bg-zinc-900 px-8 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105">
        <Link href="/">Try Again</Link>
      </Button>
    </div>
  );
}
