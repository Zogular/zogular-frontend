import { apiClient } from "@/services/api";

export interface AdminBuyerRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
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

export const adminBuyersApi = {
  async fetchBuyers(page = 1, limit = 20): Promise<{ buyers: AdminBuyerRecord[]; pagination: BuyersPagination }> {
    const response = await apiClient<BackendUsersResponse>("/admin/users", {
      method: "GET",
      query: { role: "CUSTOMER", page, limit },
    });
    return {
      buyers: response.data.users,
      pagination: response.pagination,
    };
  },
};
