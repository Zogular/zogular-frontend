"use client";

import { ApiError, apiClient } from "@/services/api";
import type {
  SellerApplicationStatus,
  SellerType,
  VendorApplication,
} from "@/types/seller";
import { normalizePayoutDestination, parsePayoutMode } from "@/lib/payout-destination";
import {
  normalizeSellerDocumentAccess,
  toSellerDocumentAccessError,
  type SellerDocumentAccess,
} from "@/services/seller-document-uploads";
import type { SellerDocumentType } from "@/types/seller";
import {
  SellerReviewContractError,
  parseSellerReviewResponse,
} from "@/features/admin-sellers/types/seller-review.contract";
import type {
  SellerReviewDetail,
  SellerReviewSafeError,
} from "@/features/admin-sellers/types/seller-review.types";

const ADMIN_VENDOR_APPLICATIONS_ENDPOINT = "/admin/vendor-applications";

export interface AdminVendorApplicationListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SellerApplicationStatus | "all";
  sellerType?: SellerType | "all";
  sort?: AdminVendorApplicationSort;
  direction?: AdminVendorApplicationSortDirection;
  signal?: AbortSignal;
}

export type AdminVendorApplicationSort =
  | "submittedAt"
  | "createdAt"
  | "updatedAt"
  | "storeName";

export type AdminVendorApplicationSortDirection = "asc" | "desc";

export const SELLER_APPLICATION_STATUSES: readonly SellerApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "NEEDS_INFO",
  "PROVISIONAL",
  "APPROVED",
  "RESTRICTED",
  "SUSPENDED",
  "REJECTED",
];

export type AdminVendorApplicationStatusFacets = Record<SellerApplicationStatus, number>;

export interface AdminVendorApplicationListResponse {
  applications: VendorApplication[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  facets: {
    byStatus: AdminVendorApplicationStatusFacets;
  };
}

export class AdminVendorApplicationListContractError extends Error {
  constructor() {
    super("Seller application list response did not match the expected contract.");
    this.name = "AdminVendorApplicationListContractError";
  }
}

export interface ApproveVendorApplicationPayload {
  status: "PROVISIONAL" | "APPROVED";
  expectedUpdatedAt: string;
  adminNotes?: string;
}

export interface ReasonedVendorApplicationPayload {
  reason: string;
  expectedUpdatedAt: string;
  adminNotes?: string;
}

export interface NotedVendorApplicationPayload {
  adminNotes: string;
  expectedUpdatedAt: string;
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function assertListApplicationRecord(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    !record.id.trim() ||
    !SELLER_APPLICATION_STATUSES.includes(record.status as SellerApplicationStatus) ||
    (record.sellerType !== "INDIVIDUAL" && record.sellerType !== "REGISTERED_BUSINESS") ||
    !isValidDateString(record.createdAt) ||
    !isValidDateString(record.updatedAt)
  ) {
    throw new AdminVendorApplicationListContractError();
  }

  for (const field of ["submittedAt", "reviewedAt"] as const) {
    if (record[field] !== null && record[field] !== undefined && !isValidDateString(record[field])) {
      throw new AdminVendorApplicationListContractError();
    }
  }

  return record;
}

export function parseAdminVendorApplicationListResponse(
  payload: unknown,
): AdminVendorApplicationListResponse {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const rawApplications = data?.applications;
  const pagination = asRecord(root?.pagination);
  const facets = asRecord(root?.facets);
  const byStatus = asRecord(facets?.byStatus);

  if (
    root?.status !== "success" ||
    !Array.isArray(rawApplications) ||
    !pagination ||
    !isNonNegativeInteger(pagination.total) ||
    !isPositiveInteger(pagination.page) ||
    !isPositiveInteger(pagination.limit) ||
    !isNonNegativeInteger(pagination.pages) ||
    pagination.pages !== Math.ceil(pagination.total / pagination.limit) ||
    rawApplications.length > pagination.limit ||
    !facets ||
    !byStatus
  ) {
    throw new AdminVendorApplicationListContractError();
  }

  const parsedFacets = {} as AdminVendorApplicationStatusFacets;
  for (const status of SELLER_APPLICATION_STATUSES) {
    const count = byStatus[status];
    if (!isNonNegativeInteger(count)) {
      throw new AdminVendorApplicationListContractError();
    }
    parsedFacets[status] = count;
  }

  if (Object.keys(byStatus).some((status) => !SELLER_APPLICATION_STATUSES.includes(status as SellerApplicationStatus))) {
    throw new AdminVendorApplicationListContractError();
  }

  return {
    applications: rawApplications.map(assertListApplicationRecord).map(normalizeVendorApplicationRecord),
    pagination: {
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      pages: pagination.pages,
    },
    facets: { byStatus: parsedFacets },
  };
}

export function buildAdminVendorApplicationListQuery(
  params: AdminVendorApplicationListParams = {},
) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search?.trim() || undefined,
    status: params.status && params.status !== "all" ? params.status : undefined,
    sellerType:
      params.sellerType && params.sellerType !== "all" ? params.sellerType : undefined,
    sort: params.sort ?? "submittedAt",
    direction: params.direction ?? "desc",
  };
}

