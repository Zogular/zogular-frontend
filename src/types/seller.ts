export type SellerType = "INDIVIDUAL" | "REGISTERED_BUSINESS";

export type SellerApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "NEEDS_INFO"
  | "PROVISIONAL"
  | "APPROVED"
  | "RESTRICTED"
  | "SUSPENDED"
  | "REJECTED";

export type SellerCapability =
  | "canAccessSellerShell"
  | "canCreateDraftProduct"
  | "canSubmitProductForReview"
  | "canReceiveOrders"
  | "canAccessPayouts";

export type SellerDocumentType =
  | "NRC_FRONT"
  | "NRC_BACK"
  | "SHOP_PHOTO"
  | "PACRA_DOCUMENT";

export type SellerDocumentField =
  | "nrcFrontUrl"
  | "nrcBackUrl"
  | "shopPhotoUrl"
  | "pacraDocumentUrl";

export type SellerDocumentUploadStatus =
  | "idle"
  | "uploading"
  | "uploaded"
  | "failed";

export interface SellerDocumentUploadState {
  status: SellerDocumentUploadStatus;
  progress: number;
  error?: string;
  previewUrl?: string | null;
  uploadedUrl?: string;
  fileName?: string | null;
  fileKind?: "image" | "pdf" | null;
}

export type PayoutMode = "MOBILE_MONEY" | "BANK_ACCOUNT" | "BOTH";

export interface VendorApplication {
  id: string;
  userId?: string;
  sellerType: SellerType;
  status: SellerApplicationStatus;
  ownerFullName: string;
  storeName: string;
  businessName?: string;
  legalBusinessName: string;
  businessAddress: string;
  district: string;
  businessPhone: string;
  businessEmail: string;
  productCategories: string[];
  nrcNumber: string;
  nrcFrontUrl: string;
  nrcBackUrl: string;
  shopPhotoUrl: string;
  pacraNumber: string;
  pacraDocumentUrl: string;
  tpin: string;
  payoutProvider: string;
  payoutPhone: string;
  payoutAccountName: string;
  payoutMode?: PayoutMode | null;
  momoProvider?: string | null;
  momoPhone?: string | null;
  momoAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankBranch?: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  needsInfoReason: string | null;
  createdAt: string;
  updatedAt: string;
  idDocument?: string;
  userPic?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    telephone: string;
    role: string;
    emailVerified: boolean;
    phoneVerifiedAt?: string | null;
    isActive: boolean;
  } | null;
}

export interface VendorApplicationInput {
  sellerType?: SellerType;
  ownerFullName?: string;
  storeName?: string;
  legalBusinessName?: string;
  businessAddress?: string;
  district?: string;
  businessPhone?: string;
  businessEmail?: string;
  productCategories?: string[];
  nrcNumber?: string;
  nrcFrontUrl?: string;
  nrcBackUrl?: string;
  shopPhotoUrl?: string;
  pacraNumber?: string;
  pacraDocumentUrl?: string;
  tpin?: string;
  payoutProvider?: string;
  payoutPhone?: string;
  payoutAccountName?: string;
  payoutMode?: PayoutMode | null;
  momoProvider?: string | null;
  momoPhone?: string | null;
  momoAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankBranch?: string | null;
}

export interface SellerStatusMeta {
  eyebrow: string;
  title: string;
  description: string;
  tone: "neutral" | "warning" | "success" | "danger";
  ctaLabel?: string;
  ctaHref?: string;
}
