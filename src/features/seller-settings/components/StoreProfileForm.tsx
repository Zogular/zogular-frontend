import { Search, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";
import type { StoreSettings } from "@/services/settings";

export function StoreProfileForm({
  settings,
  disabled = false,
  updateSetting,
  logoInputRef,
  bannerInputRef,
  handleAssetUpload,
  logoFileLabel,
  bannerFileLabel,
  isSeoOpen,
  setIsSeoOpen,
}: {
  settings: StoreSettings;
  disabled?: boolean;
  updateSetting: <K extends keyof StoreSettings, F extends keyof StoreSettings[K]>(
    section: K,
    field: F,
    value: StoreSettings[K][F],
  ) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
  handleAssetUpload: (field: "logo" | "banner", file: File | null) => void;
  logoFileLabel: string | null;
  bannerFileLabel: string | null;
  isSeoOpen: boolean;
  setIsSeoOpen: (value: boolean) => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
        <div className="mb-5 space-y-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Storefront Profile Preview</h2>
          <p className="text-xs font-medium text-zinc-500">
            Review how seller-facing store details can map in the future. This page does not publish or persist storefront changes yet.
          </p>
        </div>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Store Name</label>
              <Input
                value={settings.profile.name}
                onChange={(e) => updateSetting("profile", "name", e.target.value)}
                placeholder="e.g. Zogular Electronics"
                className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Store URL Preview</label>
              <div className="relative flex items-center">
                <span aria-hidden="true" className="absolute left-3 text-sm font-medium text-zinc-400">
                  {BRAND.domain}/
                </span>
                <Input
                  value={settings.profile.slug}
                  onChange={(e) => updateSetting("profile", "slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="h-11 rounded-xl bg-zinc-50 pl-26 text-sm font-bold text-zinc-900 shadow-inner focus-visible:ring-[#009E49]"
                  disabled={disabled}
                />
              </div>
              <p className="text-[11px] font-medium text-zinc-500">A public storefront path is not activated from this page yet.</p>
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
              disabled={disabled}
            />
          </div>

          <div className="flex gap-4 pt-2 border-t border-zinc-100">
            <div className="space-y-1.5 flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Store Logo Preview</label>
              <div
                onClick={() => {
                  if (!disabled) logoInputRef.current?.click();
                }}
                className={cn(
                  "flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition-colors",
                  disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-zinc-100",
                )}
                role="button"
                aria-disabled={disabled}
              >
                {settings.profile.logo ? (
                  <div
                    className="flex h-full w-full items-center gap-3 rounded-xl bg-cover bg-center px-3"
                    style={{ backgroundImage: `url('${settings.profile.logo}')` }}
                  >
                    <div className="rounded-md bg-white/85 px-2 py-1 text-[10px] font-bold text-zinc-700">
                      {logoFileLabel ?? "Logo selected"}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-xs font-bold">{disabled ? "Upload support pending" : "Upload Logo"}</span>
                  </div>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleAssetUpload("logo", event.target.files?.[0] ?? null)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Cover Banner Preview</label>
              <div
                onClick={() => {
                  if (!disabled) bannerInputRef.current?.click();
                }}
                className={cn(
                  "flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition-colors",
                  disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-zinc-100",
                )}
                role="button"
                aria-disabled={disabled}
              >
                {settings.profile.banner ? (
                  <div
                    className="flex h-full w-full items-center gap-3 rounded-xl bg-cover bg-center px-3"
                    style={{ backgroundImage: `url('${settings.profile.banner}')` }}
                  >
                    <div className="rounded-md bg-white/85 px-2 py-1 text-[10px] font-bold text-zinc-700">
                      {bannerFileLabel ?? "Banner selected"}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-xs font-bold">{disabled ? "Upload support pending" : "Upload Banner"}</span>
                  </div>
                )}
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleAssetUpload("banner", event.target.files?.[0] ?? null)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SEO Collapsible */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
        <div
          className="flex cursor-pointer items-center justify-between p-5 transition-colors hover:bg-zinc-50/50 md:p-6"
          onClick={() => setIsSeoOpen(!isSeoOpen)}
        >
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
              <Search className="h-4 w-4 text-zinc-400" /> Discoverability Preview
            </h2>
            <p className="mt-1 text-xs font-medium text-zinc-500">Search snippet copy is shown for planning only and is not published from this page yet.</p>
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
                disabled={disabled}
              />
              <p className="text-[11px] font-medium text-zinc-500">This description may also help buyers find your store in future search results.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
