import type { SellerApplicationStatus, SellerDocumentType } from "@/types/seller";
import {
  SELLER_REVIEW_ACTIONS,
  SELLER_REVIEW_HISTORY_ACTIONS,
  type SellerReviewAction,
  type SellerReviewApplication,
  type SellerReviewCapabilities,
  type SellerReviewDetail,
  type SellerReviewEvidence,
  type SellerReviewHistoryAction,
  type SellerReviewHistoryEntry,
} from "./seller-review.types";

const ROOT_KEYS = ["status", "data"] as const;
const SELLER_APPLICATION_STATUSES: readonly SellerApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "NEEDS_INFO",
  "PROVISIONAL",
  "APPROVED",
  "RESTRICTED",
  "SUSPENDED",
  "REJECTED",
];
const DATA_KEYS = ["application", "review"] as const;
const REVIEW_KEYS = ["capabilities", "evidence", "history"] as const;
const CAPABILITY_KEYS = [
  "canManageStatus",
  "canViewSensitiveFields",
  "availableActions",
] as const;
const EVIDENCE_KEYS = [
  "emailVerified",
  "phoneVerified",
  "accountActive",
  "documents",
  "payoutDestinationAvailable",
] as const;
const DOCUMENT_KEYS: readonly SellerDocumentType[] = [
  "NRC_FRONT",
  "NRC_BACK",
  "SHOP_PHOTO",
  "PACRA_DOCUMENT",
];
const APPLICATION_KEYS = [
  "id",
  "userId",
  "sellerType",
  "status",
  "ownerFullName",
  "storeName",
  "legalBusinessName",
  "businessAddress",
  "district",
  "businessPhone",
  "businessEmail",
  "productCategories",
  "nrcNumber",
  "pacraNumber",
  "tpin",
  "payoutMode",
  "momoProvider",
  "momoPhone",
  "momoAccountName",
  "bankName",
  "bankAccountNumber",
  "bankAccountName",
  "bankBranch",
  "submittedAt",
  "reviewedAt",
  "rejectionReason",
  "adminNotes",
  "needsInfoReason",
  "createdAt",
  "updatedAt",
  "account",
] as const;
const ACCOUNT_KEYS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "telephone",
  "role",
] as const;
const HISTORY_KEYS = [
  "id",
  "action",
  "previousStatus",
  "newStatus",
  "timestamp",
  "actorId",
  "actorDisplayName",
  "actorRole",
  "reason",
] as const;

const STATUS_ACTIONS: Record<SellerApplicationStatus, readonly SellerReviewAction[]> = {
  DRAFT: [],
  SUBMITTED: ["APPROVE", "GRANT_PROVISIONAL", "REQUEST_INFO", "REJECT"],
  NEEDS_INFO: [],
  PROVISIONAL: ["APPROVE", "RESTRICT", "SUSPEND"],
  APPROVED: ["RESTRICT", "SUSPEND"],
  RESTRICTED: ["SUSPEND"],
  SUSPENDED: [],
  REJECTED: [],
};

export class SellerReviewContractError extends Error {
  constructor() {
    super("Seller review response did not match the expected contract.");
    this.name = "SellerReviewContractError";
  }
}

function fail(): never {
  throw new SellerReviewContractError();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const keys = Object.keys(record);
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) fail();
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) fail();
  return value.trim();
}

function presentString(value: unknown): string {
  if (typeof value !== "string") fail();
  return value.trim();
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return presentString(value);
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function isoTimestamp(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  const timestamp = requiredString(value);
  if (!timestamp.includes("T") || Number.isNaN(Date.parse(timestamp))) fail();
  return timestamp;
}

function sellerStatus(value: unknown): SellerApplicationStatus {
  if (!SELLER_APPLICATION_STATUSES.includes(value as SellerApplicationStatus)) fail();
  return value as SellerApplicationStatus;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) fail();
  const parsed = value.map(requiredString);
  if (new Set(parsed).size !== parsed.length) fail();
  return parsed;
}

function parseApplication(value: unknown): SellerReviewApplication {
  const record = asRecord(value);
  assertExactKeys(record, APPLICATION_KEYS);
  const account = asRecord(record.account);
  assertExactKeys(account, ACCOUNT_KEYS);

  if (record.sellerType !== "INDIVIDUAL" && record.sellerType !== "REGISTERED_BUSINESS") fail();
  if (
    record.payoutMode !== null &&
    record.payoutMode !== "MOBILE_MONEY" &&
    record.payoutMode !== "BANK_ACCOUNT" &&
    record.payoutMode !== "BOTH"
  ) fail();

  return {
    id: requiredString(record.id),
    userId: requiredString(record.userId),
    sellerType: record.sellerType,
    status: sellerStatus(record.status),
    ownerFullName: presentString(record.ownerFullName),
    storeName: presentString(record.storeName),
    legalBusinessName: nullableString(record.legalBusinessName),
    businessAddress: presentString(record.businessAddress),
    district: presentString(record.district),
    businessPhone: presentString(record.businessPhone),
    businessEmail: presentString(record.businessEmail),
    productCategories: stringArray(record.productCategories),
    nrcNumber: nullableString(record.nrcNumber),
    pacraNumber: nullableString(record.pacraNumber),
    tpin: nullableString(record.tpin),
    payoutMode: record.payoutMode,
    momoProvider: nullableString(record.momoProvider),
    momoPhone: nullableString(record.momoPhone),
    momoAccountName: nullableString(record.momoAccountName),
    bankName: nullableString(record.bankName),
    bankAccountNumber: nullableString(record.bankAccountNumber),
    bankAccountName: nullableString(record.bankAccountName),
    bankBranch: nullableString(record.bankBranch),
    submittedAt: isoTimestamp(record.submittedAt, true),
    reviewedAt: isoTimestamp(record.reviewedAt, true),
    rejectionReason: nullableString(record.rejectionReason),
    adminNotes: nullableString(record.adminNotes),
    needsInfoReason: nullableString(record.needsInfoReason),
    createdAt: isoTimestamp(record.createdAt)!,
    updatedAt: isoTimestamp(record.updatedAt)!,
    account: {
      id: requiredString(account.id),
      firstName: presentString(account.firstName),
      lastName: presentString(account.lastName),
      email: presentString(account.email),
      telephone: presentString(account.telephone),
      role: requiredString(account.role),
    },
  };
}

