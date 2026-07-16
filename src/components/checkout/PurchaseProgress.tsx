"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export type PurchaseProgressStep = "cart" | "details" | "payment" | "review" | "confirmed";

interface PurchaseProgressProps {
  currentStep: PurchaseProgressStep;
  className?: string;
}

const steps: Array<{
  id: PurchaseProgressStep;
  activeClassName: string;
}> = [
  { id: "cart", activeClassName: "[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-amber-300 [&>[data-slot=progress-indicator]]:via-orange-400 [&>[data-slot=progress-indicator]]:to-[#FF6B00]" },
  { id: "details", activeClassName: "[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-orange-400 [&>[data-slot=progress-indicator]]:via-[#FF6B00] [&>[data-slot=progress-indicator]]:to-red-500" },
  { id: "payment", activeClassName: "[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-red-500 [&>[data-slot=progress-indicator]]:via-rose-500 [&>[data-slot=progress-indicator]]:to-fuchsia-500" },
  { id: "review", activeClassName: "[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-fuchsia-500 [&>[data-slot=progress-indicator]]:via-violet-500 [&>[data-slot=progress-indicator]]:to-sky-400" },
  { id: "confirmed", activeClassName: "[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-cyan-300 [&>[data-slot=progress-indicator]]:via-sky-500 [&>[data-slot=progress-indicator]]:to-blue-700" },
];

export function PurchaseProgress({ currentStep, className }: PurchaseProgressProps) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentStep));
  const activeStep = steps[currentIndex] ?? steps[0];
  const progressValue = ((currentIndex + 1) / steps.length) * 100;
  const currentStepName = steps[currentIndex]?.id || "cart";

  return (
    <div className={cn("sticky top-[7.75rem] z-40 w-full border-b border-white/60 bg-[#f4fbf6]/90 py-2 backdrop-blur-xl md:hidden", className)}>
      <div className="flex items-center justify-between mb-1 text-xs font-medium text-zinc-500 px-1">
        <span className="capitalize">{currentStepName}</span>
        <span aria-hidden="true">Step {currentIndex + 1} of {steps.length}</span>
      </div>
      <Progress
        value={progressValue}
        aria-label="Checkout Progress"
        aria-valuenow={progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("h-1.5 shadow-inner bg-zinc-200/80", activeStep.activeClassName)}
      />
    </div>
  );
}
