import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type {
  SellerApplicationStatus,
  SellerDocumentField,
  SellerDocumentType,
  SellerType,
  VendorApplication,
  VendorApplicationInput,
} from "@/types/seller";

export type SectionStatus = "completed" | "pending" | "draft" | "missing" | "verified";

export type StatusBadgeTone =
  | "ready"
  | "verified"
  | "pending"
  | "draft"
  | "missing"
  | "selected"
  | "active"
  | "comingSoon"
  | "completed";

export type UploadTileStatus = "empty" | "pending" | "uploaded" | "rejected";

export type OptionCardState = "selected" | "default" | "disabled";

export type SellerOnboardingSection = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  status: SectionStatus;
};

export type SellerNavItem = {
  label: string;
  href: string;
  icon: ComponentType<LucideProps>;
  active?: boolean;
};

export type ChecklistItem = {
  label: string;
  description: string;
  status: StatusBadgeTone;
};

export type UploadRequirement = {
  title: string;
  description: string;
  status: UploadTileStatus;
  acceptLabel: string;
};

export type SellerOnboardingMock = {
  seller: {
    storeName: string;
    ownerName: string;
    status: string;
    sellerType: string;
  };
  progress: {
    completed: number;
    total: number;
    percent: number;
    remainingLabel: string;
  };
  sections: Record<"operatingModel" | "identity" | "storeFootprint" | "compliance" | "settlement", SellerOnboardingSection>;
  readiness: ChecklistItem[];
  trustControls: ChecklistItem[];
  missingItems: string[];
  uploads: {
    shopPhoto: UploadRequirement;
    nrcFront: UploadRequirement;
    nrcBack: UploadRequirement;
    pacraDocument?: UploadRequirement;
  };
};

export type SellerOnboardingFormValues = {
  sellerType: SellerType;
  ownerFullName: string;
  storeName: string;
  legalBusinessName: string;
  businessPhone: string;
  businessEmail: string;
  district: string;
  productCategoriesInput: string;
  businessAddress: string;
  nrcNumber: string;
  payoutProvider: string;
  payoutPhone: string;
  payoutAccountName: string;
  nrcFrontUrl: string;
  nrcBackUrl: string;
  shopPhotoUrl: string;
  pacraNumber: string;
  pacraDocumentUrl: string;
};

export type SellerOnboardingDocumentType = Extract<
  SellerDocumentType,
  "SHOP_PHOTO" | "NRC_FRONT" | "NRC_BACK" | "PACRA_DOCUMENT"
>;

export type SellerOnboardingDocumentKey =
  | "shopPhoto"
  | "nrcFront"
  | "nrcBack"
  | "pacraDocument";

export type SellerOnboardingDocumentConfig = {
  key: SellerOnboardingDocumentKey;
  field: SellerDocumentField;
  documentType: SellerOnboardingDocumentType;
  title: string;
  description: string;
  acceptLabel: string;
};

export type SellerOnboardingDocumentState = UploadRequirement & {
  key: SellerOnboardingDocumentKey;
  field: SellerOnboardingDocumentConfig["field"];
  documentType: SellerOnboardingDocumentType;
  url: string;
  rejectionReason?: string | null;
};

export type SellerOnboardingViewModel = {
  application: VendorApplication | null;
  hasApplication: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  status: SellerApplicationStatus | "NOT_STARTED";
  statusLabel: string;
  statusMessage: string;
  /** The exact reason the admin wrote when requesting more information. */
  needsInfoReason: string | null;
  /** The exact reason the admin wrote when rejecting the application. */
  rejectionReason: string | null;
  submitDisabledReason: string;
  nextStep: string;
  seller: {
    storeName: string;
    ownerName: string;
    sellerTypeLabel: string;
    initials: string;
  };
  progress: {
    completed: number;
    total: number;
    percent: number;
    remainingLabel: string;
  };
  sections: SellerOnboardingMock["sections"];
  readiness: ChecklistItem[];
  trustControls: ChecklistItem[];
  missingItems: string[];
  documents: Record<SellerOnboardingDocumentKey, SellerOnboardingDocumentState>;
  formValues: SellerOnboardingFormValues;
  firstIncompleteSectionId: string;
};

export type SaveSellerOnboardingPayload = VendorApplicationInput;
