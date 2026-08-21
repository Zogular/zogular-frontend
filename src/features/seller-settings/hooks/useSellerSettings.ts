import { useState, useEffect, useCallback } from "react";
import {
  settingsApi,
  StoreSettings,
} from "@/services/settings";
import { getSellerSafeErrorMessage } from "@/lib/seller-error";

export type TabType = "profile" | "business" | "fulfillment" | "operations";

export function useSellerSettings() {
  const isReadConnected = true;
  const isWritePending = true;
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [isSeoOpen, setIsSeoOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsApi.fetchSettings();
      setSettings(data);
    } catch (err) {
      setError(getSellerSafeErrorMessage(err, "settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = <K extends keyof StoreSettings, F extends keyof StoreSettings[K]>(
    section: K,
    field: F,
    value: StoreSettings[K][F],
  ) => {
    void section;
    void field;
    void value;
  };

  return {
    settings,
    isReadConnected,
    isWritePending,
    loading,
    error,
    activeTab,
    setActiveTab,
    isSeoOpen,
    setIsSeoOpen,
    loadSettings,
    updateSetting,
  };
}
