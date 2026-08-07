import { z } from "zod";
import type { SellerOnboardingFormValues } from "../types/seller-onboarding.types";
import type { VendorApplicationInput } from "@/types/seller";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s()-]{7,20}$/, "Enter a valid phone number.");

const nrcSchema = z
  .string()
  .trim()
  .regex(/^\d{6}\/\d{2}\/\d{1}$/, "Enter your NRC like 123456/78/9.");

const bankAccountSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9\s-]{5,30}$/, "Enter a valid bank account number (5-30 alphanumeric characters).");

export const sellerOnboardingDraftSchema = z.object({
  sellerType: z.enum(["INDIVIDUAL", "REGISTERED_BUSINESS"]),
  ownerFullName: z.string(),
  storeName: z.string(),
  legalBusinessName: z.string(),
  businessPhone: z.string(),
  businessEmail: z.string(),
  district: z.string(),
  productCategoriesInput: z.string(),
  businessAddress: z.string(),
  nrcNumber: z.string(),
  payoutProvider: z.string(),
  payoutPhone: z.string(),
  payoutAccountName: z.string(),
  payoutMode: z.enum(["MOBILE_MONEY", "BANK_ACCOUNT", "BOTH"]),
  momoProvider: z.string(),
  momoPhone: z.string(),
  momoAccountName: z.string(),
  bankName: z.string(),
  bankAccountNumber: z.string(),
  bankAccountName: z.string(),
  bankBranch: z.string(),
  nrcFrontUrl: z.string(),
  nrcBackUrl: z.string(),
  shopPhotoUrl: z.string(),
  pacraNumber: z.string(),
  pacraDocumentUrl: z.string(),
});

export const sellerOnboardingSubmitSchema = sellerOnboardingDraftSchema
  .extend({
    ownerFullName: z.string().trim().min(3, "Enter the owner's full name."),
    storeName: z.string().trim().min(3, "Enter your store name."),
    businessPhone: phoneSchema,
    businessEmail: z.string().trim().email("Enter a valid email address."),
    district: z.string().trim().min(2, "Enter your district."),
    productCategoriesInput: z.string().trim().min(2, "Add at least one product category."),
    businessAddress: z.string().trim().min(5, "Enter your business address."),
    nrcNumber: nrcSchema,
    nrcFrontUrl: z.string().trim().url("Upload the front of your NRC."),
    nrcBackUrl: z.string().trim().url("Upload the back of your NRC."),
    shopPhotoUrl: z.string().trim().url("Upload a shop photo."),
  })
  .superRefine((values, ctx) => {
    if (values.sellerType === "REGISTERED_BUSINESS") {
      if (!values.legalBusinessName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["legalBusinessName"],
          message: "Enter your registered business name.",
        });
      }

      if (!values.pacraNumber.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["pacraNumber"],
          message: "Enter your PACRA number.",
        });
      }

      const pacraUrl = z.string().trim().url().safeParse(values.pacraDocumentUrl);
      if (!pacraUrl.success) {
        ctx.addIssue({
          code: "custom",
          path: ["pacraDocumentUrl"],
          message: "Upload your PACRA document.",
        });
      }
    }

    const mode = values.payoutMode;

    if (mode === "MOBILE_MONEY" || mode === "BOTH") {
      if (!values.momoProvider.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["momoProvider"],
          message: "Select your Mobile Money provider / network.",
        });
      }
      const momoPhoneParsed = phoneSchema.safeParse(values.momoPhone);
      if (!momoPhoneParsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["momoPhone"],
          message: "Enter a valid Mobile Money phone number.",
        });
      }
      if (!values.momoAccountName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["momoAccountName"],
          message: "Enter Mobile Money account holder name.",
        });
      }
    }

    if (mode === "BANK_ACCOUNT" || mode === "BOTH") {
      if (!values.bankName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["bankName"],
          message: "Select your bank name.",
        });
      }
      const bankAccParsed = bankAccountSchema.safeParse(values.bankAccountNumber);
      if (!bankAccParsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["bankAccountNumber"],
          message: "Enter a valid bank account number.",
        });
      }
      if (!values.bankAccountName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["bankAccountName"],
          message: "Enter bank account holder name.",
        });
      }
    }
  });

export function categoriesInputToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formValuesToVendorApplicationInput(
  values: SellerOnboardingFormValues,
): VendorApplicationInput {
  const mode = values.payoutMode;

  const payload: VendorApplicationInput = {
    sellerType: values.sellerType,
    productCategories: categoriesInputToArray(values.productCategoriesInput),
    payoutMode: mode,
  };

  if (mode === "MOBILE_MONEY" || mode === "BOTH") {
    payload.momoProvider = values.momoProvider.trim();
    payload.momoPhone = values.momoPhone.trim();
    payload.momoAccountName = values.momoAccountName.trim();
  }

  if (mode === "BANK_ACCOUNT" || mode === "BOTH") {
    payload.bankName = values.bankName.trim();
    payload.bankAccountNumber = values.bankAccountNumber.trim();
    payload.bankAccountName = values.bankAccountName.trim();
    payload.bankBranch = values.bankBranch.trim();
  }

  const optionalTextFields = {
    ownerFullName: values.ownerFullName,
    storeName: values.storeName,
    legalBusinessName: values.legalBusinessName,
    businessPhone: values.businessPhone,
    businessEmail: values.businessEmail.toLowerCase(),
    district: values.district,
    businessAddress: values.businessAddress,
    nrcNumber: values.nrcNumber,
    nrcFrontUrl: values.nrcFrontUrl,
    nrcBackUrl: values.nrcBackUrl,
    shopPhotoUrl: values.shopPhotoUrl,
    pacraNumber: values.pacraNumber,
    pacraDocumentUrl: values.pacraDocumentUrl,
  } satisfies Partial<Record<keyof VendorApplicationInput, string>>;

  for (const [key, value] of Object.entries(optionalTextFields)) {
    const trimmed = value.trim();
    if (trimmed) {
      payload[key as keyof typeof optionalTextFields] = trimmed;
    }
  }

  return payload;
}

export function validateSellerOnboardingForSubmit(values: SellerOnboardingFormValues) {
  return sellerOnboardingSubmitSchema.safeParse(values);
}

export type SellerOnboardingSubmitValues = z.infer<typeof sellerOnboardingSubmitSchema>;
