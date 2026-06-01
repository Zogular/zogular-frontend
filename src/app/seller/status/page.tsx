"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileCheck2, ShieldAlert } from "lucide-react";
import { SellerTrustChecklist } from "@/components/seller/SellerTrustChecklist";
import { Button } from "@/components/ui/button";
import { SellerStatusNotice } from "@/components/seller/SellerStatusNotice";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { getCurrentUser } from "@/services/auth";
import type { AuthUser } from "@/types/auth";

export default function SellerStatusPage() {
  const { application, loading, error } = useSellerApplication();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setCurrentUser(user);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white/85 p-6 text-sm font-semibold text-zinc-500 shadow-sm">
        Loading seller status...
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50/90 p-6 shadow-sm">
        <h1 className="text-lg font-black text-red-900">Unable to load seller status</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-red-700">{error}</p>
      </div>
    );
  }

  if (!application) {
    return (
      <section className="rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-[#009E49]">
          <FileCheck2 className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-zinc-950">No seller application yet</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-zinc-600">
          Your account can access the seller area, but a seller application has not been started yet. Begin onboarding to create your draft application and unlock the correct seller trust flow.
        </p>
        <div className="mt-5">
          <Link href="/seller/onboarding?start=1">
            <Button className="h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]">
              Start seller onboarding
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SellerStatusNotice application={application} />
      <SellerTrustChecklist
        user={currentUser}
      />

      <section className="rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Seller Trust Snapshot</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-zinc-950">Application details on file</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <StatusField label="Seller type" value={application.sellerType === "REGISTERED_BUSINESS" ? "Registered business" : "Individual seller"} />
          <StatusField label="Current status" value={application.status} />
          <StatusField label="Store name" value={application.storeName || "Not added yet"} />
          <StatusField label="Business email" value={application.businessEmail || "Not added yet"} />
          <StatusField label="Submitted at" value={application.submittedAt ? new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(application.submittedAt)) : "Not submitted yet"} />
          <StatusField label="Reviewed at" value={application.reviewedAt ? new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(application.reviewedAt)) : "Not reviewed yet"} />
        </div>
      </section>
    </div>
  );
}

function StatusField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
