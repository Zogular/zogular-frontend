"use client";

import { motion } from "motion/react";
import { ArrowRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { ProgressSummaryCard } from "./progress-summary-card";

export function SellerApplicationHero({
  viewModel,
  onContinue,
  onSave,
  saving,
}: {
  viewModel: SellerOnboardingViewModel;
  onContinue: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[32px] border border-[#E9E1D6] bg-[radial-gradient(circle_at_82%_18%,rgba(14,168,91,0.18),transparent_28%),radial-gradient(circle_at_12%_8%,rgba(184,146,79,0.2),transparent_30%),linear-gradient(135deg,#FFFCF8_0%,#F5EAD5_100%)] p-6 shadow-[0_30px_80px_rgba(31,26,20,0.1)] md:p-8"
    >
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8F6B34]">Seller application</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[0.98] tracking-tight text-[#1F1A14] md:text-5xl">
            Complete your seller application.
          </h1>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-[#5F594F] md:text-base">
            {viewModel.nextStep}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="button" onClick={onContinue} className="h-11 rounded-2xl bg-[#09281C] px-5 font-black text-white shadow-[0_18px_36px_rgba(9,40,28,0.2)] hover:bg-[#103D2B]">
              Continue application
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSave}
              disabled={saving || !viewModel.canEdit}
              className="h-11 rounded-2xl border-[#D8C9B8] bg-[#FFFCF8]/80 px-5 font-black text-[#1F1A14] hover:bg-white"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save draft"}
            </Button>
          </div>
        </div>
        <ProgressSummaryCard viewModel={viewModel} />
      </div>
    </motion.section>
  );
}
