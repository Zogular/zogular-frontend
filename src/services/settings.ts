// src/services/settings.ts

import { apiClient } from "@/services/api";
import { throwBackendPendingFeature } from "@/services/backend-pending";

export interface StoreProfile {
  name: string;
  slug: string;
  logo: string | null;
  banner: string | null;
  description: string;
  category: string;
}

export interface BusinessInfo {
  ownerName: string;
  phone: string;
  supportEmail: string;
  address: string;
  city: string;
  country: string;
  taxNumber: string;
}

export interface FulfillmentSettings {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number | null;
  processingTimeDays: number;
}

export interface OperationalSettings {
  storefrontVisible: boolean;
  vacationMode: boolean;
  autoAcceptOrders: boolean;
  inventoryTracking: boolean;
  lowStockAlerts: boolean;
  autoReplyMessage: string;
  returnPolicy: string;
}

export interface SeoSettings {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
}

export interface StoreSettings {
  profile: StoreProfile;
  business: BusinessInfo;
  fulfillment: FulfillmentSettings;
  operations: OperationalSettings;
  seo: SeoSettings;
}

export const SELLER_SETTINGS_BACKEND_PENDING_NOTICE =
  "Read is connected to the backend, but saving profile updates is pending backend persistence implementation.";


function asString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function asBoolean(val: unknown): boolean {
  return typeof val === "boolean" ? val : false;
}

function asNumber(val: unknown): number {
  return typeof val === "number" ? val : 0;
}

function asNullableString(val: unknown): string | null {
  const str = asString(val).trim();
  return str.length > 0 ? str : null;
}

function asNullableNumber(val: unknown): number | null {
  return typeof val === "number" ? val : null;
}

function asRecord(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
}

function normalizeStoreSettings(payload: unknown): StoreSettings {
  const root = asRecord(payload);
  const data = root?.data ? asRecord(root?.data) : root;
  const settings = data?.settings ? asRecord(data.settings) : data;
  
  const profile = asRecord(settings?.profile);
  const business = asRecord(settings?.business);
  const fulfillment = asRecord(settings?.fulfillment);
  const operations = asRecord(settings?.operations);
  const seo = asRecord(settings?.seo);

  return {
    profile: {
      name: asString(profile?.name),
      slug: asString(profile?.slug),
      logo: asNullableString(profile?.logo),
      banner: asNullableString(profile?.banner),
      description: asString(profile?.description),
      category: asString(profile?.category),
    },
    business: {
      ownerName: asString(business?.ownerName),
      phone: asString(business?.phone),
      supportEmail: asString(business?.supportEmail),
      address: asString(business?.address),
      city: asString(business?.city),
      country: asString(business?.country) || "Zambia",
      taxNumber: asString(business?.taxNumber),
    },
    fulfillment: {
      deliveryEnabled: asBoolean(fulfillment?.deliveryEnabled),
      pickupEnabled: asBoolean(fulfillment?.pickupEnabled),
      defaultDeliveryFee: asNumber(fulfillment?.defaultDeliveryFee),
      freeDeliveryThreshold: asNullableNumber(fulfillment?.freeDeliveryThreshold),
      processingTimeDays: asNumber(fulfillment?.processingTimeDays),
    },
    operations: {
      storefrontVisible: asBoolean(operations?.storefrontVisible),
      vacationMode: asBoolean(operations?.vacationMode),
      autoAcceptOrders: asBoolean(operations?.autoAcceptOrders),
      inventoryTracking: asBoolean(operations?.inventoryTracking),
      lowStockAlerts: asBoolean(operations?.lowStockAlerts),
      autoReplyMessage: asString(operations?.autoReplyMessage),
      returnPolicy: asString(operations?.returnPolicy),
    },
    seo: {
      metaTitle: asString(seo?.metaTitle),
      metaDescription: asString(seo?.metaDescription),
      keywords: asString(seo?.keywords),
    }
  };
}

export const settingsApi = {
  async fetchSettings(): Promise<StoreSettings> {
    const payload = await apiClient<unknown>("/vendor/settings/me", { method: "GET" });
    return normalizeStoreSettings(payload);
  },
  async updateSettings(payload: StoreSettings): Promise<StoreSettings> {
    void payload;
    throwBackendPendingFeature("Seller settings persistence");
  },
};
