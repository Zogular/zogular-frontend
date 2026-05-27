"use client";

import * as React from "react";
import {
  User,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Trash2,
  Bell,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/states/FeedbackState";
import {
  deletePaymentMethod,
  getAccountSettings,
  saveAccountProfile,
  saveNotificationPreferences,
  updateAccountPassword,
} from "@/services/account";
import type { AccountSettings } from "@/types/account";

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<AccountSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState({ current: "", next: "" });
  const [visiblePasswords, setVisiblePasswords] = React.useState({
    current: false,
    next: false,
  });
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = React.useState<number | null>(null);
  const [savingNotificationKey, setSavingNotificationKey] =
    React.useState<keyof AccountSettings["notifications"] | null>(null);

  const loadSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAccountSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account settings.");
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

  const handleDeletePayment = async (id: number) => {
    if (!settings) return;
    const payment = settings.payments.find((item) => item.id === id);
    if (payment?.isDefault) return;

    try {
      setDeletingPaymentId(id);
      await deletePaymentMethod(id);
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              payments: prev.payments.filter((item) => item.id !== id),
            }
          : prev,
      );
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleToggleNotification = async (
    key: keyof AccountSettings["notifications"],
  ) => {
    if (!settings) return;

    const nextNotifications = {
      ...settings.notifications,
      [key]: !settings.notifications[key],
    };

    setSettings((prev) => (prev ? { ...prev, notifications: nextNotifications } : prev));

    try {
      setSavingNotificationKey(key);
      const saved = await saveNotificationPreferences(nextNotifications);
      setSettings((prev) => (prev ? { ...prev, notifications: saved } : prev));
    } finally {
      setSavingNotificationKey(null);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm font-medium text-zinc-500">Loading account settings...</div>;
  }

  if (error || !settings) {
    return (
      <FeedbackState
        icon={AlertCircle}
        tone="danger"
        title="Failed to load settings"
        description={error ?? "We couldn't load your account settings right now."}
        action={
          <Button onClick={loadSettings} variant="outline" className="border-red-200 text-red-700 hover:bg-red-100">
            Try Again
          </Button>
        }
      />
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

      <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-[1fr_1fr] xl:gap-8">
        <div className="space-y-6">
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
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Phone Number</label>
                <Input
                  type="tel"
                  value={settings.profile.phone}
                  onChange={(event) => handleProfileChange("phone", event.target.value)}
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 shadow-sm focus-visible:ring-[#009E49]"
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

        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
            <h2 className="mb-6 flex items-center gap-3 text-lg font-black text-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]">
                <CreditCard className="h-5 w-5" />
              </div>
              Payment Methods
            </h2>

            <div className="space-y-3">
              {settings.payments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 p-4 text-sm font-medium text-zinc-500">
                  No payment methods are connected yet.
                </div>
              ) : (
                settings.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-sm transition-all hover:border-zinc-300">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${payment.type === "Mobile Money" ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"}`}>
                        {payment.type === "Mobile Money" ? <Smartphone className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-zinc-900">
                            {payment.provider} <span className="hidden sm:inline">{payment.type}</span>
                          </p>
                          {payment.isDefault ? (
                            <Badge className="border-none bg-[#009E49]/10 px-2 py-0 text-[10px] text-[#009E49]">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Default
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs font-medium text-zinc-500">{payment.account}</p>
                      </div>
                    </div>

                    <Button
                      aria-label={payment.isDefault ? `Default payment method ${payment.provider}` : `Remove payment method ${payment.provider}`}
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={payment.isDefault || deletingPaymentId === payment.id}
                      className={`h-8 w-8 rounded-xl ${
                        payment.isDefault
                          ? "cursor-not-allowed text-zinc-300 opacity-60 hover:bg-transparent hover:text-zinc-300"
                          : "text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      }`}
                    >
                      {deletingPaymentId === payment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
            <h2 className="mb-6 flex items-center gap-3 text-lg font-black text-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <Bell className="h-5 w-5" />
              </div>
              Notifications
            </h2>

            <div className="space-y-5">
              {[
                { key: "orders", label: "Order Updates", desc: "Get notified about your delivery status." },
                { key: "promos", label: "Promotions & Discounts", desc: "Hear about flash sales and price drops." },
              ].map((item) => {
                const isActive = settings.notifications[item.key as keyof AccountSettings["notifications"]];
                const isSaving = savingNotificationKey === item.key;

                return (
                  <div key={item.key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-zinc-900">{item.label}</p>
                      <p className="text-xs font-medium text-zinc-500">{item.desc}</p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-label={`Toggle ${item.label}`}
                      aria-checked={isActive}
                      aria-busy={isSaving}
                      onClick={() => handleToggleNotification(item.key as keyof AccountSettings["notifications"])}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${
                        isActive ? "bg-purple-500" : "bg-zinc-200"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isActive ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                      {isSaving ? <Loader2 className="absolute right-3 h-3 w-3 animate-spin text-white" /> : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
