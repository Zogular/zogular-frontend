import Link from "next/link";
import { ArrowRight, CircleHelp, PackageSearch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrackOrderPage() {
  return (
    <main className="min-h-dvh bg-[#f4fbf6] px-4 py-10 md:py-16">
      <div className="mx-auto max-w-4xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-8">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800">
                <PackageSearch className="h-3.5 w-3.5" />
                Tracking availability
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-zinc-950 md:text-5xl">
                Public delivery tracking is not available yet.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-zinc-600 md:text-base">
                Zogular currently coordinates Lusaka pilot deliveries manually. We will never generate a delivery timeline from an unverified order number.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/account/orders">
                  <Button className="h-12 w-full rounded-xl bg-zinc-950 px-6 font-bold text-white hover:bg-zinc-800 sm:w-auto">
                    View my orders <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/help">
                  <Button variant="outline" className="h-12 w-full rounded-xl border-zinc-200 px-6 font-bold sm:w-auto">
                    Contact support
                  </Button>
                </Link>
              </div>
            </div>

            <aside className="rounded-[1.6rem] border border-zinc-200 bg-zinc-50 p-5">
              <ShieldCheck className="h-6 w-6 text-[#009E49]" />
              <h2 className="mt-4 text-base font-black text-zinc-950">Need an order update?</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                Sign in to confirm the order belongs to your account, then use its support path for a manual status check.
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-xs font-semibold leading-5 text-zinc-600">
                <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B00]" />
                Have your order number ready when contacting support.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
