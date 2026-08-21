import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const repoRoot = path.resolve(__dirname, "..");
const browserBaseUrl = process.env.TEST_BASE_URL;

function readSource(filePath: string): string {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

const accountLayoutSource = readSource("src/app/(consumer)/account/layout.tsx");
const authHookSource = readSource("src/hooks/use-auth-session.ts");
const authServiceSource = readSource("src/services/auth.ts");

function userPayload() {
  return {
    status: "success",
    data: {
      user: {
        id: "buyer-1",
        firstName: "Buyer",
        lastName: "One",
        email: "buyer@example.test",
        role: "buyer",
      },
    },
  };
}

function emptyOrdersPayload() {
  return {
    status: "success",
    results: 0,
    data: { orders: [] },
    pagination: { total: 0, page: 1, limit: 100, pages: 0 },
  };
}

function emptyWishlistPayload() {
  return {
    status: "success",
    results: 0,
    data: { items: [] },
    pagination: { total: 0, page: 1, limit: 100, pages: 0 },
  };
}

function emptyCartPayload() {
  return {
    status: "success",
    data: {
      cart: {
        id: "00000000-0000-4000-8000-000000000001",
        items: [],
        summary: {
          totalItems: 0,
          uniqueItems: 0,
          subtotal: 0,
        },
      },
    },
  };
}

async function installAccountRoutes(
  page: Page,
  userMe: (route: Route) => Promise<void>,
  missingBackendPaths: string[] = [],
) {
  await page.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    const backendPath = url.pathname.replace("/api/backend", "");

    if (backendPath === "/user/me") return userMe(route);
    if (backendPath === "/orders") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyOrdersPayload()) });
    }
    if (backendPath === "/user/addresses") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { addresses: [] } }) });
    }
    if (backendPath === "/wishlist") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyWishlistPayload()) });
    }
    if (backendPath === "/cart") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyCartPayload()) });
    }
    if (backendPath === "/categories") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", results: 0, data: { categories: [] } }) });
    }
    if (backendPath === "/auth/csrf-token") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "csrf" } }) });
    }
    if (backendPath === "/auth/refresh-token") {
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
    }

    missingBackendPaths.push(backendPath);
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: `Fixture route missing: ${backendPath}` }) });
  });
}

test("account auth gate has a bounded unavailable state and safe recovery copy", () => {
  expect(authHookSource).toContain("AUTH_GATE_TIMEOUT_MS = 6_000");
  expect(authServiceSource).toContain("timeout?: number");
  expect(authServiceSource).toContain("timeout: options.timeout");
  expect(authHookSource).toContain("getCurrentUser({ persist: false, timeout: AUTH_GATE_TIMEOUT_MS })");

  expect(accountLayoutSource).toContain("Account could not load");
  expect(accountLayoutSource).toContain("Zogular could not check your account right now.");
  expect(accountLayoutSource).toContain("Retry");
  expect(accountLayoutSource).toContain("Sign in");
  expect(accountLayoutSource).not.toContain("session expired");
  expect(accountLayoutSource.indexOf('auth.status !== "authenticated"')).toBeLessThan(accountLayoutSource.indexOf("My Account"));
});

test.describe("account auth gate browser behavior", () => {
  test.skip(!browserBaseUrl, "TEST_BASE_URL is required for browser route checks.");

  test("authenticated, unauthenticated, outage, retry, malformed, and responsive states are safe", async ({ browser }) => {
    const diagnostics: string[] = [];
    const missingBackendPaths: string[] = [];

    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
      page.on("pageerror", (error) => diagnostics.push(error.message));

      await installAccountRoutes(page, async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload()) });
      }, missingBackendPaths);
      await page.goto(`${browserBaseUrl}/account`, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Welcome back, Buyer!" })).toBeVisible();
      await expect(page.getByRole("main").getByText("My Account", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.close();
    }

    const guestPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installAccountRoutes(guestPage, async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
    }, missingBackendPaths);
    await guestPage.goto(`${browserBaseUrl}/account/saved`);
    await expect(guestPage).toHaveURL(/\/auth\/login\?next=%2Faccount%2Fsaved/);
    await expect(guestPage.getByText("Account could not load")).toHaveCount(0);
    await expect(guestPage.getByText(/session expired/i)).toHaveCount(0);
    await guestPage.close();

    let retryAttempts = 0;
    const retryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installAccountRoutes(retryPage, async (route) => {
      retryAttempts += 1;
      if (retryAttempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Service unavailable" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload()) });
    }, missingBackendPaths);
    await retryPage.goto(`${browserBaseUrl}/account`, { waitUntil: "domcontentloaded" });
    await expect(retryPage.getByRole("heading", { name: "Account could not load" })).toBeVisible();
    await expect(retryPage.getByRole("main").getByText("My Account", { exact: true })).toHaveCount(0);
    await retryPage.getByRole("button", { name: "Retry" }).click();
    await expect(retryPage.getByRole("heading", { name: "Welcome back, Buyer!" })).toBeVisible();
    await retryPage.close();

    const malformedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installAccountRoutes(malformedPage, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: {} }) });
    }, missingBackendPaths);
    await malformedPage.goto(`${browserBaseUrl}/account`, { waitUntil: "domcontentloaded" });
    await expect(malformedPage.getByRole("heading", { name: "Account could not load" })).toBeVisible();
    expect(await malformedPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await malformedPage.close();

    const timeoutPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installAccountRoutes(timeoutPage, async () => {
      // Keep the auth request pending so the hook's bounded timeout must resolve the gate.
    }, missingBackendPaths);
    await timeoutPage.goto(`${browserBaseUrl}/account`, { waitUntil: "domcontentloaded" });
    await expect(timeoutPage.getByRole("heading", { name: "Account could not load" })).toBeVisible({ timeout: 8_500 });
    await expect(timeoutPage.getByText("Checking your account…")).toHaveCount(0);
    await expect(timeoutPage.getByRole("main").getByText("My Account", { exact: true })).toHaveCount(0);
    await timeoutPage.close();

    expect(missingBackendPaths).toEqual([]);
    expect(diagnostics).toEqual([]);
  });
});
