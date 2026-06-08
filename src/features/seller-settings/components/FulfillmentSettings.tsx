import { Input } from "@/components/ui/input";
import { SettingsToggleSwitch } from "./SettingsToggleSwitch";
import type { StoreSettings } from "@/services/settings";

export function FulfillmentSettings({
  settings,
  updateSetting,
}: {
  settings: StoreSettings;
  updateSetting: <K extends keyof StoreSettings, F extends keyof StoreSettings[K]>(
    section: K,
    field: F,
    value: StoreSettings[K][F],
  ) => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
        <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-zinc-900">Delivery Configuration</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-sm font-bold text-zinc-900">Offer Local Delivery</p>
              <p className="text-xs text-zinc-500">Allow buyers to request shipping via Zogular Logistics.</p>
            </div>
            <SettingsToggleSwitch
              active={settings.fulfillment.deliveryEnabled}
              onClick={() => updateSetting("fulfillment", "deliveryEnabled", !settings.fulfillment.deliveryEnabled)}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-sm font-bold text-zinc-900">Offer Store Pickup</p>
              <p className="text-xs text-zinc-500">Allow buyers to collect orders physically from your address.</p>
            </div>
            <SettingsToggleSwitch
              active={settings.fulfillment.pickupEnabled}
              onClick={() => updateSetting("fulfillment", "pickupEnabled", !settings.fulfillment.pickupEnabled)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-zinc-100">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Default Delivery Fee (K)</label>
              <Input
                type="number"
                value={settings.fulfillment.defaultDeliveryFee}
                onChange={(e) => updateSetting("fulfillment", "defaultDeliveryFee", Number(e.target.value))}
                className="h-11 rounded-xl bg-zinc-50 text-sm font-bold shadow-inner focus-visible:ring-[#009E49]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="free-delivery-threshold" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Free Delivery Threshold (K)
              </label>
              <Input
                type="number"
                value={settings.fulfillment.freeDeliveryThreshold}
                onChange={(e) => updateSetting("fulfillment", "freeDeliveryThreshold", Number(e.target.value))}
                className="h-11 rounded-xl bg-zinc-50 text-sm font-bold shadow-inner focus-visible:ring-[#009E49]"
              />
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
                <option value={3}>3-5 Business Days</option>
                <option value={7}>Pre-order (7+ Days)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
