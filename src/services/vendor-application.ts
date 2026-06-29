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
        title: "Your application is under review. We’ll notify you when there’s an update.",
        description:
          "Your account is in the queue for trust and compliance checks. You can monitor progress from the seller hub while review is in progress.",
        tone: "neutral",
        ctaLabel: "View status",
        ctaHref: "/seller/status",
      };
    case "NEEDS_INFO":
      return {
        eyebrow: "Action Needed",
        title: "Admin requested updates. Please fix these details before resubmitting.",
        description:
          "Update the requested identity or business details, then resubmit so review can continue.",
        tone: "warning",
        ctaLabel: "Update application",
        ctaHref: "/seller/onboarding",
      };
    case "PROVISIONAL":
      return {
        eyebrow: "Provisional Access",
        title: "You have provisional access. You can create draft products, but product review submission is locked until full approval.",
        description:
          "Draft creation is open, but orders and payouts stay locked until your seller approval becomes APPROVED.",
        tone: "warning",
        ctaLabel: "Manage products",
        ctaHref: "/seller/products",
      };
    case "APPROVED":
      return {
        eyebrow: "Approved",
        title: "Your seller account is approved. You can now create products and manage your shop.",
        description:
          "You can now manage listings, submit products for review, receive orders, and access payouts as those features become available in the seller portal.",
        tone: "success",
        ctaLabel: "Open dashboard",
        ctaHref: "/seller",
      };
    case "RESTRICTED":
      return {
        eyebrow: "Restricted",
        title: "Your seller account has restrictions. Some actions are temporarily unavailable.",
        description:
          "Seller shell access remains available, but core selling actions are currently limited. Review the status details and wait for further guidance from the ZOGULAR team.",
        tone: "warning",
        ctaLabel: "View status",
        ctaHref: "/seller/status",
      };
    case "SUSPENDED":
      return {
        eyebrow: "Suspended",
        title: "Your seller account is suspended. Contact support for help.",
        description:
          "Selling actions are blocked while the ZOGULAR team reviews the account. Check the latest notes and wait for further communication before attempting seller actions.",
        tone: "danger",
        ctaLabel: "View status",
        ctaHref: "/seller/status",
      };
    case "REJECTED":
      return {
        eyebrow: "Rejected",
        title: "Your seller application was rejected.",
        description:
          "Review the rejection reason before contacting support or starting a new seller application path with corrected information.",
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
          "You have started seller onboarding, but trust and business details still need to be completed before selling capabilities open up.",
        tone: "neutral",
        ctaLabel: "Continue application",
        ctaHref: "/seller/onboarding",
      };
  }
}

export function getSellerStatusCapabilitySummary(status: SellerApplicationStatus) {
  const availableNow: string[] = [];
  const blockedOrPending: string[] = [];

  if (hasSellerCapability(status, "canAccessSellerShell")) {
    availableNow.push("Seller Portal");
  } else {
    blockedOrPending.push("Seller Portal");
  }

  if (hasSellerCapability(status, "canCreateDraftProduct")) {
    availableNow.push("Draft Products");
  } else {
    blockedOrPending.push("Draft Products");
  }

  if (hasSellerCapability(status, "canSubmitProductForReview")) {
    availableNow.push("Publish Products");
  } else {
    blockedOrPending.push("Publish Products");
  }

  if (hasSellerCapability(status, "canReceiveOrders")) {
    availableNow.push("Receive Orders");
  } else {
    blockedOrPending.push("Receive Orders");
  }

  if (hasSellerCapability(status, "canAccessPayouts")) {
    availableNow.push("Receive Payouts");
  } else {
    blockedOrPending.push("Receive Payouts");
  }

  return { availableNow, blockedOrPending };
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
