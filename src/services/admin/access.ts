import { apiClient } from "@/services/api";
import { AdminRole } from "../rbac";

export interface AdminUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface BackendUsersResponse {
  data: {
    users: AdminUserRecord[];
  };
  pagination: { total: number; page: number; limit: number; pages: number };
}

export const adminAccessApi = {
  async fetchAdmins(): Promise<AdminUserRecord[]> {
    const response = await apiClient<BackendUsersResponse>("/admin/users", {
      method: "GET",
      query: { limit: 100 }, // Assuming we want all admins and 100 is enough for now
    });
    // Filter to only include admin roles
    return response.data.users.filter((user) => 
      ["SUPER_ADMIN", "TECH_ADMIN", "EXECUTIVE", "OPERATIONS"].includes(user.role)
    );
  },
  async inviteAdmin(firstName: string, lastName: string, email: string, role: AdminRole): Promise<void> {
    await apiClient("/admin/users", {
      method: "POST",
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password: crypto.randomUUID() + "Aa1!", // Temp password, user should reset
        telephone: "+00000000000", // Placeholder
        role,
      }),
      csrf: true
    });
  },
  async revokeAccess(adminId: string): Promise<void> {
    await apiClient(`/admin/users/${adminId}/toggle-status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
      csrf: true
    });
  },
  async restoreAccess(adminId: string): Promise<void> {
    await apiClient(`/admin/users/${adminId}/toggle-status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: true }),
      csrf: true
    });
  }
};
