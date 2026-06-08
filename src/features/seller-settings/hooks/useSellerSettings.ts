import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { settingsApi, StoreSettings } from "@/services/settings";

export type TabType = "profile" | "business" | "fulfillment" | "operations";

export function useSellerSettings() {
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

  const saveSettings = useCallback(async () => {
    if (!settings) return;

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
    loading,
    error,
    isSaving,
    activeTab,
    setActiveTab,
    isSeoOpen,
    setIsSeoOpen,
    logoFileLabel,
    bannerFileLabel,
    logoInputRef,
    bannerInputRef,
    loadSettings,
    saveSettings,
    handleFormSubmit,
    handleAssetUpload,
    updateSetting,
  };
}
