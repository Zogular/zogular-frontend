"use client";

import Link from "next/link";
import { MapPin, Bell, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { savePermissionPreferences } from "@/services/auth";

export default function PermissionsPage() {
  const router = useRouter();
  const [locationOn, setLocationOn] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      const result = await savePermissionPreferences({
        locationEnabled: locationOn,
        notificationsEnabled: notificationsOn,
      });
      router.push(result.nextPath ?? "/");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="auth-viewport relative w-full bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="auth-panel relative z-10 flex flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <Link href="/">
          <Button variant="ghost" className="absolute right-4 top-4 z-20 rounded-full text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white">
            Skip for now
          </Button>
        </Link>

        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto drop-shadow-md" priority />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-3xl">
                Optimize your app
              </h1>
              <p className="text-xs font-medium leading-relaxed text-zinc-300 md:text-sm">
                Enable these features to get the best shopping experience in your area.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className={`cursor-pointer rounded-2xl border p-4 backdrop-blur-md transition-all duration-300 ${
                locationOn ? "border-[#009E49]/50 bg-[#009E49]/10 shadow-[0_0_15px_rgba(0,158,73,0.15)]" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
              onClick={() => setLocationOn(!locationOn)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2.5 ${locationOn ? "bg-[#009E49] text-white" : "bg-white/10 text-zinc-400"}`}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Location Services</h3>
                    <p className="mt-0.5 max-w-40 text-[10px] text-zinc-400">Browse buyer-visible products and confirm delivery terms at checkout.</p>
                  </div>
                </div>
                <div className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors duration-300 ${locationOn ? "bg-[#009E49]" : "bg-zinc-600"}`}>
                  <div className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${locationOn ? "translate-x-5" : "translate-x-0"}`}></div>
                </div>
              </div>
            </div>

            <div
              className={`cursor-pointer rounded-2xl border p-4 backdrop-blur-md transition-all duration-300 ${
                notificationsOn ? "border-[#009E49]/50 bg-[#009E49]/10 shadow-[0_0_15px_rgba(0,158,73,0.15)]" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
              onClick={() => setNotificationsOn(!notificationsOn)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2.5 ${notificationsOn ? "bg-[#009E49] text-white" : "bg-white/10 text-zinc-400"}`}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Push Notifications</h3>
                    <p className="mt-0.5 max-w-40 text-[10px] text-zinc-400">Get instant alerts for order tracking and flash sales.</p>
                  </div>
                </div>
                <div className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors duration-300 ${notificationsOn ? "bg-[#009E49]" : "bg-zinc-600"}`}>
                  <div className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${notificationsOn ? "translate-x-5" : "translate-x-0"}`}></div>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : "Complete Setup"} <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="mt-4 text-center text-[10px] text-zinc-500">
            You can change these preferences later in your settings.
          </p>
        </div>
      </div>

      <div className="relative z-10 mb-8 hidden flex-col justify-end p-16 lg:flex xl:p-24">
        <div className="max-w-lg">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-lg xl:text-5xl">
            Powering Zambia&apos;s Online Marketplace.
          </h2>
          <p className="text-base font-medium text-zinc-200 drop-shadow-md xl:text-lg">
            Join thousands of sellers and buyers connecting every day on the fastest growing e-commerce platform in Lusaka.
          </p>
        </div>
      </div>
    </main>
  );
}
