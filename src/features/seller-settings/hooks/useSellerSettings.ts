import { useState, useEffect, useCallback, useRef } from "react";
import {
  settingsApi,
  StoreSettings,
} from "@/services/settings";

export type TabType = "profile" | "business" | "fulfillment" | "operations";

export function useSellerSettings() {
  const isBackendPending = true;
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleAssetUpload = useCallback((field: "logo" | "banner", file: File | null) => {
    if (!file) return;
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
  }, []);

  useEffect(() => {
    const trackedObjectUrls = objectUrlRef;
    return () => {
      const urls = trackedObjectUrls.current;
      if (urls.logo) URL.revokeObjectURL(urls.logo);
      if (urls.banner) URL.revokeObjectURL(urls.banner);
    };
  }, []);

  const updateSetting = <K extends keyof StoreSettings, F extends keyof StoreSettings[K]>(
    section: K,
    field: F,
    value: StoreSettings[K][F],
  ) => {
    setSettings((prev) => (prev ? { ...prev, [section]: { ...prev[section], [field]: value } } : null));
  };

  return {
    settings,
    isBackendPending,
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
  };
}
