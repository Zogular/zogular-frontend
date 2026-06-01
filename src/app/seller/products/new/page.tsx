"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { ProductListingStudioForm } from "./_components/ProductListingStudioForm";
import { hasSellerCapability } from "@/services/vendor-application";

export default function AddProductPage() {
  const { application } = useSellerApplication();
  const status = application?.status ?? null;
  const canCreateDraftProduct = hasSellerCapability(status, "canCreateDraftProduct");
  const canSubmitProductForReview = hasSellerCapability(status, "canSubmitProductForReview");

  if (!application || !canCreateDraftProduct) {
    return (
      <LockedSellerProductState
        title="Seller approval is not ready for product creation."
        description="Complete seller onboarding or wait for provisional approval before creating draft products. Product review submission opens only after APPROVED seller status."
        href={!application || status === "DRAFT" || status === "NEEDS_INFO" ? "/seller/onboarding" : "/seller/status"}
        ctaLabel={!application || status === "DRAFT" || status === "NEEDS_INFO" ? "Continue seller application" : "View seller status"}
      />
    );
  }

  return (
    <ProductListingStudioForm
      mode="create"
      canSubmitForReview={canSubmitProductForReview}
      submitLabel={canSubmitProductForReview ? "Submit for Review" : "Seller Approval Required"}
    />
  );
}

function LockedSellerProductState({
  title,
  description,
  href,
  ctaLabel,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-amber-200 bg-amber-50/90 p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
      <h1 className="mt-4 text-2xl font-black tracking-tight text-amber-950">{title}</h1>
      <p className="mt-3 text-sm font-medium leading-6 text-amber-800">{description}</p>
      <div className="mt-5">
        <Link href={href}>
          <Button className="h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]">
            {ctaLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}
