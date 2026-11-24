import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

const baseUrl = process.env.TEST_BASE_URL;
const onboardingPath = "/seller/onboarding";
const applicationPath = "/api/backend/vendor/applications/me";
const timestamp = "2026-08-21T12:00:00.000Z";
const draftIdentity = { ownerFullName: "Fixture Owner", storeName: "Fixture Store" };
type Identity = typeof draftIdentity;
type IdentityField = keyof Identity;

test.use({
  channel: process.env.TEST_BROWSER_CHANNEL || "chrome",
  serviceWorkers: "block",
});
test.skip(!baseUrl, "Set TEST_BASE_URL to the already-running isolated frontend.");

function loopbackOrigin() {
  const url = new URL(baseUrl!);
  if (
    url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !url.port || url.port === "5000" || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash
  ) throw new Error("TEST_BASE_URL must be an explicit loopback frontend origin, not backend port 5000.");
  return url.origin;
}

async function installFixtures(context: BrowserContext, complete = false) {
  const origin = loopbackOrigin();
  const submitted: unknown[] = [];
  const unexpectedWrites: string[] = [];
  const user = {
    id: "fixture-seller", firstName: "Fixture", lastName: "Owner", email: "owner@example.test",
    role: "seller", emailVerified: true, phoneVerifiedAt: timestamp, isActive: true,
  };
  let application = {
    id: "fixture-application", status: "DRAFT", sellerType: "INDIVIDUAL",
    ...draftIdentity, businessPhone: "+260960000001", businessEmail: "store@example.test",
    payoutMode: "MOBILE_MONEY", createdAt: timestamp, updatedAt: timestamp, user,
    ...(complete ? {
      district: "Lusaka", businessAddress: "Fixture Market", productCategories: ["Clothing"],
      nrcNumber: "123456/78/9", nrcFrontUrl: "https://example.test/front.png",
      nrcBackUrl: "https://example.test/back.png", shopPhotoUrl: "https://example.test/shop.png",
      momoProvider: "MTN", momoPhone: "+260970000000", momoAccountName: "Fixture Owner",
    } : {}),
  };

  // Intercept API traffic before navigation, including a fail-closed fallback for all other writes.
  await context.routeWebSocket("**/*", (socket) => socket.close());
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    const success = (data: unknown) => route.fulfill({ json: { status: "success", data } });

    if (method === "GET") {
      if (path === "/api/backend/user/me") return success({ user });
      if (path === applicationPath) return success({ application });
      if (path === "/api/backend/auth/csrf-token") return success({ csrfToken: "fixture-csrf" });
      if (path === onboardingPath || path.startsWith("/_next/static/") || path.startsWith("/brand/")) {
        return route.continue();
      }
      if (path === "/_next/image" && /^\/brand\/zogular-[a-z0-9-]+\.png$/.test(url.searchParams.get("url") ?? "")) {
        return route.continue();
      }
    }
    if (method === "PATCH" && path === applicationPath) {
      const patch = request.postDataJSON() as Partial<Identity>;
      submitted.push(patch);
      application = {
        ...application,
        ownerFullName: patch.ownerFullName ?? application.ownerFullName,
        storeName: patch.storeName ?? application.storeName,
        updatedAt: "2026-08-21T12:01:00.000Z",
      };
      return success({ application });
    }
    if (method !== "GET" && method !== "HEAD") unexpectedWrites.push(`${method} ${path}`);
    return route.abort();
  });
  return { origin, submitted, unexpectedWrites };
}

// Count mounted inputs, not only visible ones: CSS-hidden registrations caused the desktop regression.
const identityField = (page: Page, name: IdentityField) => page.locator(`input[name="${name}"]`);
const visibleIdentityField = (page: Page, name: IdentityField) => identityField(page, name).filter({ visible: true });
const submitButton = (page: Page) => page.getByRole("button", { name: /^(Submit|Submit for review)$/ });
const saveButton = (page: Page, width: number) => page.getByRole("button", { name: width < 1024 ? /^Save$/ : /^Save draft$/i });

