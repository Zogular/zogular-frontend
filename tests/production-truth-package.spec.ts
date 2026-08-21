import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  getPublicProductStatusResolution,
  ProductListContractError,
  type BackendProduct,
} from "../src/services/products";

const repoRoot = path.resolve(__dirname, "..");

function readSource(filePath: string): string {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

const productCardSource = readSource("src/components/productCard.tsx");
const productsServiceSource = readSource("src/services/products.ts");
const sellerNotificationsSource = readSource("src/app/seller/notifications/page.tsx");
const sellerPayoutsSource = readSource("src/app/seller/payouts/page.tsx");
const sellerWalletServiceSource = readSource("src/services/seller-wallet.ts");
const sellerSettingsSource = readSource("src/app/seller/settings/page.tsx");
const sellerSettingsHookSource = readSource("src/features/seller-settings/hooks/useSellerSettings.ts");
const storeProfileFormSource = readSource("src/features/seller-settings/components/StoreProfileForm.tsx");
const sellerSupportSource = readSource("src/app/seller/support/page.tsx");

function productWithStatus(status: unknown, field: "status" | "moderationStatus" | "sellerVisibility" = "status"): BackendProduct {
  return {
    id: "product-1",
    slug: "phone-case",
    title: "Phone Case",
    price: 120,
    stock: 3,
    images: [],
    [field]: status,
  };
}

test("public product status shield allows absent and approved public statuses", () => {
  expect(getPublicProductStatusResolution(productWithStatus(undefined))).toBe("public");
  expect(getPublicProductStatusResolution(productWithStatus("APPROVED"))).toBe("public");
  expect(getPublicProductStatusResolution(productWithStatus("published"))).toBe("public");
  expect(getPublicProductStatusResolution(productWithStatus(" approved "))).toBe("public");
  expect(getPublicProductStatusResolution(productWithStatus("visible", "sellerVisibility"))).toBe("public");
});

test("public product status shield excludes known non-public statuses before normalization", () => {
  for (const status of [
    "DRAFT",
    "PENDING",
    "PENDING_REVIEW",
    "pending review",
    "pending-review",
    "NEEDS_CHANGES",
    "needs changes",
    "REJECTED",
    "PAUSED",
    "SUSPENDED",
    "HIDDEN",
    "hidden",
  ]) {
    expect(getPublicProductStatusResolution(productWithStatus(status)), status).toBe("non-public");
  }

  expect(getPublicProductStatusResolution(productWithStatus("pending review", "moderationStatus"))).toBe("non-public");
  expect(getPublicProductStatusResolution(productWithStatus("hidden", "sellerVisibility"))).toBe("non-public");
  expect(productsServiceSource).toContain("normalizePublicBackendProduct");
  expect(productsServiceSource).toContain("normalizePublicBackendProductDetail");
});

test("public product status shield rejects malformed status values as typed contract errors", () => {
  for (const status of ["", "   ", "ARCHIVED", ["APPROVED"], { status: "APPROVED" }, 123, null]) {
    expect(() => getPublicProductStatusResolution(productWithStatus(status))).toThrow(ProductListContractError);
  }
});

test("related-product boundary does not swallow malformed public product status", () => {
  const relatedBoundary = productsServiceSource.slice(
    productsServiceSource.indexOf("async function fetchBackendRelatedProducts"),
    productsServiceSource.indexOf("async function fetchBackendProductCollection"),
  );

  expect(relatedBoundary).toContain(".map(normalizePublicBackendProduct)");
  expect(relatedBoundary).toContain("catch (error)");
  expect(relatedBoundary).toContain("if (error instanceof ProductListContractError) throw error;");
  expect(relatedBoundary).not.toContain("} catch {\n    return null;");
});

test("public ProductCard exposes only buyer-safe availability badges", () => {
  expect(productCardSource).toContain("Out of Stock");
  expect(productCardSource).not.toContain("Pending");
  expect(productCardSource).not.toContain("Rejected");
  expect(productCardSource).not.toContain("Hidden");
  expect(productCardSource).not.toContain("Product unavailable");
  expect(productCardSource).not.toContain("sellerVisibility ===");
  expect(productCardSource).not.toContain("moderationStatus ===");
});

test("seller pending surfaces do not expose fake notification or payout capabilities", () => {
  for (const removed of [
    "fetchAll",
    "markAsRead",
    "markAllAsRead",
    "clearAll",
    "all caught up",
    "real-time",
    "Stay on top",
    "unread",
  ]) {
    expect(sellerNotificationsSource).not.toContain(removed);
  }

  expect(sellerNotificationsSource).toContain("Notifications are not available yet");
  expect(sellerPayoutsSource).not.toContain("sellerWalletApi");
  expect(sellerPayoutsSource).not.toContain("fetchDashboard");
  expect(sellerPayoutsSource).not.toContain("useEffect");
  expect(sellerPayoutsSource).not.toContain("useState");
  expect(sellerPayoutsSource).toContain("Payouts are not available yet");
  expect(sellerWalletServiceSource).toContain('throwBackendPendingFeature("Seller payout dashboard")');
  expect(sellerWalletServiceSource).not.toContain("await delay");
  expect(sellerWalletServiceSource).not.toContain("pendingBalance: 0");
});

test("seller settings are read-only without local upload previews or fake persistence", () => {
  expect(sellerSettingsSource).toContain("Save unavailable");
  expect(sellerSettingsHookSource).not.toContain("URL.createObjectURL");
  expect(sellerSettingsHookSource).not.toContain("setSettings((prev)");
  expect(storeProfileFormSource).not.toContain('type="file"');
  expect(storeProfileFormSource).not.toContain("Upload Logo");
  expect(storeProfileFormSource).not.toContain("Upload Banner");
  expect(storeProfileFormSource).not.toContain("handleAssetUpload");
  expect(storeProfileFormSource).not.toContain("role=\"button\"");
});

test("seller support ticket rows use semantic buttons for selection", () => {
  expect(sellerSupportSource).toContain("<button");
  expect(sellerSupportSource).toContain('type="button"');
  expect(sellerSupportSource).toContain("aria-pressed={isSelected}");
  expect(sellerSupportSource).not.toContain("cursor-pointer rounded-2xl border p-4");
});
