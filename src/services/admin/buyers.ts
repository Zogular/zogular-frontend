import { apiClient } from "@/services/api";

export interface AdminBuyerRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  telephone?: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified?: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  segment?: string;
}

export interface CustomerRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  grandTotalAmount: number;
  totalAmount: number;
  createdAt: string;
}

export interface CustomerSavedAddress {
  id: string;
  title: string;
  fullName?: string;
  phone?: string;
  addressLine?: string;
  city: string;
  district?: string | null;
  isDefault: boolean;
}

export interface CustomerSupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface CustomerProductReview {
  id: string;
  rating: number;
  comment?: string | null;
  isVerified: boolean;
  status: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
  };
}

export interface CustomerReviewSummary {
  count: number;
  avgRating: number | null;
}

export interface CustomerLinkedContext {
  orderCount: number;
  totalSpend: number;
  recentOrders: CustomerRecentOrder[];
  addresses: CustomerSavedAddress[];
  segment?: "VIP" | "ACTIVE_SHOPPER" | "NEW_CUSTOMER" | string;
  supportTickets?: CustomerSupportTicket[];
  reviews?: CustomerProductReview[];
  reviewSummary?: CustomerReviewSummary;
}

export interface BuyersPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface BackendUsersResponse {
  data: {
    users: AdminBuyerRecord[];
  };
  pagination: BuyersPagination;
}

interface BackendUserDetailResponse {
  data: {
    user: AdminBuyerRecord;
    context?: CustomerLinkedContext;
  };
}

interface BackendUserToggleResponse {
  data: {
    user: AdminBuyerRecord;
  };
}

export interface FetchBuyersParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface ToggleBuyerStatusPayload {
  isActive: boolean;
  reason: string;
  reasonCode: string;
}

export const adminBuyersApi = {
  async fetchBuyers(params: FetchBuyersParams = {}): Promise<{ buyers: AdminBuyerRecord[]; pagination: BuyersPagination }> {
    const { page = 1, limit = 20, search, isActive } = params;
    const query: Record<string, string | number | boolean> = {
      role: "CUSTOMER",
      page,
      limit,
    };
    if (search && search.trim().length > 0) {
      query.search = search.trim();
    }
    if (typeof isActive === "boolean") {
      query.isActive = isActive;
    }

    const response = await apiClient<BackendUsersResponse>("/admin/users", {
      method: "GET",
      query,
    });
    return {
      buyers: response.data.users,
      pagination: response.pagination,
    };
  },

  async fetchBuyerDetail(id: string): Promise<{ user: AdminBuyerRecord; context?: CustomerLinkedContext }> {
    const response = await apiClient<BackendUserDetailResponse>(`/admin/users/${id}`, {
      method: "GET",
    });
    return {
      user: response.data.user,
      context: response.data.context,
    };
  },

  async toggleBuyerStatus(
    id: string,
    payload: ToggleBuyerStatusPayload,
  ): Promise<{ user: AdminBuyerRecord }> {
    const response = await apiClient<BackendUserToggleResponse>(`/admin/users/${id}/toggle-status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      csrf: true,
    });
    return {
      user: response.data.user,
    };
  },

  async exportCustomersCsv(): Promise<Blob> {
    const response = await apiClient<string>("/admin/users/export", {
      method: "GET",
    });
    return new Blob([response], { type: "text/csv;charset=utf-8" });
  },
};
