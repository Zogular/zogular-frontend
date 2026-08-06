"use client";

import { ApiError, apiClient } from "@/services/api";
import type {
  SellerApplicationStatus,
  SellerType,
  VendorApplication,
} from "@/types/seller";
import { normalizePayoutDestination, parsePayoutMode } from "@/lib/payout-destination";

const ADMIN_VENDOR_APPLICATIONS_ENDPOINT = "/admin/vendor-applications";

export interface AdminVendorApplicationListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SellerApplicationStatus | "all";
  sellerType?: SellerType | "all";
}

export interface AdminVendorApplicationListResponse {
  applications: VendorApplication[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ApproveVendorApplicationPayload {
  status?: "PROVISIONAL" | "APPROVED";
  adminNotes?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized ? normalized : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeSellerType(value: unknown): SellerType {
  return value === "REGISTERED_BUSINESS" ? "REGISTERED_BUSINESS" : "INDIVIDUAL";
}

function normalizeStatus(value: unknown): SellerApplicationStatus {
  switch (value) {
    case "SUBMITTED":
    case "NEEDS_INFO":
    case "PROVISIONAL":
    case "APPROVED":
    case "RESTRICTED":
    case "SUSPENDED":
    case "REJECTED":
      return value;
    default:
      return "DRAFT";
  }
}

function normalizeUser(value: unknown): VendorApplication["user"] {
  const record = asRecord(value);
  if (!record) return null;

  return {
    id: asString(record.id),
    firstName: asString(record.firstName),
    lastName: asString(record.lastName),
    email: asString(record.email),
    telephone: asString(record.telephone),
    role: asString(record.role),
    emailVerified: Boolean(record.emailVerified),
    phoneVerifiedAt: asNullableString(record.phoneVerifiedAt),
    isActive: Boolean(record.isActive),
  };
}

function findApplicationRecord(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;

  const data = asRecord(root.data);
  const candidates: unknown[] = [
    data?.application,
    data?.vendorApplication,
    root.application,
    root.vendorApplication,
    data,
    root,
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    // Ignore `status` for duck-typing because the API response root has `{ status: "success" }`
    if (record && (record.id || record.sellerType || record.storeName || record.ownerFullName)) {
      // Ensure we don't accidentally match the root wrapper by verifying it has typical application fields
      if (record.id || record.sellerType || record.storeName) {
        return record;
      }
    }
  }

  return null;
}

function normalizeVendorApplicationRecord(record: Record<string, unknown>): VendorApplication {
  // Resolve document URL aliases: backend may store under idDocument/userPic
  // as legacy fields; prefer the explicit named fields first.
  const nrcFrontUrl = asString(record.nrcFrontUrl) || asString(record.idDocument);
  const shopPhotoUrl = asString(record.shopPhotoUrl) || asString(record.userPic);

  const payoutProvider = asString(record.payoutProvider);
  const payoutPhone = asString(record.payoutPhone);
  const payoutAccountName = asString(record.payoutAccountName);
  const payout = normalizePayoutDestination({
    payoutMode: parsePayoutMode(record.payoutMode),
    payoutProvider,
    payoutPhone,
    payoutAccountName,
    momoProvider: asString(record.momoProvider),
    momoPhone: asString(record.momoPhone),
    momoAccountName: asString(record.momoAccountName),
    bankName: asString(record.bankName),
    bankAccountNumber: asString(record.bankAccountNumber),
    bankAccountName: asString(record.bankAccountName),
    bankBranch: asString(record.bankBranch),
  });

  return {
    id: asString(record.id) || "vendor-application",
    userId: asNullableString(record.userId) || undefined,
    sellerType: normalizeSellerType(record.sellerType),
    status: normalizeStatus(record.status),
    ownerFullName: asString(record.ownerFullName),
    storeName: asString(record.storeName),
    businessName: asNullableString(record.businessName) || undefined,
    legalBusinessName: asString(record.legalBusinessName) || asString(record.businessName),
    businessAddress: asString(record.businessAddress),
    district: asString(record.district),
    businessPhone: asString(record.businessPhone),
    businessEmail: asString(record.businessEmail),
    productCategories: asStringArray(record.productCategories),
    nrcNumber: asString(record.nrcNumber),
    nrcFrontUrl,
    nrcBackUrl: asString(record.nrcBackUrl),
    shopPhotoUrl,
    pacraNumber: asString(record.pacraNumber),
    pacraDocumentUrl: asString(record.pacraDocumentUrl),
    tpin: asString(record.tpin),
    payoutProvider,
    payoutPhone,
    payoutAccountName,
    payoutMode: payout.mode,
    momoProvider: payout.momoProvider || null,
    momoPhone: payout.momoPhone || null,
    momoAccountName: payout.momoAccountName || null,
    bankName: payout.bankName || null,
    bankAccountNumber: payout.bankAccountNumber || null,
    bankAccountName: payout.bankAccountName || null,
    bankBranch: payout.bankBranch || null,
    submittedAt: asNullableString(record.submittedAt),
    reviewedAt: asNullableString(record.reviewedAt),
    reviewedBy: asNullableString(record.reviewedBy),
    rejectionReason: asNullableString(record.rejectionReason),
    adminNotes: asNullableString(record.adminNotes),
    needsInfoReason: asNullableString(record.needsInfoReason),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
    idDocument: asString(record.idDocument) || undefined,
    userPic: asString(record.userPic) || undefined,
    user: normalizeUser(record.user),
  };
}

function normalizeVendorApplication(payload: unknown): VendorApplication {
  const record = findApplicationRecord(payload);
  if (!record) {
    throw new ApiError("Vendor application response was not recognized.", 500, payload);
  }

  return normalizeVendorApplicationRecord(record);
}

function normalizeListPayload(payload: unknown): AdminVendorApplicationListResponse {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const rawApplications = Array.isArray(data?.applications) ? data?.applications : [];
  const pagination = asRecord(root?.pagination);

  return {
    applications: rawApplications
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map(normalizeVendorApplicationRecord),
    pagination: {
      total:
        typeof pagination?.total === "number" ? pagination.total : rawApplications.length,
      page: typeof pagination?.page === "number" ? pagination.page : 1,
      limit: typeof pagination?.limit === "number" ? pagination.limit : rawApplications.length,
      pages: typeof pagination?.pages === "number" ? pagination.pages : 1,
    },
  };
}

function buildListQuery(params: AdminVendorApplicationListParams = {}) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 100,
    search: params.search?.trim() || undefined,
    status: params.status && params.status !== "all" ? params.status : undefined,
    sellerType:
      params.sellerType && params.sellerType !== "all" ? params.sellerType : undefined,
  };
}

export async function getVendorApplications(
  params: AdminVendorApplicationListParams = {},
): Promise<AdminVendorApplicationListResponse> {
  const payload = await apiClient<unknown>(ADMIN_VENDOR_APPLICATIONS_ENDPOINT, {
    method: "GET",
    query: buildListQuery(params),
  });

  return normalizeListPayload(payload);
}

export async function getVendorApplicationById(id: string): Promise<VendorApplication> {
  const payload = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}`,
    {
      method: "GET",
    },
  );

  return normalizeVendorApplication(payload);
}

export async function approveVendorApplication(
  id: string,
  payload: ApproveVendorApplicationPayload = {},
): Promise<VendorApplication> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/approve`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        status: payload.status ?? "APPROVED",
        adminNotes: payload.adminNotes?.trim() || undefined,
      }),
    },
  );

  return normalizeVendorApplication(response);
}

export async function rejectVendorApplication(
  id: string,
  rejectionReason: string,
  adminNotes?: string,
): Promise<VendorApplication> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/reject`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        rejectionReason: rejectionReason.trim(),
        adminNotes: adminNotes?.trim() || undefined,
      }),
    },
  );

  return normalizeVendorApplication(response);
}

export async function requestVendorApplicationInfo(
  id: string,
  needsInfoReason: string,
  adminNotes?: string,
): Promise<VendorApplication> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/needs-info`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        needsInfoReason: needsInfoReason.trim(),
        adminNotes: adminNotes?.trim() || undefined,
      }),
    },
  );

  return normalizeVendorApplication(response);
}

export async function restrictVendorApplication(
  id: string,
  adminNotes?: string,
): Promise<VendorApplication> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/restrict`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        adminNotes: adminNotes?.trim() || "",
      }),
    },
  );

  return normalizeVendorApplication(response);
}

export async function suspendVendorApplication(
  id: string,
  adminNotes?: string,
): Promise<VendorApplication> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/suspend`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        adminNotes: adminNotes?.trim() || "",
      }),
    },
  );

  return normalizeVendorApplication(response);
}
