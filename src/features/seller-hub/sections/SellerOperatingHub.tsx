"use client";

import { useState, useEffect } from "react";
import { SellerStatusNotice } from "@/components/seller/SellerStatusNotice";
import type { VendorApplication } from "@/types/seller";
import { TrustPassport } from "../components/TrustPassport";
import { GrowthChecklist } from "../components/GrowthChecklist";
import { HubQuickActions } from "../components/HubQuickActions";
import { hasSellerCapability } from "@/services/vendor-application";
import { fetchSellerCatalogProducts } from "@/services/seller-catalog";

export function SellerOperatingHub({ application }: { application: VendorApplication }) {
  const [productProbe, setProductProbe] = useState<"loading" | "has-products" | "empty" | "unavailable">("loading");
  const canCreateDraft = hasSellerCapability(application.status, "canCreateDraftProduct");
  let introCopy = "Complete your seller application to unlock the marketplace hub.";
  if (application.status === "APPROVED") {
    introCopy = "Manage products and orders from here. In-app support is available, while payouts still depend on backend ledger services.";
  } else if (application.status === "PROVISIONAL") {
    introCopy = "Create draft products and prepare your storefront. Product submission, orders, payouts, and live selling remain blocked until full approval.";
  } else if (application.status === "SUBMITTED" || application.status === "NEEDS_INFO") {
    introCopy = "Your application is currently under review or needs information. Full seller tools remain locked.";
  } else if (application.status === "RESTRICTED" || application.status === "SUSPENDED" || application.status === "REJECTED") {
    introCopy = "Your selling capabilities are currently restricted or blocked. Check your status for details.";
  }

  useEffect(() => {
    async function checkProducts() {
      if (!canCreateDraft) return;
      try {
        const products = await fetchSellerCatalogProducts();
        setProductProbe(products.length > 0 ? "has-products" : "empty");
      } catch {
        setProductProbe("unavailable");
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
            {introCopy}
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
        <GrowthChecklist application={application} productProbe={productProbe} />
        <TrustPassport application={application} />
      </div>
      
    </div>
  );
}
