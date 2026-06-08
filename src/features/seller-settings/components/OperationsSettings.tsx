import { SettingsToggleSwitch } from "./SettingsToggleSwitch";
import type { StoreSettings } from "@/services/settings";

export function OperationsSettings({
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
      <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm md:p-7">
        <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-amber-900">Vacation Mode</h2>

        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-bold text-amber-900">Temporarily Hide Store</p>
            <p className="text-xs font-medium text-amber-700">Your products will not be visible to buyers while active.</p>
          </div>
          <SettingsToggleSwitch
            active={settings.operations.vacationMode}
            onClick={() => updateSetting("operations", "vacationMode", !settings.operations.vacationMode)}
          />
        </div>

        {settings.operations.vacationMode && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2">
            <p className="text-xs font-bold text-amber-900">Store is currently offline.</p>
          </div>
        )}
      </div>
    </div>
  );
}
