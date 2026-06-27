import type { Address } from "@/types/address";
import type { OrderSummary } from "@/types/order";
import type { Product } from "@/types/product";

export interface AccountNotification {
  id: number;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

export interface AccountUserProfile {
  name: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
}

export interface AccountOverview {
  user: AccountUserProfile;
  activeOrdersCount: number;
  recentOrders: OrderSummary[];
  notifications: AccountNotification[];
  defaultAddress: Address | null;
  recentlyViewed: Product[];
}

export interface PaymentMethod {
  id: number;
  type: "Mobile Money" | "Bank Card";
  provider: string;
  account: string;
  isDefault: boolean;
}

export interface NotificationPreferences {
  orders: boolean;
  promos: boolean;
}

export interface AccountSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    preferredMoMoNumber?: string;
  };
  payments: PaymentMethod[];
  notifications: NotificationPreferences;
}
