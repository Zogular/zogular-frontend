"use client";

import * as React from "react";
import {
  User,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountLoadErrorState } from "@/components/account/AccountLoadErrorState";
import {
  getAccountSettings,
  saveAccountProfile,
  updateAccountPassword,
} from "@/services/account";
import type { AccountSettings } from "@/types/account";

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<AccountSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);
  const [password, setPassword] = React.useState({ current: "", next: "" });
  const [visiblePasswords, setVisiblePasswords] = React.useState({
    current: false,
    next: false,
  });
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  const loadSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAccountSettings();
      setSettings(data);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleProfileChange = (key: keyof AccountSettings["profile"], value: string) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              [key]: value,
            },
          }
        : prev,
    );
  };

  const handleSaveProfile = async () => {
    if (!settings) return;
    try {
      setIsSavingProfile(true);
      const profile = await saveAccountProfile(settings.profile);
      setSettings((prev) => (prev ? { ...prev, profile } : prev));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    try {
      setIsUpdatingPassword(true);
      await updateAccountPassword({
        currentPassword: password.current,
        newPassword: password.next,
      });
      setPassword({ current: "", next: "" });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const togglePasswordVisibility = (key: keyof typeof visiblePasswords) => {
    setVisiblePasswords((current) => ({ ...current, [key]: !current[key] }));
  };



  if (loading) {
    return <div className="py-16 text-center text-sm font-medium text-zinc-500">Loading account settings...</div>;
  }

  if (error || !settings) {
    return (
      <AccountLoadErrorState error={error} resource="settings" onRetry={loadSettings} />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
          Account Settings
        </h1>
        <p className="mt-1 text-sm font-medium text-zinc-500">
          Manage your personal information, security, and preferences.
        </p>
      </div>

      <div className="flex flex-col gap-6 pt-2 max-w-2xl">
        <section className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
          <h2 className="mb-6 flex items-center gap-3 text-lg font-black text-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#009E49]/10 text-[#009E49]">
              <User className="h-5 w-5" />
            </div>
            Personal Info
          </h2>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">First Name</label>
                <Input
                  value={settings.profile.firstName}
                  onChange={(event) => handleProfileChange("firstName", event.target.value)}
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 shadow-sm focus-visible:ring-[#009E49]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Last Name</label>
                <Input
                  value={settings.profile.lastName}
                  onChange={(event) => handleProfileChange("lastName", event.target.value)}
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 shadow-sm focus-visible:ring-[#009E49]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Email Address</label>
              <Input
                type="email"
                value={settings.profile.email}
                onChange={(event) => handleProfileChange("email", event.target.value)}
                className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 shadow-sm focus-visible:ring-[#009E49]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Primary Phone Number
              </label>
              <Input
                type="tel"
                value={settings.profile.phone}
                onChange={(event) => handleProfileChange("phone", event.target.value)}
                className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 shadow-sm focus-visible:ring-[#009E49]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500">
                <span>Preferred MoMo Number</span>
                <span className="text-[10px] font-medium text-[#009E49] bg-[#009E49]/10 px-2 py-0.5 rounded-md">Optional</span>
              </label>
              <Input
                type="tel"
                value={settings.profile.preferredMoMoNumber || ""}
                onChange={(event) => handleProfileChange("preferredMoMoNumber", event.target.value)}
                className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 shadow-sm focus-visible:ring-[#009E49]"
                placeholder="09XXXXXXXX"
              />
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="mt-2 h-11 w-full rounded-xl bg-[#009E49] font-bold text-white shadow-md shadow-[#009E49]/20 hover:bg-[#00853d]"
            >
              {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSavingProfile ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
          <h2 className="mb-6 flex items-center gap-3 text-lg font-black text-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            Security
          </h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Current Password</label>
              <div className="relative">
                <Input
                  type={visiblePasswords.current ? "text" : "password"}
                  value={password.current}
                  onChange={(event) => setPassword((prev) => ({ ...prev, current: event.target.value }))}
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 pr-11 shadow-sm focus-visible:ring-blue-500"
                />
                <button
                  type="button"
                  aria-label={visiblePasswords.current ? "Hide current password" : "Show current password"}
                  onClick={() => togglePasswordVisibility("current")}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {visiblePasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">New Password</label>
              <div className="relative">
                <Input
                  type={visiblePasswords.next ? "text" : "password"}
                  value={password.next}
                  onChange={(event) => setPassword((prev) => ({ ...prev, next: event.target.value }))}
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 pr-11 shadow-sm focus-visible:ring-blue-500"
                />
                <button
                  type="button"
                  aria-label={visiblePasswords.next ? "Hide new password" : "Show new password"}
                  onClick={() => togglePasswordVisibility("next")}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {visiblePasswords.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword || !password.current || !password.next}
              className="mt-2 h-11 w-full rounded-xl border-zinc-200 font-bold text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
