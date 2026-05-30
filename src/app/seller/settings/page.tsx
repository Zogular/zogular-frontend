"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Store, Briefcase, Truck, Settings2, ShieldCheck, Search, Image as ImageIcon,
  Wallet, Save, AlertCircle, RefreshCcw, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";

// Service Imports
import { settingsApi, StoreSettings } from "@/services/settings";

// ============================================================================
// 1. REUSABLE UI COMPONENTS
// ============================================================================
const ToggleSwitch = ({ active, onClick, disabled = false }: { active: boolean; onClick: () => void; disabled?: boolean }) => (
  <div 
    onClick={() => !disabled && onClick()} 
    className={cn(
      "relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      active ? "border-[#009E49] bg-[#009E49]" : "border-zinc-200 bg-zinc-100"
    )}
  >
    <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300", active ? "translate-x-5" : "translate-x-0.5")} />
  </div>
);

type TabType = "profile" | "business" | "fulfillment" | "operations";

// ============================================================================
// 2. MAIN PAGE EXPORT
// ============================================================================
export default function SellerSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [logoFileLabel, setLogoFileLabel] = useState<string | null>(null);
  const [bannerFileLabel, setBannerFileLabel] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<{ logo: string | null; banner: string | null }>({
    logo: null,
    banner: null,
  });

  // --- DATA FETCHING ---
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsApi.fetchSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // --- MUTATION HANDLERS ---
  const saveSettings = useCallback(async () => {
    if (!settings) return;

    // Basic Validation
    if (!settings.profile.name.trim() || !settings.business.supportEmail.trim()) {
      toast.error("Store Name and Support Email are required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(settings.business.supportEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await settingsApi.updateSettings(settings);
      setSettings(updated);
      toast.success("Settings saved successfully.");
    } catch {
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void saveSettings();
  };

  const handleAssetUpload = useCallback(
    (field: "logo" | "banner", file: File | null) => {
      if (!file) return;
      // Local object URLs keep upload UX realistic until backend media upload is connected.
      const nextUrl = URL.createObjectURL(file);
      const previousUrl = objectUrlRef.current[field];
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      objectUrlRef.current[field] = nextUrl;

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              profile: {
                ...prev.profile,
                [field]: nextUrl,
              },
            }
          : null,
      );

      if (field === "logo") setLogoFileLabel(file.name);
      else setBannerFileLabel(file.name);
    },
    [],
  );

  useEffect(() => {
    const trackedObjectUrls = objectUrlRef;
    return () => {
      const urls = trackedObjectUrls.current;
      if (urls.logo) URL.revokeObjectURL(urls.logo);
      if (urls.banner) URL.revokeObjectURL(urls.banner);
    };
  }, []);

  // Helper to update deeply nested state
  const updateSetting = <K extends keyof StoreSettings, F extends keyof StoreSettings[K]>(
    section: K,
    field: F,
    value: StoreSettings[K][F]
  ) => {
    setSettings((prev) => prev ? { ...prev, [section]: { ...prev[section], [field]: value } } : null);
  };

  // --- SYSTEM STATES ---
  if (loading) return (
    <div className="mx-auto max-w-300 animate-pulse space-y-6 pb-24 md:pb-12">
      <div className="h-10 w-64 rounded-xl bg-zinc-200" />
      <div className="flex gap-6">
        <div className="hidden w-64 flex-col gap-2 md:flex"><div className="h-11 rounded-xl bg-zinc-200" /><div className="h-11 rounded-xl bg-zinc-200" /></div>
        <div className="h-150 flex-1 rounded-3xl bg-zinc-200" />
      </div>
    </div>
  );

  if (error || !settings) return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center mt-6">
      <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
      <h3 className="text-base font-bold text-red-900">System Error</h3>
      <p className="mt-1 text-sm text-red-700">{error || "Settings not found."}</p>
      <Button onClick={loadSettings} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">Try Again</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-300 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-24 md:pb-12 h-full flex flex-col">
      
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Store Settings</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Configure your storefront, fulfillment, and business details.</p>
        </div>
        <Button onClick={() => void saveSettings()} disabled={isSaving} className="h-11 w-full rounded-xl bg-zinc-900 px-6 font-bold text-white shadow-md hover:bg-zinc-800 md:w-auto transition-all active:scale-95">
          {isSaving ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="flex flex-col gap-6 md:flex-row items-start">
        
        {/* 2. NAVIGATION (Desktop Sidebar / Mobile Scroll) */}
        <div className="w-full shrink-0 md:w-64 md:sticky md:top-6">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 hide-scrollbar md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
            {[
              { id: "profile", label: "Store Profile", icon: Store },
              { id: "business", label: "Business Info", icon: Briefcase },
              { id: "fulfillment", label: "Fulfillment", icon: Truck },
              { id: "operations", label: "Operations", icon: Settings2 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-bold transition-all",
                  activeTab === tab.id ? "bg-zinc-900 text-white shadow-md" : "bg-transparent text-zinc-600 hover:bg-zinc-100"
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
              Where your store earnings will be sent.
            </p>

            <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Active Payout Method
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-900">MTN Mobile Money</p>
              <p className="text-xs font-medium text-zinc-500">Zogular Store • ******1111</p>
            </div>

            <Link href="/seller/payouts">
              <Button
              variant="outline"
              className="mt-3 h-9 w-full rounded-lg border-zinc-200 bg-white text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-100 hover:text-zinc-900"
              >
              Manage Payouts
              </Button>
            </Link>
          </div>
        </div>

        {/* 3. SETTINGS FORMS */}
        <form onSubmit={handleFormSubmit} className="flex-1 min-w-0 w-full space-y-6">
          
          {/* ================= PROFILE TAB ================= */}
          {activeTab === "profile" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
                <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-zinc-900">Public Profile</h2>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Store Name</label>
                      <Input value={settings.profile.name} onChange={(e) => updateSetting("profile", "name", e.target.value)} placeholder="e.g. Zogular Electronics" className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Store URL Slug</label>
                      <div className="relative flex items-center">
                        <span aria-hidden="true" className="absolute left-3 text-sm font-medium text-zinc-400">{BRAND.domain}/</span>
                        <Input value={settings.profile.slug} onChange={(e) => updateSetting("profile", "slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className="h-11 rounded-xl bg-zinc-50 pl-26 text-sm font-bold text-zinc-900 shadow-inner focus-visible:ring-[#009E49]" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="store-description" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Store Description
                    </label>
                    <textarea
                      id="store-description"
                      value={settings.profile.description}
                      onChange={(e) => updateSetting("profile", "description", e.target.value)}
                      placeholder="What does your store sell?"
                      className="min-h-24 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                    />
                  </div>

                  <div className="flex gap-4 pt-2 border-t border-zinc-100">
                    <div className="space-y-1.5 flex-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Store Logo</label>
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="flex h-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition-colors hover:bg-zinc-100"
                      >
                        {settings.profile.logo ? (
                          <div className="flex h-full w-full items-center gap-3 rounded-xl bg-cover bg-center px-3" style={{ backgroundImage: `url('${settings.profile.logo}')` }}>
                            <div className="rounded-md bg-white/85 px-2 py-1 text-[10px] font-bold text-zinc-700">
                              {logoFileLabel ?? "Logo selected"}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-zinc-500"><ImageIcon className="h-4 w-4" /><span className="text-xs font-bold">Upload Logo</span></div>
                        )}
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleAssetUpload("logo", event.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Cover Banner</label>
                      <div
                        onClick={() => bannerInputRef.current?.click()}
                        className="flex h-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition-colors hover:bg-zinc-100"
                      >
                        {settings.profile.banner ? (
                          <div className="flex h-full w-full items-center gap-3 rounded-xl bg-cover bg-center px-3" style={{ backgroundImage: `url('${settings.profile.banner}')` }}>
                            <div className="rounded-md bg-white/85 px-2 py-1 text-[10px] font-bold text-zinc-700">
                              {bannerFileLabel ?? "Banner selected"}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-zinc-500"><ImageIcon className="h-4 w-4" /><span className="text-xs font-bold">Upload Banner</span></div>
                        )}
                      </div>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleAssetUpload("banner", event.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEO Collapsible */}
              <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
                <div className="flex cursor-pointer items-center justify-between p-5 transition-colors hover:bg-zinc-50/50 md:p-6" onClick={() => setIsSeoOpen(!isSeoOpen)}>
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><Search className="h-4 w-4 text-zinc-400" /> Discoverability & SEO</h2>
                    <p className="mt-1 text-xs font-medium text-zinc-500">Optimize how your store appears on Google.</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                    {isSeoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {isSeoOpen && (
                  <div className="animate-in space-y-4 border-t border-zinc-100 p-5 pt-4 fade-in slide-in-from-top-4 md:p-6 md:pt-4 bg-zinc-50/30">
                    <div className="space-y-1.5">
                      <label htmlFor="seo-meta-description" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Meta Description
                      </label>
                      <textarea
                        id="seo-meta-description"
                        value={settings.seo.metaDescription}
                        onChange={(e) => updateSetting("seo", "metaDescription", e.target.value)}
                        placeholder="Short summary for search engines..."
                        className="min-h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= BUSINESS TAB ================= */}
          {activeTab === "business" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
                <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-zinc-900">Contact & Support</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Owner Name</label>
                    <Input placeholder="Full Name" value={settings.business.ownerName} onChange={(e) => updateSetting("business", "ownerName", e.target.value)} className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Support Email</label>
                    <Input placeholder="support@store.com" type="email" value={settings.business.supportEmail} onChange={(e) => updateSetting("business", "supportEmail", e.target.value)} className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Business Phone</label>
                    <Input type="tel" value={settings.business.phone} onChange={(e) => updateSetting("business", "phone", e.target.value)} className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Tax ID / TPIN (Optional)</label>
                    <Input placeholder="TPIN Number" value={settings.business.taxNumber} onChange={(e) => updateSetting("business", "taxNumber", e.target.value)} className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
                <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-zinc-900">Fulfillment Location</h2>
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Street Address</label>
                    <Input placeholder="Plot or Street Number" value={settings.business.address} onChange={(e) => updateSetting("business", "address", e.target.value)} className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">City</label>
                      <Input placeholder="e.g. Lusaka" value={settings.business.city} onChange={(e) => updateSetting("business", "city", e.target.value)} className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Country</label>
                      <Input placeholder="Zambia" value={settings.business.country} disabled className="h-11 rounded-xl bg-zinc-100 text-sm font-medium text-zinc-500 shadow-inner cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= FULFILLMENT TAB ================= */}
          {activeTab === "fulfillment" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
                <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-zinc-900">Delivery Configuration</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">Offer Local Delivery</p>
                      <p className="text-xs text-zinc-500">Allow buyers to request shipping via Zogular Logistics.</p>
                    </div>
                    <ToggleSwitch active={settings.fulfillment.deliveryEnabled} onClick={() => updateSetting("fulfillment", "deliveryEnabled", !settings.fulfillment.deliveryEnabled)} />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">Offer Store Pickup</p>
                      <p className="text-xs text-zinc-500">Allow buyers to collect orders physically from your address.</p>
                    </div>
                    <ToggleSwitch active={settings.fulfillment.pickupEnabled} onClick={() => updateSetting("fulfillment", "pickupEnabled", !settings.fulfillment.pickupEnabled)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-zinc-100">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Default Delivery Fee (K)</label>
                      <Input type="number" value={settings.fulfillment.defaultDeliveryFee} onChange={(e) => updateSetting("fulfillment", "defaultDeliveryFee", Number(e.target.value))} className="h-11 rounded-xl bg-zinc-50 text-sm font-bold shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="free-delivery-threshold" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Free Delivery Threshold (K)
                      </label>
                      <Input type="number" value={settings.fulfillment.freeDeliveryThreshold} onChange={(e) => updateSetting("fulfillment", "freeDeliveryThreshold", Number(e.target.value))} className="h-11 rounded-xl bg-zinc-50 text-sm font-bold shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="processing-time-days" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Standard Processing Time
                      </label>
                      <select
                        id="processing-time-days"
                        value={settings.fulfillment.processingTimeDays}
                        onChange={(e) => updateSetting("fulfillment", "processingTimeDays", Number(e.target.value))}
                        className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                      >
                        <option value={0}>Same Day (Before 2 PM)</option>
                        <option value={1}>1 Business Day</option>
                        <option value={2}>2 Business Days</option>
                        <option value={3}>3+ Business Days</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= OPERATIONS TAB ================= */}
          {activeTab === "operations" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
              
              {/* Store Status */}
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
                <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><ShieldCheck className="h-4 w-4 text-zinc-400" /> Store Status</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">Storefront Visibility</p>
                      <p className="text-xs text-zinc-500">If disabled, your store will be hidden from buyers.</p>
                    </div>
                    <ToggleSwitch active={settings.operations.storefrontVisible} onClick={() => updateSetting("operations", "storefrontVisible", !settings.operations.storefrontVisible)} />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                    <div>
                      <p className="text-sm font-bold text-amber-700">Vacation Mode</p>
                      <p className="text-xs text-zinc-500">Pause new orders while keeping your products visible.</p>
                    </div>
                    <ToggleSwitch active={settings.operations.vacationMode} onClick={() => updateSetting("operations", "vacationMode", !settings.operations.vacationMode)} />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">Low Stock Alerts</p>
                      <p className="text-xs text-zinc-500">Receive notifications when inventory hits your threshold.</p>
                    </div>
                    <ToggleSwitch active={settings.operations.lowStockAlerts} onClick={() => updateSetting("operations", "lowStockAlerts", !settings.operations.lowStockAlerts)} />
                  </div>
                </div>
              </div>

              {/* Policies */}
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
                <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-zinc-900">Automations & Policies</h2>
                
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="auto-reply-message" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Customer Auto-Reply (Messaging)
                    </label>
                    <textarea
                      id="auto-reply-message"
                      value={settings.operations.autoReplyMessage}
                      onChange={(e) => updateSetting("operations", "autoReplyMessage", e.target.value)}
                      placeholder="Thanks for reaching out. We usually reply within 2 hours."
                      className="min-h-20 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label htmlFor="return-policy" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Return & Refund Policy
                    </label>
                    <textarea
                      id="return-policy"
                      value={settings.operations.returnPolicy}
                      onChange={(e) => updateSetting("operations", "returnPolicy", e.target.value)}
                      placeholder="Explain how returns and refunds work for buyers."
                      className="min-h-20 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}
        </form>
      </div>
      
      {/* Mobile Sticky Save */}
      <div className="fixed bottom-16 left-0 z-30 w-full border-t border-zinc-200 bg-white/95 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] backdrop-blur-md md:hidden">
        <Button onClick={() => void saveSettings()} disabled={isSaving} className="h-12 w-full rounded-xl bg-zinc-900 font-extrabold text-white shadow-md active:scale-95 hover:bg-zinc-800">
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

    </div>
  );
}
