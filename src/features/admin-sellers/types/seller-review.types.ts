import type {
  PayoutMode,
  SellerApplicationStatus,
  SellerDocumentType,
  SellerType,
} from "@/types/seller";

export const SELLER_REVIEW_ACTIONS = [
  "APPROVE",
  "GRANT_PROVISIONAL",
  "REQUEST_INFO",
  "REJECT",
  "RESTRICT",
  "SUSPEND",
] as const;

export type SellerReviewAction = (typeof SELLER_REVIEW_ACTIONS)[number];

export const SELLER_REVIEW_HISTORY_ACTIONS = [
  "APPROVED",
  "PROVISIONAL_GRANTED",
  "INFORMATION_REQUESTED",
  "REJECTED",
  "RESTRICTED",
  "SUSPENDED",
] as const;

export type SellerReviewHistoryAction =
  (typeof SELLER_REVIEW_HISTORY_ACTIONS)[number];

export interface SellerReviewAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  role: string;
}

export interface SellerReviewApplication {
  id: string;
  userId: string;
  sellerType: SellerType;
  status: SellerApplicationStatus;
  ownerFullName: string;
  storeName: string;
  legalBusinessName: string | null;
  businessAddress: string;
  district: string;
  businessPhone: string;
  businessEmail: string;
  productCategories: string[];
  nrcNumber: string | null;
  pacraNumber: string | null;
  tpin: string | null;
  payoutMode: PayoutMode | null;
  momoProvider: string | null;
  momoPhone: string | null;
  momoAccountName: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankBranch: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  needsInfoReason: string | null;
  createdAt: string;
  updatedAt: string;
  account: SellerReviewAccount;
}

export interface SellerReviewCapabilities {
  canManageStatus: boolean;
  canViewSensitiveFields: boolean;
  availableActions: SellerReviewAction[];
}

export interface SellerReviewEvidence {
  emailVerified: boolean;
  phoneVerified: boolean;
  accountActive: boolean;
  documents: Record<SellerDocumentType, boolean>;
  payoutDestinationAvailable: boolean;
}

export interface SellerReviewHistoryEntry {
  id: string;
  action: SellerReviewHistoryAction;
  previousStatus: SellerApplicationStatus;
  newStatus: SellerApplicationStatus;
  timestamp: string;
  actorId: string;
  actorDisplayName: string | null;
  actorRole: string;
  reason: string | null;
}

export interface SellerReviewDetail {
  application: SellerReviewApplication;
  review: {
    capabilities: SellerReviewCapabilities;
    evidence: SellerReviewEvidence;
    history: SellerReviewHistoryEntry[];
  };
}

export type SellerReviewErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "timeout"
  | "malformed"
  | "unavailable";

export interface SellerReviewSafeError {
  kind: SellerReviewErrorKind;
  message: string;
}