export async function getVendorApplications(
  params: AdminVendorApplicationListParams = {},
): Promise<AdminVendorApplicationListResponse> {
  const payload = await apiClient<unknown>(ADMIN_VENDOR_APPLICATIONS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    query: buildAdminVendorApplicationListQuery(params),
    signal: params.signal,
  });

  return parseAdminVendorApplicationListResponse(payload);
}

export async function getVendorApplicationById(
  id: string,
  signal?: AbortSignal,
): Promise<SellerReviewDetail> {
  const payload = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    },
  );

  return parseSellerReviewResponse(payload);
}

export async function getAdminSellerDocumentAccess(
  applicationId: string,
  documentType: SellerDocumentType,
): Promise<SellerDocumentAccess> {
  try {
    const payload = await apiClient<unknown>(
      `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentType)}/access`,
      { method: "GET" },
    );

    return normalizeSellerDocumentAccess(payload, documentType);
  } catch (error) {
    throw toSellerDocumentAccessError(error);
  }
}

export async function approveVendorApplication(
  id: string,
  payload: ApproveVendorApplicationPayload,
): Promise<SellerReviewDetail> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/approve`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        status: payload.status,
        expectedUpdatedAt: assertExpectedUpdatedAt(payload.expectedUpdatedAt),
        adminNotes: payload.adminNotes?.trim() || undefined,
      }),
    },
  );

  return parseSellerReviewResponse(response);
}

export async function rejectVendorApplication(
  id: string,
  payload: ReasonedVendorApplicationPayload,
): Promise<SellerReviewDetail> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/reject`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        rejectionReason: payload.reason.trim(),
        expectedUpdatedAt: assertExpectedUpdatedAt(payload.expectedUpdatedAt),
        adminNotes: payload.adminNotes?.trim() || undefined,
      }),
    },
  );

  return parseSellerReviewResponse(response);
}

export async function requestVendorApplicationInfo(
  id: string,
  payload: ReasonedVendorApplicationPayload,
): Promise<SellerReviewDetail> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/needs-info`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        needsInfoReason: payload.reason.trim(),
        expectedUpdatedAt: assertExpectedUpdatedAt(payload.expectedUpdatedAt),
        adminNotes: payload.adminNotes?.trim() || undefined,
      }),
    },
  );

  return parseSellerReviewResponse(response);
}

export async function restrictVendorApplication(
  id: string,
  payload: NotedVendorApplicationPayload,
): Promise<SellerReviewDetail> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/restrict`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        adminNotes: payload.adminNotes.trim(),
        expectedUpdatedAt: assertExpectedUpdatedAt(payload.expectedUpdatedAt),
      }),
    },
  );

  return parseSellerReviewResponse(response);
}

export async function suspendVendorApplication(
  id: string,
  payload: NotedVendorApplicationPayload,
): Promise<SellerReviewDetail> {
  const response = await apiClient<unknown>(
    `${ADMIN_VENDOR_APPLICATIONS_ENDPOINT}/${encodeURIComponent(id)}/suspend`,
    {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({
        adminNotes: payload.adminNotes.trim(),
        expectedUpdatedAt: assertExpectedUpdatedAt(payload.expectedUpdatedAt),
      }),
    },
  );

  return parseSellerReviewResponse(response);
}

function assertExpectedUpdatedAt(value: string): string {
  const normalized = value.trim();
  if (!normalized || !normalized.includes("T") || Number.isNaN(Date.parse(normalized))) {
    throw new SellerReviewContractError();
  }
  return normalized;
}

export function getSellerReviewSafeError(error: unknown): SellerReviewSafeError {
  if (error instanceof SellerReviewContractError) {
    return {
      kind: "malformed",
      message: "This seller review could not be verified. Try again.",
    };
  }

  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        kind: "unauthenticated",
        message: "Your admin access could not be confirmed. Sign in again.",
      };
    }
    if (error.status === 403) {
      return {
        kind: "forbidden",
        message: "You do not have permission to review this seller application.",
      };
    }
    if (error.status === 404) {
      return {
        kind: "not-found",
        message: "This seller application is no longer available.",
      };
    }
    if (error.status === 409) {
      return {
        kind: "conflict",
        message: "Another reviewer changed this application. Refresh before taking another action.",
      };
    }
    if (error.status === 408) {
      return {
        kind: "timeout",
        message: "The seller review is taking too long to load. Try again.",
      };
    }
  }

  return {
    kind: "unavailable",
    message: "The seller review is temporarily unavailable. Try again.",
  };
}

export function shouldRetrySellerReviewQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= 1) return false;
  const kind = getSellerReviewSafeError(error).kind;
  return kind === "timeout" || kind === "unavailable";
}
