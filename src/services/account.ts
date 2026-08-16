import type {
  AccountOverview,
  AccountSettings,
  AccountUserProfile,
  NotificationPreferences,
} from "@/types/account";
import type { Address, AddressType } from "@/types/address";
import { changePassword, getCurrentUser, logout, updateMe } from "@/services/auth";
import { getMyOrders } from "@/services/orders";
import { apiClient } from "@/services/api";

const NOTIFICATION_PREFERENCES: NotificationPreferences = {
  orders: false,
  promos: false,
};

export async function getAccountOverview(): Promise<AccountOverview> {
  const [currentUser, orders, addresses] = await Promise.all([
    getCurrentUser({ persist: false }),
    getMyOrders(),
    getSavedAddresses(),
  ]);
  const recentOrders = orders.slice(0, 3);

  const defaultAddress = addresses.find(a => a.isDefault) || null;

  return {
    user: toAccountUser(currentUser),
    activeOrdersCount: orders.filter((order) => order.status === "processing" || order.status === "shipped").length,
    recentOrders,
    notifications: [],
    defaultAddress: defaultAddress,
    recentlyViewed: [],
  };
}

interface BackendAddressResponse {
  id: string;
  fullName: string;
  title: AddressType;
  addressLine: string;
  district?: string;
  city: string;
  phone: string;
  deliveryInstructions?: string | null;
  isDefault: boolean;
}

export async function getSavedAddresses(): Promise<Address[]> {
  const response = await apiClient<{ data: { addresses: BackendAddressResponse[] } }>("/user/addresses");
  return response.data.addresses.map((addr) => ({
    id: addr.id,
    name: addr.fullName,
    type: addr.title,
    street: addr.addressLine,
    area: addr.district || "",
    city: addr.city,
    phone: addr.phone,
    deliveryInstructions: addr.deliveryInstructions,
    isDefault: addr.isDefault,
  }));
}

export async function createAddress(address: Omit<Address, "id">): Promise<Address> {
  const response = await apiClient<{ data: { address: BackendAddressResponse } }>("/user/addresses", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({
      title: address.type,
      fullName: address.name,
      phone: address.phone,
      addressLine: address.street,
      district: address.area,
      city: address.city,
      deliveryInstructions: address.deliveryInstructions,
      isDefault: address.isDefault,
    }),
  });
  
  const addr = response.data.address;
  return {
    id: addr.id,
    name: addr.fullName,
    type: addr.title,
    street: addr.addressLine,
    area: addr.district || "",
    city: addr.city,
    phone: addr.phone,
    deliveryInstructions: addr.deliveryInstructions,
    isDefault: addr.isDefault,
  };
}

export async function updateAddress(address: Address): Promise<Address> {
  const response = await apiClient<{ data: { address: BackendAddressResponse } }>(`/user/addresses/${address.id}`, {
    method: "PATCH",
    csrf: true,
    body: JSON.stringify({
      title: address.type,
      fullName: address.name,
      phone: address.phone,
      addressLine: address.street,
      district: address.area,
      city: address.city,
      deliveryInstructions: address.deliveryInstructions,
      isDefault: address.isDefault,
    }),
  });
  
  const addr = response.data.address;
  return {
    id: addr.id,
    name: addr.fullName,
    type: addr.title,
    street: addr.addressLine,
    area: addr.district || "",
    city: addr.city,
    phone: addr.phone,
    deliveryInstructions: addr.deliveryInstructions,
    isDefault: addr.isDefault,
  };
}

export async function deleteAddress(id: string): Promise<void> {
  await apiClient(`/user/addresses/${id}`, { method: "DELETE", csrf: true });
}

export async function setDefaultAddress(id: string): Promise<void> {
  await apiClient(`/user/addresses/${id}/default`, { method: "PATCH", csrf: true });
}

function toAccountUser(currentUser: {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
}): AccountUserProfile {
  return {
    name: `${currentUser.firstName} ${currentUser.lastName ?? ""}`.trim() || currentUser.email,
    email: currentUser.email,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName ?? "",
    phone: currentUser.phone ?? "",
  };
}

export async function getAccountSettings(): Promise<AccountSettings> {
  const currentUser = await getCurrentUser({ persist: false });

  return {
    profile: {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      email: currentUser.email,
      phone: currentUser.phone ?? "",
      preferredMoMoNumber: currentUser.preferredMoMoNumber ?? "",
    },
    payments: [],
    notifications: NOTIFICATION_PREFERENCES,
  };
}

export async function saveAccountProfile(
  profile: AccountSettings["profile"],
  expectedUserId: string,
): Promise<AccountSettings["profile"]> {
  const updatedUser = await updateMe({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    preferredMoMoNumber: profile.preferredMoMoNumber,
  }, { expectedUserId });

  return {
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    email: updatedUser.email,
    phone: updatedUser.phone ?? "",
    preferredMoMoNumber: updatedUser.preferredMoMoNumber ?? "",
  };
}

export async function updateAccountPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true }> {
  await changePassword({
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });

  return { success: true };
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  return preferences;
}

export async function deletePaymentMethod(id: number): Promise<{ deletedId: number }> {
  return { deletedId: id };
}

export async function saveAddresses(addresses: Address[]): Promise<Address[]> {
  // Mock function no longer used directly, replaced by specific CRUD functions
  return addresses;
}

export async function signOutAccount(): Promise<{ success: true }> {
  await logout();
  return { success: true };
}
