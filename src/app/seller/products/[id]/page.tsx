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
  updateSellerProductStatus,
  type SellerProductListing,
  type SellerProductStatus,
} from "@/services/seller-catalog";
import { SellerProductPreview } from "./_components/SellerProductPreview";

export default function SellerProductPreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = decodeURIComponent(params.id);
  const [product, setProduct] = useState<SellerProductListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [productId]);

  const updateStatus = useCallback(async (status: SellerProductStatus, message: string) => {
    if (!product) return;
    try {
      const updated = await updateSellerProductStatus(product.id, status);
      setProduct(updated);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update product.");
    }
  }, [product]);

  const duplicateProduct = useCallback(async () => {
    if (!product) return;
    try {
      const duplicate = await duplicateSellerProduct(product.id);
      toast.success("Duplicated as draft.");
      router.push(`/seller/products/${duplicate.id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate product.");
    }
  }, [product, router]);

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
      onEdit={() => router.push(`/seller/products/${product.id}/edit`)}
      onSubmit={() => updateStatus("pending_review", "Product submitted for review.")}
      onUnpublish={() => updateStatus("draft", "Product unpublished and moved to drafts.")}
      onWithdraw={() => updateStatus("draft", "Review withdrawn. Product moved back to drafts.")}
    />
  );
}
