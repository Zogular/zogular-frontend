"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  duplicateSellerProduct,
  fetchSellerCatalogProductById,
  submitSellerProductForReview,
  unpublishSellerProduct,
  withdrawSellerProductReview,
  type SellerProductListing,
} from "@/services/seller-catalog";
import { SellerProductPreview } from "./_components/SellerProductPreview";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { hasSellerCapability } from "@/services/vendor-application";

export default function SellerProductPreviewPage() {
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

  const handleSubmit = useCallback(async (message: string) => {
    if (!product) return;
    if (!canSubmitProductForReview) {
      router.push("/seller/status");
      toast.error("Seller approval is required before submitting products for review.");
      return;
    }
    try {
      const updated = await submitSellerProductForReview(product.id);
      setProduct(updated);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update product.");
    }
  }, [canSubmitProductForReview, product, router]);

  const handleWithdraw = useCallback(async (message: string) => {
    if (!product) return;
    if (!canCreateDraftProduct) {
      router.push("/seller/status");
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      const updated = await withdrawSellerProductReview(product.id);
      setProduct(updated);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update product.");
    }
  }, [canCreateDraftProduct, product, router]);

  const handleUnpublish = useCallback(async (message: string) => {
    if (!product) return;
    if (!canCreateDraftProduct) {
      router.push("/seller/status");
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      const updated = await unpublishSellerProduct(product.id);
      setProduct(updated);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update product.");
    }
  }, [canCreateDraftProduct, product, router]);

  const duplicateProduct = useCallback(async () => {
    if (!product) return;
    if (!canCreateDraftProduct) {
      router.push("/seller/status");
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      const duplicate = await duplicateSellerProduct(product.id);
      toast.success("Duplicated as draft.");
      router.push(`/seller/products/${duplicate.id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate product.");
    }
  }, [canCreateDraftProduct, product, router]);

  if (!application || !canCreateDraftProduct) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-amber-600" />
        <h1 className="text-xl font-black text-amber-950">Seller approval is required before viewing seller product previews</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
          Product draft surfaces open only for provisional and approved sellers.
        </p>
        <div className="mt-5">
          <Button type="button" onClick={() => router.push(!application || sellerStatus === "DRAFT" || sellerStatus === "NEEDS_INFO" ? "/seller/onboarding" : "/seller/status")} className="h-11 rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]">
            {!application || sellerStatus === "DRAFT" || sellerStatus === "NEEDS_INFO" ? "Continue seller application" : "View seller status"}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm font-bold text-zinc-500">Loading product...</div>;

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

  return (
    <SellerProductPreview
      product={product}
      onDuplicate={duplicateProduct}
      onEdit={() => {
        if (!canCreateDraftProduct) {
          router.push("/seller/status");
          toast.error("Seller approval is required before editing products.");
          return;
        }
        router.push(`/seller/products/${product.id}/edit`);
      }}
      onSubmit={() => handleSubmit("Product submitted for review.")}
      onUnpublish={() => handleUnpublish("Product unpublished and moved to paused.")}
      onWithdraw={() => handleWithdraw("Review withdrawn. Product moved back to drafts.")}
    />
  );
}
