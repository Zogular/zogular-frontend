import type { PurchaseProgressStep } from "@/components/checkout/PurchaseProgress";

export type CheckoutStage = Extract<PurchaseProgressStep, "details" | "payment" | "review">;

export type CheckoutErrorBoundary = "address" | "quote" | "create";
