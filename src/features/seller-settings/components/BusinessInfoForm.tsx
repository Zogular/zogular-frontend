import { Input } from "@/components/ui/input";
import type { StoreSettings } from "@/services/settings";

export function BusinessInfoForm({
  settings,
  disabled = false,
  updateSetting,
}: {
  settings: StoreSettings;
  disabled?: boolean;
  updateSetting: <K extends keyof StoreSettings, F extends keyof StoreSettings[K]>(
    section: K,
    field: F,
    value: StoreSettings[K][F],
  ) => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
        <div className="mb-5 space-y-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Business & Contact Reference</h2>
          <p className="text-xs font-medium text-zinc-500">
            These fields are shown for seller profile context only until backend store settings persistence is available.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Owner Name</label>
            <Input
              placeholder="Full Name"
              value={settings.business.ownerName}
              onChange={(e) => updateSetting("business", "ownerName", e.target.value)}
              className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Support Email</label>
            <Input
              placeholder="support@store.com"
              type="email"
              value={settings.business.supportEmail}
              onChange={(e) => updateSetting("business", "supportEmail", e.target.value)}
              className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Business Phone</label>
            <Input
              type="tel"
              value={settings.business.phone}
              onChange={(e) => updateSetting("business", "phone", e.target.value)}
              className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Tax ID / TPIN (Optional)</label>
            <Input
              placeholder="TPIN Number"
              value={settings.business.taxNumber}
              onChange={(e) => updateSetting("business", "taxNumber", e.target.value)}
              className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
        <div className="mb-5 space-y-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Location Reference</h2>
          <p className="text-xs font-medium text-zinc-500">
            This address is a seller setup reference. It does not yet create live pickup, delivery, or service-area rules.
          </p>
        </div>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Street Address</label>
            <Input
              placeholder="Plot or Street Number"
              value={settings.business.address}
              onChange={(e) => updateSetting("business", "address", e.target.value)}
              className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">City</label>
              <Input
                placeholder="e.g. Lusaka"
                value={settings.business.city}
                onChange={(e) => updateSetting("business", "city", e.target.value)}
                className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Country</label>
              <Input
                placeholder="Zambia"
                value={settings.business.country}
                disabled
                className="h-11 rounded-xl bg-zinc-100 text-sm font-medium text-zinc-500 shadow-inner cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
