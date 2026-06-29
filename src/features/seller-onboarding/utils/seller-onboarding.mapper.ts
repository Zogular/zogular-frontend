import type { AuthUser } from "@/types/auth";
import type { SellerApplicationStatus, VendorApplication } from "@/types/seller";
import type {
  ChecklistItem,
  SellerOnboardingDocumentConfig,
  SellerOnboardingDocumentKey,
  SellerOnboardingDocumentState,
  SellerOnboardingFormValues,
  SellerOnboardingViewModel,
  StatusBadgeTone,
} from "../types/seller-onboarding.types";

const TOTAL_STEPS = 6;

export const sellerOnboardingDocumentConfigs: SellerOnboardingDocumentConfig[] = [
  {
    key: "shopPhoto",
    field: "shopPhotoUrl",
    documentType: "SHOP_PHOTO",
    title: "Shop photo",
    description: "Show your selling space, stock area, or workspace.",
    acceptLabel: "JPG, PNG, WEBP",
  },
  {
    key: "nrcFront",
    field: "nrcFrontUrl",
    documentType: "NRC_FRONT",
    title: "NRC front",
    description: "Upload the front side of your NRC.",
    acceptLabel: "JPG, PNG, WEBP",
  },
  {
    key: "nrcBack",
    field: "nrcBackUrl",
    documentType: "NRC_BACK",
    title: "NRC back",
    description: "Upload the back side of your NRC.",
    acceptLabel: "JPG, PNG, WEBP",
  },
  {
    key: "pacraDocument",
    field: "pacraDocumentUrl",
    documentType: "PACRA_DOCUMENT",
    title: "PACRA document",
    description: "Upload your business registration document.",
    acceptLabel: "PDF, JPG, PNG, WEBP",
  },
];

function filled(value?: string | null) {
  return Boolean(value?.trim());
}

function sellerTypeLabel(value?: string) {
  return value === "REGISTERED_BUSINESS" ? "Registered business" : "Individual seller";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "Z") + (parts[1]?.[0] ?? "S");
}

function statusLabel(status: SellerApplicationStatus | "NOT_STARTED") {
  switch (status) {
    case "SUBMITTED":
      return "Under review";
    case "NEEDS_INFO":
      return "Needs updates";
    case "PROVISIONAL":
      return "Provisional";
    case "APPROVED":
      return "Approved";
    case "RESTRICTED":
      return "Limited";
    case "SUSPENDED":
      return "Paused";
    case "REJECTED":
      return "Not approved";
    case "NOT_STARTED":
      return "Not started";
    case "DRAFT":
    default:
      return "Draft";
  }
}

function statusMessage(
  status: SellerApplicationStatus | "NOT_STARTED",
  needsInfoReason?: string | null,
) {
  switch (status) {
    case "SUBMITTED":
      return "Your application is under review.";
    case "NEEDS_INFO":
      return needsInfoReason?.trim()
        ? needsInfoReason.trim()
        : "Please update the requested details and resubmit your application.";
    case "PROVISIONAL":
      return "Your shop has provisional access.";
    case "APPROVED":
      return "Your seller account is approved.";
    case "RESTRICTED":
      return "Some seller tools are limited right now.";
    case "SUSPENDED":
      return "Your seller account is paused.";
    case "REJECTED":
      return "Your application was not approved.";
    case "NOT_STARTED":
      return "Let's get your shop set up.";
    case "DRAFT":
    default:
      return "Keep going. You can save anytime.";
  }
}



function readinessTone(value: "ready" | "pending" | "missing" | "not_required"): StatusBadgeTone {
  if (value === "ready" || value === "not_required") return "ready";
  if (value === "missing") return "missing";
  return "pending";
}

function documentState(
  config: SellerOnboardingDocumentConfig,
  application: VendorApplication | null,
): SellerOnboardingDocumentState {
  const url = application?.[config.field] ?? "";

  return {
    ...config,
    status: url ? "uploaded" : "empty",
    url,
  };
}

