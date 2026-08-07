import type { PayoutMode, VendorApplication } from "@/types/seller";

export const MOBILE_MONEY_PROVIDERS = [
  "MTN Mobile Money",
  "Airtel Money",
  "Zamtel Kwacha",
] as const;

export const PAYOUT_BANKS = [
  "Zanaco Bank",
  "Stanbic Bank",
  "FNB Zambia",
  "Absa Bank",
  "Atlas Mara",
  "Indo-Zambia Bank",
  "Ecobank Zambia",
  "UBA Zambia",
  "First Capital Bank",
] as const;

type PayoutSource = "structured" | "legacy" | "none";

export type NormalizedPayoutDestination = {
  mode: PayoutMode | null;
  source: PayoutSource;
  momoProvider: string;
  momoPhone: string;
  momoAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankBranch: string;
};

type PayoutDestinationInput = Partial<Pick<
  VendorApplication,
  | "payoutMode"
  | "momoProvider"
  | "momoPhone"
  | "momoAccountName"
  | "bankName"
  | "bankAccountNumber"
  | "bankAccountName"
  | "bankBranch"
  | "payoutProvider"
  | "payoutPhone"
  | "payoutAccountName"
>>;

function payoutText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizedLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const KNOWN_MOMO_LOOKUPS = new Set([
  ...MOBILE_MONEY_PROVIDERS.map(normalizedLookup),
  "mtn",
  "mtnmomo",
  "airtel",
  "zamtel",
]);

const KNOWN_BANK_LOOKUPS = new Set(PAYOUT_BANKS.map(normalizedLookup));

export function parsePayoutMode(value: unknown): PayoutMode | null {
  switch (value) {
    case "MOBILE_MONEY":
    case "BANK_ACCOUNT":
    case "BOTH":
      return value;
    default:
      return null;
  }
}

/** Unknown legacy providers remain unclassified to prevent false financial readiness. */
export function normalizePayoutDestination(
  input: PayoutDestinationInput | null | undefined,
): NormalizedPayoutDestination {
  const empty: NormalizedPayoutDestination = {
    mode: null,
    source: "none",
    momoProvider: "",
    momoPhone: "",
    momoAccountName: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    bankBranch: "",
  };
  if (!input) return empty;

  const structuredMode = parsePayoutMode(input.payoutMode);
  const structured = {
    momoProvider: payoutText(input.momoProvider),
    momoPhone: payoutText(input.momoPhone),
    momoAccountName: payoutText(input.momoAccountName),
    bankName: payoutText(input.bankName),
    bankAccountNumber: payoutText(input.bankAccountNumber),
    bankAccountName: payoutText(input.bankAccountName),
    bankBranch: payoutText(input.bankBranch),
  };

  if (structuredMode) {
    return { ...structured, mode: structuredMode, source: "structured" };
  }

  const hasMomoStructure = Boolean(
    structured.momoProvider || structured.momoPhone || structured.momoAccountName,
  );
  const hasBankStructure = Boolean(
    structured.bankName || structured.bankAccountNumber || structured.bankAccountName,
  );
  if (hasMomoStructure || hasBankStructure) {
    const mode = hasMomoStructure && hasBankStructure
      ? "BOTH"
      : hasBankStructure
        ? "BANK_ACCOUNT"
        : "MOBILE_MONEY";
    return { ...structured, mode, source: "structured" };
  }

  const legacyProvider = payoutText(input.payoutProvider);
  const legacyPhone = payoutText(input.payoutPhone);
  const legacyAccountName = payoutText(input.payoutAccountName);
  const providerLookup = normalizedLookup(legacyProvider);

  if (KNOWN_MOMO_LOOKUPS.has(providerLookup)) {
    return {
      ...empty,
      mode: "MOBILE_MONEY",
      source: "legacy",
      momoProvider: legacyProvider,
      momoPhone: legacyPhone,
      momoAccountName: legacyAccountName,
    };
  }
  if (KNOWN_BANK_LOOKUPS.has(providerLookup)) {
    return {
      ...empty,
      mode: "BANK_ACCOUNT",
      source: "legacy",
      bankName: legacyProvider,
      bankAccountName: legacyAccountName,
    };
  }

  return empty;
}
