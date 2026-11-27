import { z } from "zod";
import { apiClient } from "@/services/api";
import { throwBackendPendingFeature } from "@/services/backend-pending";

// The settings read model is server-owned. Empty media strings are valid wire values.
const media = z.string().nullable().transform(value => value?.trim() || null);
const settingsSchema = z.object({
  profile: z.object({
    name: z.string(), slug: z.string(), logo: media, banner: media,
    description: z.string(), category: z.string(),
  }),
  business: z.object({
    ownerName: z.string(), phone: z.string(), supportEmail: z.string(), address: z.string(),
    city: z.string(), country: z.string(), taxNumber: z.string(),
  }),
  fulfillment: z.object({
    deliveryEnabled: z.boolean(), pickupEnabled: z.boolean(), defaultDeliveryFee: z.number().nonnegative(),
    freeDeliveryThreshold: z.number().nonnegative().nullable(), processingTimeDays: z.number().int().nonnegative(),
  }),
  operations: z.object({
    storefrontVisible: z.boolean(), vacationMode: z.boolean(), autoAcceptOrders: z.boolean(),
    inventoryTracking: z.boolean(), lowStockAlerts: z.boolean(), autoReplyMessage: z.string(),
    returnPolicy: z.string(),
  }),
  seo: z.object({ metaTitle: z.string(), metaDescription: z.string(), keywords: z.string() }),
});

const settingsEnvelope = z.object({
  status: z.literal("success"),
  data: z.object({ settings: settingsSchema }),
});

export type StoreSettings = z.infer<typeof settingsSchema>;
export type StoreProfile = StoreSettings["profile"];
export type BusinessInfo = StoreSettings["business"];
export type FulfillmentSettings = StoreSettings["fulfillment"];
export type OperationalSettings = StoreSettings["operations"];
export type SeoSettings = StoreSettings["seo"];

export const SELLER_SETTINGS_BACKEND_PENDING_NOTICE =
  "You can review your current store information, but editing and saving changes are not available yet.";

export const settingsApi = {
  async fetchSettings(): Promise<StoreSettings> {
    const payload = await apiClient<unknown>("/vendor/settings/me", { method: "GET" });
    const result = settingsEnvelope.safeParse(payload);
    if (!result.success) throw new Error("Seller settings could not be loaded.");
    return result.data.data.settings;
  },
  async updateSettings(payload: StoreSettings): Promise<StoreSettings> {
    void payload;
    throwBackendPendingFeature("Seller settings persistence");
  },
};
