import { z } from "zod";
import { ApiError, apiClient } from "@/services/api";
import type { AdminRole } from "../rbac";

const statusRecordSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

// User identity and contact fields can be withheld by the API's field policy.
const adminUserSchema = statusRecordSchema.extend({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  role: z.string(),
  createdAt: z.string(),
});

const adminUsersResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ users: z.array(adminUserSchema) }),
});

const statusResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ user: statusRecordSchema }),
});

export type AdminUserRecord = z.infer<typeof adminUserSchema>;
export type AdminAccessStatus = z.infer<typeof statusRecordSchema>;
export const adminAccessReasonSchema = z.string().trim().min(10).max(500);

export const adminAccessApi = {
  async fetchAdmins(signal: AbortSignal): Promise<AdminUserRecord[]> {
    const response = await apiClient<unknown>("/admin/users", {
      method: "GET",
      query: { limit: 100 },
      cache: "no-store",
      skipAuthRefresh: true,
      signal,
    });
    const result = adminUsersResponseSchema.safeParse(response);
    if (!result.success) throw new ApiError("Admin directory could not be confirmed.", 502);

    return result.data.data.users.filter((user) =>
      ["SUPER_ADMIN", "TECH_ADMIN", "EXECUTIVE", "OPERATIONS"].includes(user.role),
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
  async updateStatus(
    adminId: string,
    isActive: boolean,
    reason: string,
    signal: AbortSignal,
  ): Promise<AdminAccessStatus> {
    const result = adminAccessReasonSchema.safeParse(reason);
    if (!result.success) throw new ApiError("Invalid access status reason.", 400);

    const response = await apiClient<unknown>(`/admin/users/${encodeURIComponent(adminId)}/toggle-status`, {
      method: "PATCH",
      body: JSON.stringify({
        isActive,
        reason: result.data,
        reasonCode: isActive ? "APPROVED_REACTIVATION" : "APPROVED_DEACTIVATION",
      }),
      csrf: "header",
      skipAuthRefresh: true,
      signal,
    });
    const confirmation = statusResponseSchema.safeParse(response);
    if (!confirmation.success) throw new ApiError("Access status change could not be confirmed.", 502);

    const { user } = confirmation.data.data;
    if (user.id !== adminId || user.isActive !== isActive) {
      throw new ApiError("Access status change could not be confirmed.", 502);
    }
    return user;
  },
};
