/**
 * @file admin-buyer.types.ts
 * @module features/admin-buyers/types
 * @description
 * TypeScript interfaces and domain types for the Admin Customer Management (CM-F1) read workspace.
 *
 * Identity & Field Masking Mandate:
 * - Backend omits restricted fields (firstName, lastName, email, telephone) when the acting admin
 *   lacks `view_user_sensitive_fields` permission.
 * - Omitted restricted fields are strictly distinct from actual `null` values:
 *   e.g. `telephone: null` denotes that a phone was not provided, whereas an omitted (undefined)
 *   `telephone` denotes that the field was masked by backend access policy.
 * - Only records with `role === "CUSTOMER"` are valid for display in the Customers workspace.
 */

export interface AdminBuyerRecord {
  id: string;
  role: "CUSTOMER";
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  mustChangePassword?: boolean;

  /**
   * Sensitive identity fields:
   * Omitted by backend if the admin lacks `view_user_sensitive_fields`.
   */
  firstName?: string;
  lastName?: string;

  /**
   * Sensitive contact fields:
   * Omitted by backend if the admin lacks `view_user_sensitive_fields`.
   * Note: telephone may be null when provided permissions exist but no telephone is on record.
   */
  email?: string;
  telephone?: string | null;
}

export interface AdminBuyerDetailRecord extends AdminBuyerRecord {
  /**
   * Governance audit fields returned on detail endpoint:
   * Per plan: do not display governance identifiers in customer operations without separate need.
   */
  createdBy?: string | null;
  investorId?: string | null;
}

export interface AdminBuyersPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminBuyerListResponse {
  status: "success";
  results: number;
  pagination: AdminBuyersPagination;
  data: {
    users: AdminBuyerRecord[];
  };
}

export interface AdminBuyerDetailResponse {
  status: "success";
  data: {
    user: AdminBuyerDetailRecord;
  };
}

export type AdminBuyerSortBy =
  | "createdAt"
  | "updatedAt"
  | "firstName"
  | "lastName"
  | "email"
  | "telephone"
  | "isActive";

export type AdminBuyerSortOrder = "asc" | "desc";

export type AdminBuyerActiveFilter = "all" | "active" | "inactive";

export interface AdminBuyerListQueryParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  sortBy?: AdminBuyerSortBy;
  sortOrder?: AdminBuyerSortOrder;
}

export type AdminBuyerViewMode = "list" | "grid";
