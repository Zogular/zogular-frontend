import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { getSellerSafeErrorMessage } from "../src/lib/seller-error";
import { ApiError } from "../src/services/api";

function readSource(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), "utf8");
}

const sellerLayoutSource = readSource("src/app/seller/layout.tsx");
const sellerSettingsPageSource = readSource("src/app/seller/settings/page.tsx");
const sellerSettingsHookSource = readSource("src/features/seller-settings/hooks/useSellerSettings.ts");
const sellerSupportPageSource = readSource("src/app/seller/support/page.tsx");
const contactSupportModalSource = readSource("src/app/seller/ContactSupportModal.tsx");
const sellerNotificationsSource = readSource("src/app/seller/notifications/page.tsx");
const supportServiceSource = readSource("src/services/support.ts");
const accountServiceSource = readSource("src/services/account.ts");
const settingsServiceSource = readSource("src/services/settings.ts");

test("seller error mapper returns safe seller-facing copy for status, network, timeout, and malformed failures", () => {
  expect(getSellerSafeErrorMessage(new ApiError("SELECT * FROM users", 401), "workspace")).toBe("Please sign in again to continue.");
  expect(getSellerSafeErrorMessage(new ApiError("Forbidden internal policy", 403), "support-create")).toBe("You do not have access to this seller action.");
  expect(getSellerSafeErrorMessage(new ApiError("VendorApplication missing", 404), "support-detail")).toBe("We could not find that seller record. Refresh and try again.");
  expect(getSellerSafeErrorMessage(new ApiError("Optimistic lock failed", 409), "support-resolve")).toBe("This changed before we could update this ticket. Refresh and try again.");
  expect(getSellerSafeErrorMessage(new ApiError("Validation stack", 422), "support-create")).toBe("Check the details and try again.");
  expect(getSellerSafeErrorMessage(new ApiError("RateLimitExceeded", 429), "support-reply")).toBe("Too many attempts. Wait a moment, then try again.");
  expect(getSellerSafeErrorMessage(new ApiError("AbortError", 408), "settings")).toBe("The request took too long. Check your connection and try again.");
  expect(getSellerSafeErrorMessage(new ApiError("Prisma panic", 500), "support-list")).toBe("Zogular could not load support tickets right now. Try again shortly.");
  expect(getSellerSafeErrorMessage(new Error("Missing required string field: ticket.id"), "support-list")).toBe("Zogular could not load support tickets right now. Try again.");
});

test("seller layout, settings, support, modal, and notifications do not render raw/internal error strings", () => {
  const sellerErrorSurfaces = [
    sellerLayoutSource,
    sellerSettingsPageSource,
    sellerSettingsHookSource,
    sellerSupportPageSource,
    contactSupportModalSource,
    sellerNotificationsSource,
  ].join("\n");

  expect(sellerErrorSurfaces).toContain("getSellerSafeErrorMessage");
  expect(sellerErrorSurfaces).not.toContain("System Error");
  expect(sellerErrorSurfaces).not.toContain("An unknown error occurred");
  expect(sellerSupportPageSource).not.toContain("err instanceof Error ? err.message");
  expect(contactSupportModalSource).not.toContain("submitError instanceof Error");
  expect(sellerSettingsHookSource).not.toContain("err instanceof Error ? err.message");
  expect(sellerLayoutSource).not.toContain("error instanceof Error ? error.message");
});

test("support service preserves typed failure without exposing parser field names to seller UI", () => {
  expect(supportServiceSource).toContain('throw new ApiError("Support response was not recognized.", 502');
  expect(supportServiceSource).not.toContain("Missing required string field");
  expect(supportServiceSource).not.toContain("Invalid payload: expected an array of tickets");
  expect(supportServiceSource).not.toContain("Invalid ticket status");
});

test("latent fake account success exports are removed and seller settings remain read-only", () => {
  for (const removed of [
    "saveNotificationPreferences",
    "deletePaymentMethod",
    "saveAddresses",
    "return preferences",
    "return { deletedId",
  ]) {
    expect(accountServiceSource).not.toContain(removed);
  }

  expect(settingsServiceSource).toContain('throwBackendPendingFeature("Seller settings persistence")');
  expect(sellerSettingsPageSource).toContain("Editing and publishing changes are not available yet.");
  expect(sellerSettingsPageSource).toContain("Save unavailable");
});

test("seller notifications expose navigation only and no fake read or clear affordances", () => {
  for (const removed of [
    "handleMarkAsRead",
    "handleMarkAllAsRead",
    "handleClearAll",
    "markAsRead",
    "markAllAsRead",
    "clearAll",
    "Mark all read",
    "Clear all notifications",
    "cn(!notification.isRead && \"cursor-pointer\")",
  ]) {
    expect(sellerNotificationsSource).not.toContain(removed);
  }

  expect(sellerNotificationsSource).toContain("Notifications are not available yet");
  expect(sellerNotificationsSource).toContain('href="/seller/support"');
  expect(sellerNotificationsSource).toContain('href="/seller/orders"');
  expect(sellerNotificationsSource).not.toContain("onClick={() => handleMarkAsRead");
});
