"use client";

import { X, Mail, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { BRAND } from "@/config/brand";

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactSupportModal({ isOpen, onClose }: ContactSupportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
        <div className="absolute right-4 top-4">
          <Button
            aria-label="Close support contact modal"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="mb-1 text-xl font-black text-zinc-900">Contact Support</h2>
        <p className="mb-6 text-xs font-medium text-zinc-500">
          In-app support messaging is pending backend rollout. Please use the direct contact fallback.
        </p>

        <FeaturePendingNotice
          compact
          title="Use the direct contact fallback"
          description="Share your seller ID, affected order ID, payout week, and the issue summary with operations or support."
        />

        <div className="mt-5 space-y-3">
          <a
            href={`mailto:${BRAND.supportEmail}?subject=Seller%20support%20request`}
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-300 hover:bg-white"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Email Support</p>
              <p className="truncate text-sm font-bold text-zinc-900">{BRAND.supportEmail}</p>
            </div>
          </a>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <PhoneCall className="h-4 w-4" />
              What to include
            </div>
            <p className="font-medium leading-relaxed text-amber-900/90">
              Seller name, storefront slug, order ID, payout reference, and any buyer or delivery notes that operations should review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
