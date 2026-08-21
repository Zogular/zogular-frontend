"use client";

import Link from "next/link";
import {
  Store,
  Briefcase,
  Truck,
  Settings2,
  Wallet,
  AlertCircle,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FeaturePendingNotice,
} from "@/components/shared/FeaturePendingNotice";

import { useSellerSettings, type TabType } from "@/features/seller-settings/hooks/useSellerSettings";
import { StoreProfileForm } from "@/features/seller-settings/components/StoreProfileForm";
import { BusinessInfoForm } from "@/features/seller-settings/components/BusinessInfoForm";
import { FulfillmentSettings } from "@/features/seller-settings/components/FulfillmentSettings";
import { OperationsSettings } from "@/features/seller-settings/components/OperationsSettings";
import { SELLER_SETTINGS_BACKEND_PENDING_NOTICE } from "@/services/settings";

export default function SellerSettingsPage() {
  const {
    settings,
    isWritePending,
    loading,
    error,
    activeTab,
    setActiveTab,
    isSeoOpen,
    setIsSeoOpen,
    logoFileLabel,
    bannerFileLabel,
    logoInputRef,
    bannerInputRef,
    loadSettings,
    handleAssetUpload,
    updateSetting,
  } = useSellerSettings();

  if (loading) {
    return (
      <div className="mx-auto max-w-300 animate-pulse space-y-6 pb-24 md:pb-12">
        <div className="h-10 w-64 rounded-xl bg-zinc-200" />
        <div className="flex gap-6">
          <div className="hidden w-64 flex-col gap-2 md:flex">
            <div className="h-11 rounded-xl bg-zinc-200" />
            <div className="h-11 rounded-xl bg-zinc-200" />
          </div>
          <div className="h-150 flex-1 rounded-3xl bg-zinc-200" />
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center mt-6">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">Settings could not load</h3>
        <p className="mt-1 text-sm text-red-700">{error || "Zogular could not load your seller settings right now. Try again."}</p>
        <Button onClick={loadSettings} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-300 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-24 md:pb-12 h-full flex flex-col">
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Store Profile & Settings</h1>
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Review your current store information. Editing and publishing changes are not available yet.
          </p>
        </div>
        <Button
          disabled
          className="h-11 w-full rounded-xl bg-zinc-900 px-6 font-bold text-white shadow-md hover:bg-zinc-800 md:w-auto transition-all active:scale-95"
        >
          <LockKeyhole className="mr-2 h-4 w-4" />
          {isWritePending ? "Read-only for now" : "Save unavailable"}
        </Button>
      </div>

      <FeaturePendingNotice
        title="Settings are read-only for now"
        description={SELLER_SETTINGS_BACKEND_PENDING_NOTICE}
      />

      <div className="flex flex-col gap-6 md:flex-row items-start">
        {/* 2. NAVIGATION (Desktop Sidebar / Mobile Scroll) */}
        <div className="w-full shrink-0 md:w-64 md:sticky md:top-6">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 hide-scrollbar md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
            {[
              { id: "profile", label: "Store Profile", icon: Store },
              { id: "business", label: "Business Info", icon: Briefcase },
              { id: "fulfillment", label: "Fulfillment", icon: Truck },
              { id: "operations", label: "Operations", icon: Settings2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-bold transition-all",
                  activeTab === tab.id ? "bg-zinc-900 text-white shadow-md" : "bg-transparent text-zinc-600 hover:bg-zinc-100",
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Payout Quick Link (Desktop Sidebar Only) */}
          <div className="hidden mt-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 md:block">
            <div className="mb-2 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900">Payouts</h3>
            </div>

              <p className="mb-3 text-xs font-medium text-zinc-500">
                Review payout preparation details here. Balances, approvals, and transfers are not available yet.
              </p>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Payout Readiness</p>
                <p className="mt-1 text-sm font-bold text-zinc-900">Not available yet</p>
                <p className="text-xs font-medium text-zinc-500">Your verified payout details will appear here when payouts become available.</p>
              </div>

            <Link href="/seller/payouts">
              <Button
                variant="outline"
                className="mt-3 h-9 w-full rounded-lg border-zinc-200 bg-white text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-100 hover:text-zinc-900"
              >
                View payout readiness
              </Button>
            </Link>
          </div>
        </div>

        {/* 3. SETTINGS FORMS */}
        <form className="flex-1 min-w-0 w-full space-y-6">
          {activeTab === "profile" && (
            <StoreProfileForm
              settings={settings}
              disabled={isWritePending}
              updateSetting={updateSetting}
              logoInputRef={logoInputRef}
              bannerInputRef={bannerInputRef}
              handleAssetUpload={handleAssetUpload}
              logoFileLabel={logoFileLabel}
              bannerFileLabel={bannerFileLabel}
              isSeoOpen={isSeoOpen}
              setIsSeoOpen={setIsSeoOpen}
            />
          )}

          {activeTab === "business" && (
            <BusinessInfoForm settings={settings} disabled={isWritePending} updateSetting={updateSetting} />
          )}

          {activeTab === "fulfillment" && (
            <FulfillmentSettings settings={settings} disabled={isWritePending} updateSetting={updateSetting} />
          )}

          {activeTab === "operations" && (
            <OperationsSettings settings={settings} disabled={isWritePending} updateSetting={updateSetting} />
          )}
        </form>
      </div>
    </div>
  );
}
