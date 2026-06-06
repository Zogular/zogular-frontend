"use client";

import { useState, useEffect } from "react";
import { SellerStatusNotice } from "@/components/seller/SellerStatusNotice";
import type { VendorApplication } from "@/types/seller";
import { TrustPassport } from "../components/TrustPassport";
import { GrowthChecklist } from "../components/GrowthChecklist";
import { HubQuickActions } from "../components/HubQuickActions";
import { apiClient } from "@/services/api";
import { hasSellerCapability } from "@/services/vendor-application";

export function SellerOperatingHub({ application }: { application: VendorApplication }) {
  const [hasProducts, setHasProducts] = useState(false);
  const canCreateDraft = hasSellerCapability(application.status, "canCreateDraftProduct");

  useEffect(() => {
    async function checkProducts() {
      if (!canCreateDraft) return;
      try {
        const response = await apiClient<{ data: unknown[] }>("/vendor/products");
        if (response.data && response.data.length > 0) {
          setHasProducts(true);
        }
      } catch {
        // Ignore errors for this quick check
      }
    }
    checkProducts();
  }, [canCreateDraft]);

  return (
    <div className="mx-auto max-w-4xl animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Welcome & Notice */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">
            Welcome, {application.storeName || application.legalBusinessName || "Seller"}
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Manage your store operations and track your growth.
          </p>
        </div>
        
        {application.status !== "APPROVED" && (
          <SellerStatusNotice application={application} />
        )}
      </div>

      {/* Quick Actions */}
      <HubQuickActions application={application} />

      {/* Two-Column Setup for Growth & Trust */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <GrowthChecklist application={application} hasProducts={hasProducts} />
        <TrustPassport application={application} />
      </div>
      
    </div>
  );
}
