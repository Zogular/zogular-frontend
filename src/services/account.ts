import type {
  AccountOverview,
  AccountSettings,
  AccountUserProfile,
  NotificationPreferences,
} from "@/types/account";
import type { Address } from "@/types/address";
import { getStoredAuthUser } from "@/services/auth-session";
import { changePassword, getCurrentUser, logout, updateMe } from "@/services/auth";
import { getMyOrders } from "@/services/orders";

const NOTIFICATION_PREFERENCES: NotificationPreferences = {
  orders: false,
  promos: false,
};

const EMPTY_ACCOUNT_USER: AccountUserProfile = {
  name: "Customer",
  email: "",
  firstName: "Customer",
  lastName: "",
  phone: "",
};

export async function getAccountOverview(): Promise<AccountOverview> {
  const [currentUser, recentOrders] = await Promise.all([
    getCurrentUser(),
    getMyOrders(),
  ]);

  return {
    user: toAccountUser(currentUser),
    activeOrdersCount: recentOrders.filter((order) => order.status === "processing" || order.status === "shipped").length,
    recentOrders: recentOrders.slice(0, 3),
    notifications: [],
    defaultAddress: null,
    recentlyViewed: [],
  };
}

export async function getSavedAddresses(): Promise<Address[]> {
  return [];
}

export function getAccountUserProfile(): AccountUserProfile {
  const currentUser = getStoredAuthUser();

  if (!currentUser) return EMPTY_ACCOUNT_USER;

  return toAccountUser(currentUser);
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
  const currentUser = await getCurrentUser();

  return {
    profile: {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      email: currentUser.email,
      phone: currentUser.phone ?? "",
    },
    payments: [],
    notifications: NOTIFICATION_PREFERENCES,
  };
}

export async function saveAccountProfile(
  profile: AccountSettings["profile"],
): Promise<AccountSettings["profile"]> {
  const updatedUser = await updateMe({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  });

  return {
    ...profile,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    email: updatedUser.email,
    phone: updatedUser.phone ?? profile.phone,
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
  return addresses;
}

export async function signOutAccount(): Promise<{ success: true }> {
  await logout();
  return { success: true };
}