export function getSellerOnboardingFormValues(
  application: VendorApplication | null,
): SellerOnboardingFormValues {
  return {
    sellerType: application?.sellerType ?? "INDIVIDUAL",
    ownerFullName: application?.ownerFullName ?? "",
    storeName: application?.storeName ?? "",
    legalBusinessName: application?.legalBusinessName ?? application?.businessName ?? "",
    businessPhone: application?.businessPhone ?? "",
    businessEmail: application?.businessEmail ?? "",
    district: application?.district ?? "",
    productCategoriesInput: application?.productCategories?.join(", ") ?? "",
    businessAddress: application?.businessAddress ?? "",
    nrcNumber: application?.nrcNumber ?? "",
    payoutProvider: application?.payoutProvider ?? "MTN Mobile Money",
    payoutPhone: application?.payoutPhone ?? "",
    payoutAccountName: application?.payoutAccountName ?? "",
    nrcFrontUrl: application?.nrcFrontUrl ?? "",
    nrcBackUrl: application?.nrcBackUrl ?? "",
    shopPhotoUrl: application?.shopPhotoUrl ?? "",
    pacraNumber: application?.pacraNumber ?? "",
    pacraDocumentUrl: application?.pacraDocumentUrl ?? "",
  };
}

export function mapSellerOnboardingToViewModel(
  application: VendorApplication | null,
  user: AuthUser | null,
): SellerOnboardingViewModel {
  const formValues = getSellerOnboardingFormValues(application);
  const documents = Object.fromEntries(
    sellerOnboardingDocumentConfigs.map((config) => [
      config.key,
      documentState(config, application),
    ]),
  ) as Record<SellerOnboardingDocumentKey, SellerOnboardingDocumentState>;

  const identityReady =
    filled(formValues.ownerFullName) &&
    filled(formValues.storeName) &&
    filled(formValues.businessPhone) &&
    filled(formValues.businessEmail);

  const storeReady =
    filled(formValues.district) &&
    filled(formValues.productCategoriesInput) &&
    filled(formValues.businessAddress);

  const isRegisteredBusiness = formValues.sellerType === "REGISTERED_BUSINESS";
  
  const complianceReady =
    documents.shopPhoto.status === "uploaded" &&
    filled(formValues.nrcNumber) &&
    documents.nrcFront.status === "uploaded" &&
    documents.nrcBack.status === "uploaded" &&
    (!isRegisteredBusiness || (filled(formValues.pacraNumber) && documents.pacraDocument.status === "uploaded"));

  const settlementReady = filled(formValues.payoutProvider) && filled(formValues.payoutPhone);

  const emailVerified = Boolean(user?.emailVerified ?? application?.user?.emailVerified);
  const phoneVerified = Boolean(user?.phoneVerifiedAt ?? application?.user?.phoneVerifiedAt);
  const trustReady = emailVerified && phoneVerified;

  const readiness = {
    identity: identityReady ? ("ready" as const) : ("missing" as const),
    store: storeReady ? ("ready" as const) : ("missing" as const),
    compliance: complianceReady ? ("ready" as const) : ("missing" as const),
    entity: "ready" as const,
    settlement: settlementReady ? ("ready" as const) : ("missing" as const),
    trust: trustReady ? ("ready" as const) : (emailVerified || phoneVerified ? ("pending" as const) : ("missing" as const)),
  };

  const status = application?.status ?? "NOT_STARTED";
  const missingItems = getMissingItemsFromReadiness(
    readiness,
    documents,
    formValues,
    status,
    emailVerified,
    phoneVerified,
  );
  const completed = [
    readiness.identity,
    readiness.store,
    readiness.compliance,
    readiness.entity,
    readiness.settlement,
    readiness.trust,
  ].filter((item) => item === "ready").length;
  const lockedStatuses: Array<SellerApplicationStatus | "NOT_STARTED"> = [
    "SUBMITTED",
    "PROVISIONAL",
    "APPROVED",
    "RESTRICTED",
    "SUSPENDED",
    "REJECTED",
  ];
  const canEdit = !lockedStatuses.includes(status);
  const canSubmit = canEdit && missingItems.length === 0;
  const firstIncompleteSectionId = getFirstIncompleteSectionId(readiness);

  // Dynamic descriptions
  const getIdentityDesc = () => {
    if (identityReady) return "Store identity details are complete.";
    const missing = [];
    if (!filled(formValues.ownerFullName)) missing.push("owner");
    if (!filled(formValues.storeName)) missing.push("store");
    if (!filled(formValues.businessPhone)) missing.push("phone");
    if (!filled(formValues.businessEmail)) missing.push("email");
    return `Add ${missing.join(", ")}.`;
  };

  const getStoreDesc = () => {
    if (storeReady) return "Store footprint details are complete.";
    const missing = [];
    if (!filled(formValues.district)) missing.push("district");
    if (!filled(formValues.businessAddress)) missing.push("address");
    if (!filled(formValues.productCategoriesInput)) missing.push("categories");
    return `Add ${missing.join(", ")}.`;
  };

  const getDocsDesc = () => {
    if (status === "SUBMITTED" && !complianceReady) return "Under review. Admin must request updates before changes.";
    if (complianceReady) return "All required documents are uploaded.";
    const missing = [];
    if (documents.shopPhoto.status !== "uploaded") missing.push("shop photo");
    if (!filled(formValues.nrcNumber)) missing.push("NRC number");
    if (documents.nrcFront.status !== "uploaded") missing.push("NRC front");
    if (documents.nrcBack.status !== "uploaded") missing.push("NRC back");
    if (isRegisteredBusiness) {
      if (!filled(formValues.pacraNumber)) missing.push("PACRA number");
      if (documents.pacraDocument.status !== "uploaded") missing.push("PACRA doc");
    }
    return `Missing: ${missing.join(", ")}.`;
  };

  const getPayoutsDesc = () => {
    if (settlementReady) return "Payout details are complete.";
    const missing = [];
    if (!filled(formValues.payoutProvider)) missing.push("provider");
    if (!filled(formValues.payoutPhone)) missing.push("phone");
    return `Add payout ${missing.join(" and ")}.`;
  };

  const getTrustDesc = () => {
    if (trustReady) return "Email and phone are confirmed.";
    const missing = [];
    if (!emailVerified) missing.push("email");
    if (!phoneVerified) missing.push("phone");
    return `Confirm ${missing.join(" and ")}.`;
  };

  const resolvedNeedsInfoReason = application?.needsInfoReason ?? null;
  const resolvedRejectionReason = application?.rejectionReason ?? null;

  // When the admin has requested specific updates, surface that as the next step
  // so the seller sees it immediately in the hero and notice bar.
  const nextStep = status === "NEEDS_INFO" && resolvedNeedsInfoReason?.trim()
    ? resolvedNeedsInfoReason.trim()
    : missingItems[0] ?? "Send your application for review.";

  return {
    application,
    hasApplication: Boolean(application),
    canEdit,
    canSubmit,
    status,
    statusLabel: statusLabel(status),
    statusMessage: statusMessage(status, resolvedNeedsInfoReason),
    needsInfoReason: resolvedNeedsInfoReason,
    rejectionReason: resolvedRejectionReason,
    submitDisabledReason: getSubmitDisabledReason(status, missingItems),
    nextStep,
    seller: {
      storeName: formValues.storeName || "Zogular Store",
      ownerName:
        formValues.ownerFullName ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        "Seller Admin",
      sellerTypeLabel: sellerTypeLabel(formValues.sellerType),
      initials: getInitials(formValues.storeName || formValues.ownerFullName || "Zogular Store"),
    },
    progress: {
      completed,
      total: TOTAL_STEPS,
      percent: Math.round((completed / TOTAL_STEPS) * 100),
      remainingLabel: `${Math.max(TOTAL_STEPS - completed, 0)} steps remaining`,
    },
    sections: {
      operatingModel: {
        id: "operating-model",
        eyebrow: "Seller model",
        title: "Operating model",
        description: "Choose how this shop will sell on Zogular.",
        status: "completed",
      },
      identity: {
        id: "identity",
        eyebrow: "Identity",
        title: "Store identity",
        description: "Add the owner and public store details.",
        status: mapReadinessToSectionStatus(readiness.identity),
      },
      storeFootprint: {
        id: "store-footprint",
        eyebrow: "Footprint",
        title: "Store footprint",
        description: "Tell us where you operate and what you plan to sell.",
        status: mapReadinessToSectionStatus(readiness.store),
      },
      compliance: {
        id: "compliance",
        eyebrow: "Trust",
        title: "ID and shop documents",
        description:
          status === "SUBMITTED" && readiness.compliance !== "ready"
            ? "Your application is under review. If documents are missing, an admin must request more info before you can edit again."
            : "Upload the files we need to check your shop.",
        status: mapReadinessToSectionStatus(readiness.compliance),
      },
      settlement: {
        id: "settlement",
        eyebrow: "Payouts",
        title: "Payout details",
        description: "Add where future seller payments should go.",
        status: mapReadinessToSectionStatus(readiness.settlement),
      },
    },
    readiness: [
      checklistItem("Identity", getIdentityDesc(), readiness.identity),
      checklistItem("Store", getStoreDesc(), readiness.store),
      checklistItem("Documents", getDocsDesc(), readiness.compliance),
      checklistItem("Seller type", `${sellerTypeLabel(formValues.sellerType)} is selected.`, readiness.entity),
      checklistItem("Payouts", getPayoutsDesc(), readiness.settlement),
      checklistItem("Account checks", getTrustDesc(), readiness.trust),
    ],
    trustControls: [
      {
        label: "Email",
        description: emailVerified ? "Your email is confirmed." : "Please confirm your email.",
        status: emailVerified ? "verified" : "pending",
      },
      {
        label: "Phone",
        description: phoneVerified ? "Your phone is confirmed." : "Please confirm your phone.",
        status: phoneVerified ? "verified" : "pending",
      },
      {
        label: "ID documents",
        description:
          complianceReady
            ? "Your files are uploaded and ready for review."
            : status === "SUBMITTED"
              ? "Under review. Admin must request updates before changes."
              : "Upload your required files.",
        status: complianceReady ? "ready" : "pending",
      },
    ],
    missingItems,
    documents,
    formValues,
    firstIncompleteSectionId,
  };
}

