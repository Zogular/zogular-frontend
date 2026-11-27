import { expect, test, type BrowserContext } from "@playwright/test";

// The app must be started separately against a synthetic loopback admin session fixture.
const origin = process.env.A5_SYNTHETIC_REVIEW_ORIGIN;
const productId = "00000000-0000-4000-8000-000000000051";
const revisionId = "00000000-0000-4000-8000-000000000052";
const queue = "/api/backend/admin/products/listing-revisions";
const detail = `/api/backend/admin/products/${productId}/listing-revisions/${revisionId}`;
const product = { id: productId, listingVersion: 3, title: "Current fixture lamp",
  description: "The current listing description.", price: 120, salePrice: null };
const entry = { id: revisionId, productId, baseVersion: 3,
  createdAt: "2026-11-20T08:05:00.000Z", status: "PENDING_REVIEW" };
const revision = { ...entry, payload: { schemaVersion: 1, title: "Proposed fixture lamp",
  description: "The proposed listing description.", price: 140, salePrice: null },
sellerVisibleReason: null, decidedAt: null };

test.use({ channel: "chrome", serviceWorkers: "block", launchOptions: { args: [
  "--disable-background-networking", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
] } });
test.skip(!origin, "Requires an isolated frontend with a synthetic admin session fixture.");

async function prepare(context: BrowserContext) {
  if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
    throw new Error("A synthetic HTTP loopback origin is required.");
  }
  await context.addCookies([{ name: "zogular_admin_session", value: "a5-fixture-only", url: origin }]);
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort("blockedbyclient"));
  const hmr = `ws://${new URL(origin).host}/_next/hmr`;
  await context.routeWebSocket("**/*", (socket) =>
    socket.url().split("?")[0] === hmr ? void socket.connectToServer() : socket.close());
  return origin;
}

for (const width of [390, 1440]) {
  test(`a conflict forces a fresh read without replay at ${width}px`, async ({ context, page }, testInfo) => {
    const app = await prepare(context);
    await page.setViewportSize({ width, height: 900 });
    let detailReads = 0;
    const writes: unknown[] = [];
    let closed = false;
    await page.route((url) => url.pathname === queue, (route) => route.fulfill({
      json: { status: "success", data: { items: closed ? [] : [{ ...entry, product: {
        title: product.title, listingVersion: product.listingVersion,
      } }], nextCursor: null } },
    }));
    await page.route((url) => url.pathname === detail, (route) => {
      detailReads++;
      return route.fulfill({ json: { status: "success", data: {
        product: { ...product, listingVersion: writes.length === 0 ? 3 : 4 }, revision,
      } } });
    });
    await page.route("**/api/backend/auth/csrf-token", (route) => route.fulfill({
      json: { status: "success", data: { csrfToken: "a5-synthetic-csrf" } },
    }));
    await page.route((url) => url.pathname === `${detail}/decisions`, (route) => {
      expect(route.request().method()).toBe("POST");
      const decision = route.request().postDataJSON();
      writes.push(decision);
      if (decision.decision === "needs_changes") {
        closed = true;
        return route.fulfill({ json: { status: "success", data: { revision: {
          ...revision, status: "NEEDS_CHANGES", sellerVisibleReason: decision.reason, decidedAt: entry.createdAt,
        } } } });
      }
      return route.fulfill({ status: 409, json: { status: "fail", message: "internal fixture canary" } });
    });
    await page.goto(`${app}/admin/products`);
    await expect(page.getByRole("heading", { name: "Product Moderation" })).toBeVisible();
    await page.getByRole("button", { name: "Review revision" }).click();
    const dialog = page.getByRole("dialog", { name: "Review listing revision" });
    await expect(dialog.getByText("Proposed fixture lamp")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Approve revision" })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "Confirm applying the proposed values to the listing" }).check();
    const readsBeforeDecision = detailReads;
    await dialog.getByRole("button", { name: "Approve revision" }).click();
    await expect(dialog.getByText("Current version 4 / submitted against version 3")).toBeVisible();
    await expect(dialog.getByText("The listing version has changed. This revision cannot be approved.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Approve revision" })).toBeDisabled();
    await expect(dialog.getByText("internal fixture canary")).toHaveCount(0);
    expect(detailReads).toBe(readsBeforeDecision + 1);
    expect(writes).toEqual([{ decision: "approve" }]);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("revision-conflict.png"), animations: "disabled" });
    const requestChanges = dialog.getByRole("button", { name: "Request changes" });
    await expect(requestChanges).toBeDisabled();
    await dialog.getByLabel("Reason for requesting changes").fill("Please submit against the current listing.");
    await expect(requestChanges).toBeEnabled();
    await requestChanges.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Changes requested.", { exact: true })).toBeVisible();
    await expect(page.getByText("No pending revisions.")).toBeVisible();
    expect(writes).toEqual([{ decision: "approve" }, {
      decision: "needs_changes", reason: "Please submit against the current listing.",
    }]);
  });
}
