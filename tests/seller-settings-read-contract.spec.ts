import { expect, test } from "@playwright/test";
import { settingsApi, type StoreSettings } from "../src/services/settings";
import { containAuditNetwork } from "./helpers/ui-audit-checks";

// Wire values from getMyVendorSettings; only the seller identity and contact data are synthetic.
const settings = {
  profile: { name: "Fixture Store", slug: "", logo: "", banner: "", description: "", category: "Electronics" },
  business: { ownerName: "Fixture Seller", phone: "", supportEmail: "support@example.invalid", address: "", city: "", country: "Zambia", taxNumber: "" },
  fulfillment: { deliveryEnabled: false, pickupEnabled: false, defaultDeliveryFee: 0, freeDeliveryThreshold: null, processingTimeDays: 1 },
  operations: { vacationMode: false, storefrontVisible: false, autoAcceptOrders: false, inventoryTracking: false, lowStockAlerts: false, autoReplyMessage: "", returnPolicy: "" },
  seo: { metaTitle: "", metaDescription: "", keywords: "" },
} satisfies StoreSettings;
const envelope = (value: unknown) => ({ status: "success", data: { settings: value } });
const endpoint = "/vendor/settings/me";

// Exercise the public service and real apiClient. Only fetch is replaced; no URL is contacted.
async function read(payload: unknown) {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    requests.push(`${req.method} ${url.pathname.slice(-endpoint.length)}${url.search}`);
    return Response.json(payload);
  };
  try {
    return await settingsApi.fetchSettings();
  } finally {
    globalThis.fetch = original;
    expect.soft(requests).toEqual([`GET ${endpoint}`]);
  }
}

test("reads the controller envelope and tolerates additive fields without losing valid values", async () => {
  const payload = envelope({ ...settings, futureSection: {}, business: { ...settings.business, extra: true } });
  const actual = await read({ ...payload, requestReference: "fixture" });
  // No-image wire strings have historically been normalized to null. Either represents no image.
  expect({ ...actual, profile: { ...actual.profile, logo: actual.profile.logo ?? "", banner: actual.profile.banner ?? "" } })
    .toMatchObject(settings);
  const varied = { ...settings, fulfillment: { ...settings.fulfillment, pickupEnabled: true, freeDeliveryThreshold: 0, defaultDeliveryFee: 25 } };
  expect((await read(envelope(varied))).fulfillment).toEqual(varied.fulfillment);
});

for (const [name, payload] of Object.entries({
  bare: settings, unwrapped: { status: "success", data: settings }, noStatus: { data: { settings } },
  failed: { ...envelope(settings), status: "fail" }, nullData: { status: "success", data: null }, arraySettings: envelope([]),
})) {
  test(`rejects invalid response envelope: ${name}`, async () => {
    await expect(read(payload)).rejects.toThrow();
  });
}

for (const [section, fields] of Object.entries(settings)) {
  test(`requires the ${section} object and every typed field`, async () => {
    const remaining = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== section));
    await expect(read(envelope(remaining))).rejects.toThrow();
    await expect(read(envelope({ ...settings, [section]: [] }))).rejects.toThrow();
    for (const field of Object.keys(fields)) {
      await test.step(`${section}.${field}`, async () => {
        const others = Object.fromEntries(Object.entries(fields).filter(([key]) => key !== field));
        await expect(read(envelope({ ...settings, [section]: others }))).rejects.toThrow();
        await expect(read(envelope({ ...settings, [section]: { ...fields, [field]: {} } }))).rejects.toThrow();
      });
    }
  });
}

const origin = "http://127.0.0.1:3398";
test.use({ channel: "chrome", serviceWorkers: "block", viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [] }, launchOptions: { args: [
      "--disable-background-networking", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    ] } });
test.describe("seller settings in Chrome", () => {
  test.skip(process.env.TEST_BASE_URL !== origin, "Requires the isolated frontend on port 3398.");
  for (const width of [320, 1440])
  test(`verified seller can retry an invalid success without any mutation at ${width}px`, async ({ context, page }, info) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    const user = { id: "fixture-seller", firstName: "Fixture", lastName: "Seller", email: "seller@example.invalid", role: "VENDOR", emailVerified: true, isActive: true };
    const application = { id: "fixture-application", userId: user.id, sellerType: "INDIVIDUAL", status: "APPROVED",
      ownerFullName: settings.business.ownerName, storeName: settings.profile.name, legalBusinessName: settings.profile.name,
      productCategories: ["Electronics"], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
    const denied: string[] = [];
    const diagnostic = "FIXTURE_INTERNAL_SETTINGS_DIAGNOSTIC";
    let reads = 0;
    let recover = false;
    await containAuditNetwork(context, [origin]);
    await context.route("**/*", route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "GET") {
        if (!/^\/api(?:\/|$)/.test(url.pathname)) return route.fallback();
        if (url.origin === origin && !url.search) {
          if (url.pathname === "/api/backend/user/me") return route.fulfill({ json: { status: "success", data: { user } } });
          if (url.pathname === "/api/backend/vendor/applications/me") return route.fulfill({ json: { status: "success", data: { application } } });
          if (url.pathname === `/api/backend${endpoint}`) {
            reads++;
            return route.fulfill({ json: envelope(recover ? settings : { ...settings, business: diagnostic }) });
          }
        }
      }
      denied.push(`${request.method()} ${url.pathname}`);
      return route.abort("blockedbyclient");
    });
    await page.goto(`${origin}/seller/settings`);
    if (width === 320) await expect(page.getByRole("banner").getByRole("heading", { name: settings.profile.name })).toBeVisible();
    else await expect(page.getByRole("link", { name: "Open seller settings" })).toContainText("Approved seller");
    await expect(page.getByRole("heading", { name: "Settings could not load" })).toBeVisible();
    await expect(page.getByText(/Zogular could not load your seller settings right now/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(diagnostic);
    await expect(page.getByRole("heading", { name: "Store Profile & Settings" })).toHaveCount(0);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
    await page.screenshot({ path: info.outputPath("settings-error.png") });
    expect(reads).toBe(1);
    recover = true;
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect(page.getByRole("heading", { name: "Store Profile & Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings could not load" })).toHaveCount(0);
    await page.getByRole("button", { name: "Business Info" }).click();
    const email = page.locator('input[type="email"]');
    await expect(email).toHaveValue(settings.business.supportEmail);
    await expect(email).not.toBeEditable();
    await email.scrollIntoViewIfNeeded();
    await expect(email).toBeInViewport();
    await expect(page.locator('input[type="tel"]')).not.toBeEditable();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
    await page.screenshot({ path: info.outputPath("settings-recovered.png") });
    expect(reads).toBe(2);
    expect(denied).toEqual([]);
  });
});
