// src/services/settings.ts

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
  freeDeliveryThreshold: number;
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
  "Seller settings are shown as preview and readiness fields until backend persistence for store settings is implemented.";

const EMPTY_SETTINGS: StoreSettings = {
  profile: {
    name: "",
    slug: "",
    logo: null,
    banner: null,
    description: "",
    category: "",
  },
  business: {
    ownerName: "",
    phone: "",
    supportEmail: "",
    address: "",
    city: "",
    country: "Zambia",
    taxNumber: "",
  },
  fulfillment: {
    deliveryEnabled: false,
    pickupEnabled: false,
    defaultDeliveryFee: 0,
    freeDeliveryThreshold: 0,
    processingTimeDays: 0,
  },
  operations: {
    storefrontVisible: false,
    vacationMode: false,
    autoAcceptOrders: false,
    inventoryTracking: false,
    lowStockAlerts: false,
    autoReplyMessage: "",
    returnPolicy: "",
  },
  seo: {
    metaTitle: "",
    metaDescription: "",
    keywords: "",
  }
};

export const settingsApi = {
  async fetchSettings(): Promise<StoreSettings> {
    return structuredClone(EMPTY_SETTINGS);
  },
  async updateSettings(payload: StoreSettings): Promise<StoreSettings> {
    void payload;
    throwBackendPendingFeature("Seller settings persistence");
  },
};
