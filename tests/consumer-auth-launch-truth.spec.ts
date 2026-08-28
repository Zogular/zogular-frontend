import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { normalizePublicEmail } from "../src/config/brand";

function readSource(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), "utf8");
}

const permissionsSource = readSource("src/app/(consumer)/auth/permissions/page.tsx");
const registerSource = readSource("src/app/(consumer)/auth/register/page.tsx");
const checkEmailSource = readSource("src/app/(consumer)/auth/check-email/page.tsx");
const loginSource = readSource("src/app/(consumer)/auth/login/page.tsx");
const sellerRegisterSource = readSource("src/app/seller/register/page.tsx");
const sellerLoginSource = readSource("src/app/seller/login/page.tsx");
const sellerCheckEmailSource = readSource("src/app/seller/check-email/page.tsx");
const authServiceSource = readSource("src/services/auth.ts");
const sellerTrustSource = readSource("src/components/seller/SellerTrustChecklist.tsx");
const brandSource = readSource("src/config/brand.ts");
const helpSource = readSource("src/app/(consumer)/help/page.tsx");
const returnsSource = readSource("src/app/(consumer)/returns/page.tsx");
const privacySource = readSource("src/app/(consumer)/privacy/page.tsx");
const infoPageSource = readSource("src/components/consumer/ZogularInfoPage.tsx");
const sellerSupportSource = readSource("src/app/seller/support/page.tsx");
const supportModalSource = readSource("src/app/seller/ContactSupportModal.tsx");
const footerSource = readSource("src/components/layout/Footer.tsx");

test("registration no longer routes through fake permissions or persists no-op preferences", () => {
  expect(permissionsSource).toContain('router.replace(appendNextPath("/auth/check-email", nextPath))');
  expect(permissionsSource).not.toContain("savePermissionPreferences");
  expect(permissionsSource).not.toContain("Location Services");
  expect(permissionsSource).not.toContain("Push Notifications");
  expect(registerSource).toContain('appendNextPath("/auth/check-email", nextPath)');
  expect(registerSource).not.toContain("/auth/permissions");
  expect(authServiceSource).not.toContain("savePermissionPreferences");
});

test("email verification preserves safe next intent without putting mailbox context in check-email URLs", () => {
  expect(authServiceSource).toMatch(/appendSafeNext\(\s*"\/auth\/check-email"/);
  expect(authServiceSource).not.toMatch(/\/auth\/check-email\?email=/);
  expect(checkEmailSource).not.toContain('searchParams.get("email")');
  expect(checkEmailSource).toContain("getStoredLastAuthEmail");
  expect(checkEmailSource).toContain('appendNextPath("/auth/login", nextPath)');
  expect(loginSource).toContain('setVerificationRecoveryHref(appendNextPath("/auth/check-email", nextPath))');
  expect(loginSource).toContain("getStoredLastAuthEmail");
  expect(sellerTrustSource).toContain('ctaHref="/auth/check-email?next=/seller/onboarding"');
  expect(sellerTrustSource).not.toContain("encodeURIComponent(user.email)");
});

test("seller verification links preserve seller next intent without mailbox URLs and restore stored email on login", () => {
  expect(sellerRegisterSource).toContain('appendNextPath("/seller/check-email", nextPath)');
  expect(sellerLoginSource).toContain('setVerificationRecoveryHref(appendNextPath("/seller/check-email", nextPath))');
  expect(sellerLoginSource).toContain("getStoredLastAuthEmail");
  expect(sellerLoginSource).toContain("setEmail((current) => current || getStoredLastAuthEmail() || \"\")");
  expect(sellerCheckEmailSource).not.toContain('searchParams.get("email")');
  expect(sellerCheckEmailSource).toContain("getStoredLastAuthEmail");
  expect(sellerCheckEmailSource).toContain('appendNextPath("/seller/login", nextPath)');
  expect(`${sellerRegisterSource}\n${sellerLoginSource}\n${sellerCheckEmailSource}`).not.toMatch(/\/seller\/check-email\?email=|email=\$\{encodeURIComponent\(email\)/);
});

test("public launch copy excludes unsupported lookup, return, payment, and verification claims", () => {
  const publicCopySource = `${helpSource}\n${returnsSource}\n${privacySource}\n${infoPageSource}`;
  for (const forbidden of [
    "Use your order ID and purchase email",
    "Track an Order",
    "7-day eligible return window",
    "Most eligible items can be returned within 7 days",
    "provider-level security controls",
    "Sensitive payment handling follows provider-level",
    "Verified",
  ]) {
    expect(publicCopySource).not.toContain(forbidden);
  }
  expect(helpSource).toContain("Sign in and open Your Orders");
  expect(returnsSource).toContain("Change-of-mind returns are not automatic.");
  expect(privacySource).toContain("payment-related data only to support orders");
});

test("support email appears only when a valid non-Resend address is configured", () => {
  expect(normalizePublicEmail(undefined, { disallowResend: true })).toBe("");
  expect(normalizePublicEmail("", { disallowResend: true })).toBe("");
  expect(normalizePublicEmail("onboarding@resend.dev", { disallowResend: true })).toBe("");
  expect(normalizePublicEmail("user@mail.resend.dev", { disallowResend: true })).toBe("");
  expect(normalizePublicEmail("not-an-email", { disallowResend: true })).toBe("");
  expect(normalizePublicEmail(" support@zogular.com ", { disallowResend: true })).toBe("support@zogular.com");
  expect(brandSource).not.toContain("onboarding@resend.dev");
  expect(sellerSupportSource).toContain("supportEmail ? (");
  expect(supportModalSource).toContain("supportEmail ? (");
  expect(footerSource).toContain("supportEmail ? (");
  expect(`${sellerSupportSource}\n${supportModalSource}\n${footerSource}`).not.toContain("support@zogular.com");
});