function checklistItem(
  label: string,
  description: string,
  status: "ready" | "pending" | "missing" | "not_required",
): ChecklistItem {
  return {
    label,
    description,
    status: readinessTone(status),
  };
}

function mapReadinessToSectionStatus(
  status: "ready" | "pending" | "missing" | "not_required",
) {
  if (status === "ready" || status === "not_required") return "completed";
  if (status === "missing") return "missing";
  return "pending";
}

function getMissingItemsFromReadiness(
  readiness: Record<string, "ready" | "pending" | "missing" | "not_required">,
  documents: Record<SellerOnboardingDocumentKey, SellerOnboardingDocumentState>,
  values: SellerOnboardingFormValues,
  status: SellerApplicationStatus | "NOT_STARTED",
  emailVerified: boolean,
  phoneVerified: boolean,
) {
  const items: string[] = [];
  if (readiness.identity !== "ready") items.push("Add owner and store details");
  if (readiness.store !== "ready") items.push("Add district, address, and categories");
  if (!filled(values.nrcNumber)) items.push("Add your NRC number");
  const uploadVerb = status === "SUBMITTED" ? "Missing" : "Upload";
  if (documents.shopPhoto.status !== "uploaded") items.push(`${uploadVerb} shop photo`);
  if (documents.nrcFront.status !== "uploaded") items.push(`${uploadVerb} NRC front`);
  if (documents.nrcBack.status !== "uploaded") items.push(`${uploadVerb} NRC back`);
  if (values.sellerType === "REGISTERED_BUSINESS") {
    if (!filled(values.legalBusinessName)) items.push("Add business name");
    if (!filled(values.pacraNumber)) items.push("Add PACRA number");
    if (documents.pacraDocument.status !== "uploaded") {
      items.push(`${uploadVerb} PACRA document`);
    }
  }
  if (readiness.settlement !== "ready") items.push("Add payout phone");
  if (readiness.trust !== "ready") {
    const missing = [];
    if (!emailVerified) missing.push("email");
    if (!phoneVerified) missing.push("phone");
    items.push(`Confirm ${missing.join(" and ")}`);
  }
  return items;
}

