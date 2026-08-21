import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UnknownOutcomeState({ onResume }: { onResume: () => void }) {
  return (
    <section role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-black">Order outcome not confirmed</h2>
          <p className="mt-1 text-sm font-medium leading-6">
            Check your orders first. If no new order appears, return here before trying again.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="h-11 rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800">
              <Link href="/account/orders">Check my orders</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl border-amber-300 bg-white px-5 font-bold">
              <Link href="/help">Contact support</Link>
            </Button>
            <Button type="button" variant="ghost" className="h-11 rounded-xl px-5 font-bold" onClick={onResume}>
              I checked — try again
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
