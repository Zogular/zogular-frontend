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
    payoutProvider: z.string().trim().min(2, "Choose a payout provider."),
    payoutPhone: phoneSchema,
    nrcFrontUrl: z.string().trim().url("Upload the front of your NRC."),
    nrcBackUrl: z.string().trim().url("Upload the back of your NRC."),
    shopPhotoUrl: z.string().trim().url("Upload a shop photo."),
  })
  .superRefine((values, ctx) => {
    if (values.sellerType !== "REGISTERED_BUSINESS") return;

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
  const payload: VendorApplicationInput = {
    sellerType: values.sellerType,
    productCategories: categoriesInputToArray(values.productCategoriesInput),
  };

  const optionalTextFields = {
    ownerFullName: values.ownerFullName,
    storeName: values.storeName,
    legalBusinessName: values.legalBusinessName,
    businessPhone: values.businessPhone,
    businessEmail: values.businessEmail.toLowerCase(),
    district: values.district,
    businessAddress: values.businessAddress,
    nrcNumber: values.nrcNumber,
    payoutProvider: values.payoutProvider,
    payoutPhone: values.payoutPhone,
    payoutAccountName: values.payoutAccountName,
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