export function getFirstIncompleteSectionId(
  readiness: Record<string, "ready" | "pending" | "missing" | "not_required">,
) {
  if (readiness.identity !== "ready") return "identity";
  if (readiness.store !== "ready") return "store-footprint";
  if (readiness.compliance !== "ready") return "compliance";
  if (readiness.settlement !== "ready") return "settlement";
  if (readiness.trust !== "ready") return "submit";
  return "submit";
}

export function canSubmitApplication(viewModel: SellerOnboardingViewModel) {
  return viewModel.canSubmit;
}

export function getMissingItems(viewModel: SellerOnboardingViewModel) {
  return viewModel.missingItems;
}

function getSubmitDisabledReason(
  status: SellerApplicationStatus | "NOT_STARTED",
  missingItems: string[],
) {
  if (status === "SUBMITTED" || status === "PROVISIONAL") {
    return missingItems.length > 0
      ? "Your application is under review. If documents are missing, an admin must request more info before you can edit again."
      : "Your application is currently under review.";
  }
  if (status === "APPROVED") return "Your seller account is already approved.";
  if (status === "RESTRICTED" || status === "SUSPENDED" || status === "REJECTED") {
    return "This application cannot be sent right now.";
  }
  if (missingItems.length > 0) {
    return `Please complete ${missingItems.length} more ${missingItems.length === 1 ? "item" : "items"} before sending your application.`;
  }
  return "Ready to send.";
}
