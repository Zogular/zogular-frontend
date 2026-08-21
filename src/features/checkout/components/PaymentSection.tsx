import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckoutStage } from "@/features/checkout/types/checkout.types";

interface PaymentSectionProps {
  stage: CheckoutStage;
  onBack: () => void;
  onReview: () => void;
}

export function PaymentSection({ stage, onBack, onReview }: PaymentSectionProps) {
  return (
    <section className={`${stage === "payment" ? "block" : "hidden"} rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:block md:p-8`}>
      <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-zinc-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">2</span>
        Payment Method
      </h2>
      <div className="rounded-2xl border-2 border-[#009E49] bg-[#009E49]/5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-zinc-900">
              <Smartphone className="h-5 w-5 text-[#009E49]" />
              <span>Cash on delivery</span>
            </div>
            <p className="text-xs font-medium leading-relaxed text-zinc-600">
              The delivery fee is due before dispatch. Pay the product amount in cash on delivery.
            </p>
            <p className="text-xs font-medium leading-relaxed text-zinc-500">
              Other payment methods are not available yet.
            </p>
          </div>
          <span className="rounded-full border border-[#009E49]/20 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#009E49]">
            Available
          </span>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
        Your order total is confirmed before you place the order.
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:hidden">
        <Button type="button" variant="outline" onClick={onBack} className="h-12 rounded-xl border-zinc-200 font-bold">
          Back
        </Button>
        <Button type="button" onClick={onReview} className="h-12 rounded-xl bg-[#009E49] font-black text-white hover:bg-[#00853d]">
          Review Order
        </Button>
      </div>
    </section>
  );
}
