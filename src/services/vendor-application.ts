import { ApiError, apiClient } from "@/services/api";
import type {
  SellerApplicationStatus,
  SellerCapability,
  SellerStatusMeta,
  SellerType,
  VendorApplication,
  VendorApplicationInput,
} from "@/types/seller";

const VENDOR_APPLICATION_ENDPOINT = "/vendor/applications";

export type SellerStatusCapabilitySummary = {
  availableNow: string[];
  blockedOrPending: string[];
};

const SELLER_CAPABILITY_MATRIX: Record<SellerCapability, SellerApplicationStatus[]> = {
  canAccessSellerShell: [
    "DRAFT",
    "SUBMITTED",
    "NEEDS_INFO",
    "PROVISIONAL",
    "APPROVED",
    "RESTRICTED",
  ],
  canCreateDraftProduct: ["PROVISIONAL", "APPROVED"],
  canSubmitProductForReview: ["APPROVED"],
  canReceiveOrders: ["APPROVED"],
  canAccessPayouts: ["APPROVED"],
};

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
    return value
      .map((item) => asString(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function findApplicationRecord(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;

  const candidates: unknown[] = [
    root.vendorApplication,
    asRecord(root.data)?.vendorApplication,
    root.application,
    asRecord(root.data)?.application,
    root.result,
    root.payload,
    root.data,
    root,
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    // A true application record MUST have an id, or at least a recognizable sellerType.
    // The API envelope has a 'status' field ("success") which can cause false positives 
    // if we just check for 'status'.
    if (record && (record.id || (record.sellerType && record.ownerFullName !== undefined))) {
      return record;
    }
  }

  return null;
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

function normalizeVendorApplication(payload: unknown): VendorApplication {
  const record = findApplicationRecord(payload);
  if (!record) {
    throw new ApiError("Vendor application response was not recognized.", 500, payload);
  }

  return {
    id: asString(record.id) || "vendor-application",
    sellerType: normalizeSellerType(record.sellerType),
    status: normalizeStatus(record.status),
    ownerFullName: asString(record.ownerFullName),
    storeName: asString(record.storeName),
    legalBusinessName:
      asString(record.legalBusinessName) || asString(record.businessName),
    businessAddress: asString(record.businessAddress),
    district: asString(record.district),
    businessPhone: asString(record.businessPhone),
    businessEmail: asString(record.businessEmail),
    productCategories: asStringArray(record.productCategories),
    nrcNumber: asString(record.nrcNumber),
    nrcFrontUrl: asString(record.nrcFrontUrl),
    nrcBackUrl: asString(record.nrcBackUrl),
    shopPhotoUrl: asString(record.shopPhotoUrl),
    pacraNumber: asString(record.pacraNumber),
    pacraDocumentUrl: asString(record.pacraDocumentUrl),
    tpin: asString(record.tpin),
    payoutProvider: asString(record.payoutProvider),
    payoutPhone: asString(record.payoutPhone),
    payoutAccountName: asString(record.payoutAccountName),
    submittedAt: asNullableString(record.submittedAt),
    reviewedAt: asNullableString(record.reviewedAt),
    reviewedBy: asNullableString(record.reviewedBy),
    rejectionReason: asNullableString(record.rejectionReason),
    adminNotes: asNullableString(record.adminNotes),
    needsInfoReason: asNullableString(record.needsInfoReason),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

function normalizePayload(input: VendorApplicationInput) {
  return {
    ...input,
    productCategories: input.productCategories?.filter(Boolean) ?? [],
  };
}

export function isSellerBlockedStatus(status?: SellerApplicationStatus | null): boolean {
  return status === "SUSPENDED" || status === "REJECTED";
}

export function hasSellerCapability(
  status: SellerApplicationStatus | null | undefined,
  capability: SellerCapability,
): boolean {
  if (!status) return false;
  return SELLER_CAPABILITY_MATRIX[capability].includes(status);
}

export function getSellerStatusMeta(status: SellerApplicationStatus): SellerStatusMeta {
  switch (status) {
    case "SUBMITTED":
      return {
        eyebrow: "Under Review",
        title: "Your seller application is under review.",
        description:
          "ZOGULAR is reviewing your identity, business, and payout details. Seller tools stay locked until review moves to NEEDS_INFO, PROVISIONAL, or APPROVED.",
        tone: "neutral",
        ctaLabel: "View status",
        ctaHref: "/seller/status",
      };
    case "NEEDS_INFO":
      return {
        eyebrow: "Action Needed",
        title: "More information is required before review can continue.",
        description:
          "Open your application, fix the requested identity or business details, and resubmit. Draft products, orders, and payouts remain blocked until your status changes.",
        tone: "warning",
        ctaLabel: "Update application",
        ctaHref: "/seller/onboarding",
      };
    case "PROVISIONAL":
      return {
        eyebrow: "Provisional Access",
        title: "Provisional seller access is active.",
        description:
          "You can prepare your storefront and create draft products now. Product review submission, orders, payouts, and live selling stay blocked until full approval.",
        tone: "warning",
        ctaLabel: "Create draft products",
        ctaHref: "/seller/products/new",
      };
    case "APPROVED":
      return {
        eyebrow: "Approved",
        title: "Your seller account is approved.",
        description:
          "You can create draft products, submit listings for review, and receive orders once products are approved. Payout processing and support ticket actions use pending fallback flows until backend services are fully available.",
        tone: "success",
        ctaLabel: "Open dashboard",
        ctaHref: "/seller",
      };
    case "RESTRICTED":
      return {
        eyebrow: "Restricted",
        title: "Your seller account is restricted.",
        description:
          "Only limited status visibility is available right now. Product, order, analytics, payout, and settings actions stay blocked until ZOGULAR lifts the restriction.",
        tone: "warning",
        ctaLabel: "View status",
        ctaHref: "/seller/status",
      };
    case "SUSPENDED":
      return {
        eyebrow: "Suspended",
        title: "Your seller account is suspended.",
        description:
          "Selling access is suspended while ZOGULAR reviews the account. Seller tools stay blocked; use the status notes and direct support contact for the next step.",
        tone: "danger",
        ctaLabel: "View status",
        ctaHref: "/seller/status",
      };
    case "REJECTED":
      return {
        eyebrow: "Rejected",
        title: "Your seller application was rejected.",
        description:
          "Selling access is blocked. Review the rejection details first, then contact support or restart onboarding only if ZOGULAR allows a new application.",
        tone: "danger",
        ctaLabel: "View status",
        ctaHref: "/seller/status",
      };
    case "DRAFT":
    default:
      return {
        eyebrow: "Onboarding",
        title: "Finish your seller application to unlock the seller hub.",
        description:
          "Complete your identity, business, and payout details so the application can be submitted for review. Seller dashboard tools stay locked until your status advances.",
        tone: "neutral",
        ctaLabel: "Continue application",
        ctaHref: "/seller/onboarding",
      };
  }
}

export function getSellerStatusCapabilitySummary(
  status: SellerApplicationStatus,
): SellerStatusCapabilitySummary {
  switch (status) {
    case "SUBMITTED":
      return {
        availableNow: ["Track review status"],
        blockedOrPending: [
          "Application edits until more info is requested",
          "Product drafts",
          "Orders and analytics",
          "Payout access",
        ],
      };
    case "NEEDS_INFO":
      return {
        availableNow: ["Edit requested application details", "Resubmit for review"],
        blockedOrPending: ["Product drafts", "Orders and analytics", "Payout access"],
      };
    case "PROVISIONAL":
      return {
        availableNow: ["Seller dashboard access", "Create draft products", "Review store settings preview"],
        blockedOrPending: ["Submit products for review", "Receive orders", "Payout access"],
      };
    case "APPROVED":
      return {
        availableNow: [
          "Create draft products",
          "Submit products for review",
          "Receive orders after product approval",
        ],
        blockedOrPending: ["Ledger-backed payouts", "In-app support ticket actions"],
      };
    case "RESTRICTED":
      return {
        availableNow: ["Read seller status updates"],
        blockedOrPending: ["Product management", "Orders and analytics", "Payout access"],
      };
    case "SUSPENDED":
      return {
        availableNow: ["Read suspension status", "Use direct support contact"],
        blockedOrPending: ["Product management", "Orders and analytics", "Payout access"],
      };
    case "REJECTED":
      return {
        availableNow: ["Read rejection details", "Use direct support contact"],
        blockedOrPending: ["Seller dashboard tools", "Product drafts", "Orders and payout access"],
      };
    case "DRAFT":
    default:
      return {
        availableNow: ["Continue onboarding"],
        blockedOrPending: ["Product drafts", "Orders and analytics", "Payout access"],
      };
  }
}

export function getEmptyVendorApplication(
  sellerType: SellerType = "INDIVIDUAL",
): VendorApplicationInput {
  return {
    sellerType,
    ownerFullName: "",
    storeName: "",
    legalBusinessName: "",
    businessAddress: "",
    district: "",
    businessPhone: "",
    businessEmail: "",
    productCategories: [],
    nrcNumber: "",
    nrcFrontUrl: "",
    nrcBackUrl: "",
    shopPhotoUrl: "",
    pacraNumber: "",
    pacraDocumentUrl: "",
    tpin: "",
    payoutProvider: "",
    payoutPhone: "",
    payoutAccountName: "",
  };
}

export async function getMyVendorApplication(): Promise<VendorApplication> {
  const payload = await apiClient<unknown>(`${VENDOR_APPLICATION_ENDPOINT}/me`, {
    method: "GET",
  });

  return normalizeVendorApplication(payload);
}

export async function createVendorApplication(
  input: VendorApplicationInput,
): Promise<VendorApplication> {
  const payload = await apiClient<unknown>(VENDOR_APPLICATION_ENDPOINT, {
    method: "POST",
    csrf: true,
    body: JSON.stringify(normalizePayload(input)),
  });

  return normalizeVendorApplication(payload);
}

export async function updateMyVendorApplication(
  input: VendorApplicationInput,
): Promise<VendorApplication> {
  const payload = await apiClient<unknown>(`${VENDOR_APPLICATION_ENDPOINT}/me`, {
    method: "PATCH",
    csrf: true,
    body: JSON.stringify(normalizePayload(input)),
  });

  return normalizeVendorApplication(payload);
}

export async function submitMyVendorApplication(): Promise<VendorApplication> {
  const payload = await apiClient<unknown>(`${VENDOR_APPLICATION_ENDPOINT}/me/submit`, {
    method: "PATCH",
    csrf: true,
    body: JSON.stringify({}),
  });

  return normalizeVendorApplication(payload);
}