async function showIdentity(page: Page, width: number) {
  if (width < 1024) {
    const toggle = page.getByRole("button", { name: /^Identity\b/ });
    await expect(toggle).toBeVisible();
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  for (const name of ["ownerFullName", "storeName"] as const) {
    await expect(identityField(page, name)).toHaveCount(1);
    await expect(visibleIdentityField(page, name)).toBeEditable();
  }
}

async function expectIdentity(page: Page, values: Identity) {
  for (const name of ["ownerFullName", "storeName"] as const) {
    await expect(visibleIdentityField(page, name)).toHaveValue(values[name]);
  }
}

async function editIdentity(page: Page, values: Identity) {
  for (const name of ["ownerFullName", "storeName"] as const) {
    const input = visibleIdentityField(page, name);
    await input.click();
    await expect(input).toBeFocused();
    await input.fill(values[name]);
    await expect(input).toHaveValue(values[name]);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
  })).toBeLessThanOrEqual(1);
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

for (const width of [320, 390, 1440]) {
  test(`onboarding at ${width}px edits, resizes, and resumes the exact saved draft`, async ({ page, context }, info) => {
    const fixture = await installFixtures(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture.origin + onboardingPath);
    await showIdentity(page, width);
    await expectIdentity(page, draftIdentity);
    await expect(submitButton(page)).toBeDisabled();
    await expectNoHorizontalOverflow(page);

    const values = { ownerFullName: "Edited Test Owner", storeName: "Edited Test Store" };
    await editIdentity(page, values);
    await capture(page, info, `draft-edit-${width}`);

    const resizedWidth = width < 1024 ? 1440 : 390;
    await page.setViewportSize({ width: resizedWidth, height: 900 });
    await showIdentity(page, resizedWidth);
    await expectIdentity(page, values);
    await expectNoHorizontalOverflow(page);
    expect(fixture.submitted).toEqual([]);

    const saved = { ...values, storeName: "Resized Test Store" };
    await editIdentity(page, saved);
    const response = page.waitForResponse((result) =>
      new URL(result.url()).pathname === applicationPath && result.request().method() === "PATCH");
    await saveButton(page, resizedWidth).click();
    expect((await response).ok()).toBe(true);
    await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
    expect(fixture.submitted).toEqual([expect.objectContaining(saved)]);

    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await showIdentity(page, width);
    await expectIdentity(page, saved);
    await expect(submitButton(page)).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    expect(fixture.unexpectedWrites).toEqual([]);
    await capture(page, info, `draft-resumed-${width}`);
  });
}

for (const [width, field, value, message] of [
  [390, "businessPhone", "invalid-phone", "Enter a valid phone number."],
  [320, "businessEmail", "invalid-email", "Enter a valid email address."],
  [1440, "businessEmail", "invalid-email", "Enter a valid email address."],
] as const) {
  test(`invalid ${field} shows its error without sending a mutation at ${width}px`, async ({ page, context }, info) => {
    const fixture = await installFixtures(context, true);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(fixture.origin + onboardingPath);
    await showIdentity(page, width);
    await expect(submitButton(page)).toBeEnabled();
    const input = page.locator(`input[name="${field}"]`);
    await input.fill(value);
    const identityToggle = page.getByRole("button", { name: /^Identity\b/ });
    if (width < 1024) {
      await identityToggle.click();
      await expect(identityToggle).toHaveAttribute("aria-expanded", "false");
    }
    await submitButton(page).click();
    if (width < 1024) await expect(identityToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`label:has(input[name="${field}"])`).getByText(message, { exact: true })).toBeVisible();
    await expect(input).toBeFocused();
    expect(fixture.submitted).toEqual([]);
    expect(fixture.unexpectedWrites).toEqual([]);

    // Record focus as evidence alongside the required email focus assertion.
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      return { name: element?.getAttribute("name") ?? null, tag: element?.tagName ?? null };
    });
    await info.attach("validation-focus", { body: JSON.stringify({ invalidField: field, focus }), contentType: "application/json" });
    await capture(page, info, `invalid-${field}-${width}`);
  });
}
