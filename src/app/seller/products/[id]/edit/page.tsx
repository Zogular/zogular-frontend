"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  fetchSellerCatalogProductById,
  updateSellerCatalogProduct,
  withdrawSellerProductReview,
  type CreateSellerProductInput,
  type SellerProductListing,
} from "@/services/seller-catalog";
import { ProductListingStudioForm } from "../../new/_components/ProductListingStudioForm";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { hasSellerCapability } from "@/services/vendor-application";

export default function EditSellerProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { application } = useSellerApplication();
  const productId = decodeURIComponent(params.id);
  const [product, setProduct] = useState<SellerProductListing | null>(null);
  const [loading, setLoading] = useState(true);

  const sellerStatus = application?.status ?? null;
  const canCreateDraftProduct = hasSellerCapability(sellerStatus, "canCreateDraftProduct");
  const canSubmitProductForReview = hasSellerCapability(sellerStatus, "canSubmitProductForReview");

  useEffect(() => {
    if (!application || !canCreateDraftProduct) return;
    let mounted = true;
    fetchSellerCatalogProductById(productId)
      .then((item) => {
        if (mounted) setProduct(item);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Product not found."))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [application, canCreateDraftProduct, productId]);

  if (!application || !canCreateDraftProduct) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-amber-600" />
        <h1 className="text-xl font-black text-amber-950">Seller approval is required before editing products</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
          Complete seller onboarding or wait for provisional approval before mutating seller products.
        </p>
        <div className="mt-5">
          <Button type="button" onClick={() => router.push(!application || sellerStatus === "DRAFT" || sellerStatus === "NEEDS_INFO" ? "/seller/onboarding" : "/seller/status")} className="h-11 rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]">
            {!application || sellerStatus === "DRAFT" || sellerStatus === "NEEDS_INFO" ? "Continue seller application" : "View seller status"}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm font-bold text-zinc-500">Loading editor...</div>;

  if (!product) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-500" />
        <h1 className="text-lg font-black text-red-900">Product not found</h1>
        <Link href="/seller/products">
          <Button className="mt-4 rounded-xl">Back to Products</Button>
        </Link>
      </div>
    );
  }

  if (product.status === "pending_review") {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-amber-600" />
        <h1 className="text-xl font-black text-amber-950">Withdraw review before editing</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">Pending review products are locked so admin reviews the exact submitted version.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => router.push(`/seller/products/${product.id}`)} className="h-11 rounded-xl bg-white/70 font-bold">
            View Submission
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const updated = await withdrawSellerProductReview(product.id);
              setProduct(updated);
              toast.success("Review withdrawn. You can edit now.");
            }}
            className="h-11 rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]"
          >
            Withdraw Review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProductListingStudioForm
      backHref={`/seller/products/${product.id}`}
      initialProduct={product}
      mode="edit"
      canSubmitForReview={canSubmitProductForReview}
      submitLabel={canSubmitProductForReview ? "Submit for Review" : "Seller Approval Required"}
      onPersist={async (payload: CreateSellerProductInput) => {
        const updated = await updateSellerCatalogProduct(product.id, payload);
        setProduct(updated);
      }}
    />
  );
}