function parseCapabilities(
  value: unknown,
  status: SellerApplicationStatus,
): SellerReviewCapabilities {
  const record = asRecord(value);
  assertExactKeys(record, CAPABILITY_KEYS);
  if (!Array.isArray(record.availableActions)) fail();

  const availableActions = record.availableActions.map((action) => {
    if (!SELLER_REVIEW_ACTIONS.includes(action as SellerReviewAction)) fail();
    return action as SellerReviewAction;
  });
  if (new Set(availableActions).size !== availableActions.length) fail();

  const canManageStatus = booleanValue(record.canManageStatus);
  if (!canManageStatus && availableActions.length > 0) fail();
  if (availableActions.some((action) => !STATUS_ACTIONS[status].includes(action))) fail();

  return {
    canManageStatus,
    canViewSensitiveFields: booleanValue(record.canViewSensitiveFields),
    availableActions,
  };
}

function parseEvidence(value: unknown): SellerReviewEvidence {
  const record = asRecord(value);
  assertExactKeys(record, EVIDENCE_KEYS);
  const documents = asRecord(record.documents);
  assertExactKeys(documents, DOCUMENT_KEYS);

  return {
    emailVerified: booleanValue(record.emailVerified),
    phoneVerified: booleanValue(record.phoneVerified),
    accountActive: booleanValue(record.accountActive),
    documents: {
      NRC_FRONT: booleanValue(documents.NRC_FRONT),
      NRC_BACK: booleanValue(documents.NRC_BACK),
      SHOP_PHOTO: booleanValue(documents.SHOP_PHOTO),
      PACRA_DOCUMENT: booleanValue(documents.PACRA_DOCUMENT),
    },
    payoutDestinationAvailable: booleanValue(record.payoutDestinationAvailable),
  };
}

function parseHistory(value: unknown): SellerReviewHistoryEntry[] {
  if (!Array.isArray(value)) fail();
  const entries = value.map((item) => {
    const record = asRecord(item);
    assertExactKeys(record, HISTORY_KEYS);
    if (!SELLER_REVIEW_HISTORY_ACTIONS.includes(record.action as SellerReviewHistoryAction)) fail();

    return {
      id: requiredString(record.id),
      action: record.action as SellerReviewHistoryAction,
      previousStatus: sellerStatus(record.previousStatus),
      newStatus: sellerStatus(record.newStatus),
      timestamp: isoTimestamp(record.timestamp)!,
      actorId: requiredString(record.actorId),
      actorDisplayName: nullableString(record.actorDisplayName),
      actorRole: requiredString(record.actorRole),
      reason: nullableString(record.reason),
    };
  });

  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) fail();
  for (let index = 1; index < entries.length; index += 1) {
    if (Date.parse(entries[index - 1].timestamp) < Date.parse(entries[index].timestamp)) fail();
  }
  return entries;
}

function assertSensitiveBoundary(
  application: SellerReviewApplication,
  capabilities: SellerReviewCapabilities,
): void {
  if (capabilities.canViewSensitiveFields) return;
  const restrictedValues = [
    application.nrcNumber,
    application.pacraNumber,
    application.tpin,
    application.momoProvider,
    application.momoPhone,
    application.momoAccountName,
    application.bankName,
    application.bankAccountNumber,
    application.bankAccountName,
    application.bankBranch,
    application.adminNotes,
  ];
  if (restrictedValues.some((value) => value !== null)) fail();
}

export function parseSellerReviewResponse(payload: unknown): SellerReviewDetail {
  const root = asRecord(payload);
  assertExactKeys(root, ROOT_KEYS);
  if (root.status !== "success") fail();
  const data = asRecord(root.data);
  assertExactKeys(data, DATA_KEYS);
  const review = asRecord(data.review);
  assertExactKeys(review, REVIEW_KEYS);

  const application = parseApplication(data.application);
  const capabilities = parseCapabilities(review.capabilities, application.status);
  const evidence = parseEvidence(review.evidence);
  const history = parseHistory(review.history);
  assertSensitiveBoundary(application, capabilities);

  return {
    application,
    review: { capabilities, evidence, history },
  };
}
