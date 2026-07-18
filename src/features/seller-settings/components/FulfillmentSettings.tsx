import { Input } from "@/components/ui/input";
import { SettingsToggleSwitch } from "./SettingsToggleSwitch";
import type { StoreSettings } from "@/services/settings";

export function FulfillmentSettings({
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
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Fulfillment Preferences</h2>
          <p className="text-xs font-medium text-zinc-500">
            These preferences are for preparation only. Buyer-facing delivery, pickup, and fee controls are not available yet.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-sm font-bold text-zinc-900">Local delivery preference</p>
              <p className="text-xs text-zinc-500">Reference only until delivery controls become available.</p>
            </div>
            <SettingsToggleSwitch
              active={settings.fulfillment.deliveryEnabled}
              onClick={() => updateSetting("fulfillment", "deliveryEnabled", !settings.fulfillment.deliveryEnabled)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-sm font-bold text-zinc-900">Store pickup preference</p>
              <p className="text-xs text-zinc-500">Shown as setup context only; it does not enable buyer pickup yet.</p>
            </div>
            <SettingsToggleSwitch
              active={settings.fulfillment.pickupEnabled}
              onClick={() => updateSetting("fulfillment", "pickupEnabled", !settings.fulfillment.pickupEnabled)}
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-zinc-100">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Planned Delivery Fee (K)</label>
              <Input
                type="number"
                value={settings.fulfillment.defaultDeliveryFee}
                onChange={(e) => updateSetting("fulfillment", "defaultDeliveryFee", Number(e.target.value))}
                className="h-11 rounded-xl bg-zinc-50 text-sm font-bold shadow-inner focus-visible:ring-[#009E49]"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="free-delivery-threshold" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Planned Free Delivery Threshold (K)
              </label>
              <Input
                type="number"
                value={settings.fulfillment.freeDeliveryThreshold ?? ""}
                onChange={(e) => updateSetting("fulfillment", "freeDeliveryThreshold", e.target.value === "" ? null : Number(e.target.value))}
                className="h-11 rounded-xl bg-zinc-50 text-sm font-bold shadow-inner focus-visible:ring-[#009E49]"
                disabled={disabled}
                placeholder="Not configured"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="processing-time-days" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Planned Processing Time
              </label>
              <select
                id="processing-time-days"
                value={settings.fulfillment.processingTimeDays}
                onChange={(e) => updateSetting("fulfillment", "processingTimeDays", Number(e.target.value))}
                className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                disabled={disabled}
              >
                <option value={0}>Same Day (Before 2 PM)</option>
                <option value={1}>1 Business Day</option>
                <option value={2}>2 Business Days</option>
                <option value={3}>3-5 Business Days</option>
                <option value={7}>Pre-order (7+ Days)</option>
              </select>
              <p className="text-[11px] font-medium text-zinc-500">This timing is not yet enforced as a live buyer-facing service promise.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
