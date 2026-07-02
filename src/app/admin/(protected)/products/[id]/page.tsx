"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminProductModerationView } from "./_components/AdminProductModerationView";
import { adminProductsApi } from "@/services/admin/products";
import { recordAdminAudit } from "@/services/admin/audit";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import type { SellerProductListing } from "@/services/seller-catalog";
import type { ProductModerationAction } from "@/services/product-moderation";

export default function AdminProductModerationPage() {
  const params = useParams<{ id: string }>();
  const productId = decodeURIComponent(params.id);
  const [product, setProduct] = useState<SellerProductListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [moderationNote, setModerationNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const identity = useAdminIdentity()!;
  const canModerate = adminIdentityHasPermission(identity, "moderate_products");

  useEffect(() => {
    let mounted = true;
    adminProductsApi.fetchProductById(productId)
      .then((item) => {
        if (mounted) {
          setProduct(item);
          setModerationNote(item.moderation?.moderationNotes ?? "");
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Product not found."))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [productId]);

  async function handleModerationAction(action: ProductModerationAction, note: string) {
    if (!product) return;
    if (!canModerate) {
      toast.error("Unauthorized.");
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedRecord = await adminProductsApi.reviewProduct(product.id, {
        action,
        note,
      });
      await recordAdminAudit({
        actorId: identity.id,
        action: `product_${action}`,
        target: product.id,
        severity: action === "approve" ? "info" : "warning",
        note,
      });

      // The backend reviewProduct returns an AdminProductRecord, but we need SellerProductListing
      // For now, we update the local product state with the returned status and notes
      setProduct((current) => current ? {
        ...current,
        status: updatedRecord.status,
        moderation: {
          ...current.moderation,
          moderationNotes: updatedRecord.moderationNotes ?? undefined,
        }
      } : null);

      toast.success(
        action === "approve"
          ? "Product approved."
          : action === "reject"
            ? "Product rejected."
            : "Changes requested from seller.",
      );
      if (updatedRecord.moderationNotes) {
        setModerationNote(updatedRecord.moderationNotes);
      }
    } catch {
      toast.error("Failed to update moderation status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) return <div className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm font-bold text-zinc-500">Loading product...</div>;

  if (!product) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-red-50 p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-red-500" />
        <h1 className="text-xl font-black text-red-900">Product not found</h1>
        <Link href="/admin/products">
          <Button className="mt-5 h-11 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700">Back to Moderation Queue</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminProductModerationView
        product={product}
        moderationNote={moderationNote}
        onModerationNoteChange={setModerationNote}
        onSubmit={handleModerationAction}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
