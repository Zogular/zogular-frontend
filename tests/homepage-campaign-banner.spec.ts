import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { campaignImagePathSchema, homepageBannerCopyShape } from "../src/services/homepage-banners";
import { auditPageLayout, containAuditNetwork } from "./helpers/ui-audit-checks";

const app = "http://127.0.0.1:3281";
const api = "http://127.0.0.1:5081/api/v1";
const adminEndpoint = "/api/v1/admin/content/homepage-banners";
const enabled = process.env.HOMEPAGE_CAMPAIGN_LOCAL_FIXTURE === "1";
test.use({ serviceWorkers: "block", channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
const csrf = "banner-fixture-csrf";
const rejected = { status: "fail", message: "fixture-internal-detail" };
const asset = { key: "test-crops", mobileSrc: "/images/campaigns/test-mobile.png", desktopSrc: "/images/campaigns/test-desktop.png" };
const campaign = { headline: "Fixture campaign", description: "A test-only editorial banner.", ctaLabel: "Browse categories", href: "/categories", mobileSrc: asset.mobileSrc, desktopSrc: asset.desktopSrc };
const fixtureImages = new Map([
  [asset.mobileSrc, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPQSvDQSvBggFAAFo4DSTrXNE0AAAAASUVORK5CYII=", "base64")],
  [asset.desktopSrc, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWMwi8w0i8xkgFAAGmID4ZrWdxoAAAAASUVORK5CYII=", "base64")],
]);
const imagePath = (url: URL) => url.searchParams.get("url") ?? url.pathname;

type FixtureBanner = {
  id: string; headline: string; description: string | null; ctaLabel: string; destination: string;
  assetKey: string; startsAt: string; endsAt: string; state: string; version: number;
};

function initialState() {
  return {
    mode: "active" as "active" | "empty" | "unavailable" | "malformed",
    assets: [asset], items: [] as FixtureBanner[], listStatus: 200, allowContent: true, conflict: false,
    writes: [] as { method: string; pathname: string; body: Record<string, unknown> }[],
  };
}

let state = initialState();
let fixture: Server | undefined;
let next: ChildProcess | undefined;

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const { pathname } = new URL(req.url ?? "/", api);
  const method = req.method ?? "GET";
  const ok = (data: unknown) => send(res, 200, { status: "success", data });
  if (pathname === "/api/v1/user/me") {
    return ok({ user: { id: "fixture-admin", name: "Fixture Reviewer", email: "reviewer@example.test", role: "SUPER_ADMIN", permissions: state.allowContent ? ["access_admin_panel", "manage_content"] : ["access_admin_panel"] } });
  }
  if (pathname === "/api/v1/auth/csrf-token") {
    res.setHeader("Set-Cookie", `_csrf=${csrf}; Path=/; HttpOnly; SameSite=Lax`);
    res.setHeader("X-CSRF-Token", csrf);
    return ok({ csrfToken: csrf });
  }
  if (pathname === "/api/v1/categories") return ok({ categories: [] });
  if (pathname === "/api/v1/products/new-arrivals") return ok({ products: [] });
  if (pathname === "/api/v1/products") {
    return send(res, 200, { status: "success", results: 0, pagination: { page: 1, limit: 10, total: 0, pages: 0 }, data: { products: [] } });
  }
  if (pathname === "/api/v1/content/homepage-banner") {
    if (state.mode === "unavailable") return send(res, 503, rejected);
    return ok({ banner: state.mode === "empty" ? null : state.mode === "malformed" ? { ...campaign, href: "https://invalid.example.test" } : campaign });
  }
  if (pathname === adminEndpoint && method === "GET") {
    return state.listStatus === 200 ? ok({ items: state.items, assets: state.assets }) : send(res, state.listStatus, rejected);
  }
  if (pathname === adminEndpoint || pathname.startsWith(`${adminEndpoint}/`)) {
    if (req.headers["x-csrf-token"] !== csrf || !req.headers.cookie?.includes(`_csrf=${csrf}`)) return send(res, 403, rejected);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    state.writes.push({ method, pathname, body });
    if (state.conflict) return send(res, 409, rejected);
    if (pathname === adminEndpoint && method === "POST") {
      const banner: FixtureBanner = { ...body, id: "draft-1", state: "DRAFT", version: 1 };
      state.items = [banner];
      return ok({ banner });
    }
    const current = state.items[0];
    if (!current || body.version !== current.version) return send(res, 409, rejected);
    const banner = { ...current, ...(method === "PATCH" ? body : {}), state: pathname.endsWith("/publish") ? "PUBLISHED" : pathname.endsWith("/pause") ? "PAUSED" : current.state, version: current.version + 1 };
    state.items = [banner];
    return ok({ banner });
  }
  return send(res, 404, rejected);
}

test("campaign frontend schema matches the backend copy and asset limits", () => {
  expect(campaignImagePathSchema.safeParse(asset.mobileSrc).success).toBe(true);
  for (const src of ["/images/campaigns/File.png", "/images/campaigns/a.b.png", "/images/campaigns/../file.png", "/images/discovery/hero.webp", "/images/campaigns/file.png?x=1", `/images/campaigns/${"a".repeat(240)}.png`]) {
    expect(campaignImagePathSchema.safeParse(src).success, src).toBe(false);
  }
  for (const [field, limit] of [["headline", 120], ["description", 300], ["ctaLabel", 40]] as const) {
    expect(homepageBannerCopyShape[field].safeParse("x".repeat(limit)).success).toBe(true);
    expect(homepageBannerCopyShape[field].safeParse("x".repeat(limit + 1)).success).toBe(false);
  }
});

test.describe("loopback campaign UI", () => {
  test.skip(!enabled, "Requires an isolated loopback production build.");
  test.describe.configure({ mode: "default", timeout: 60_000 });

  test.beforeAll(async () => {
    fixture = createServer((req, res) => { void handle(req, res).catch(() => send(res, 500, rejected)); });
    fixture.listen(5081, "127.0.0.1");
    await once(fixture, "listening");
    next = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3281"], {
      cwd: resolve(__dirname, ".."),
      env: { ...process.env, ADMIN_API_URL: api, INTERNAL_BACKEND_URL: api, NEXT_PUBLIC_API_URL: api, NEXT_PUBLIC_API_PROXY_URL: "/api/backend", ADMIN_AUTH_SESSION_ENDPOINT: "/user/me", NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    for (const stream of [next.stdout, next.stderr]) stream?.on("data", (data) => { logs = (logs + data).slice(-3000); });
    for (let attempt = 0; attempt < 60 && next.exitCode === null; attempt++) {
      const ready = await fetch(`${app}/admin/login`, { signal: AbortSignal.timeout(500) }).catch(() => null);
      if (ready?.ok) return;
      await new Promise((done) => setTimeout(done, 250));
    }
    throw new Error(`Loopback campaign app did not start. Build first.\n${logs}`);
  });

  test.afterAll(async () => {
    if (next?.pid && next.exitCode === null && next.signalCode === null) {
      const closed = once(next, "exit");
      next.kill();
      await closed;
    }
    if (fixture?.listening) {
      const closed = once(fixture, "close");
      fixture.close();
      fixture.closeAllConnections();
      await closed;
    }
  });

  test.beforeEach(async ({ context, page }) => {
    state = initialState();
    await containAuditNetwork(context, [app]);
    await page.route((url) => url.origin === app && fixtureImages.has(imagePath(url)),
      (route) => route.fulfill({ contentType: "image/png", body: fixtureImages.get(imagePath(new URL(route.request().url()))) }));
  });

  test("homepage chooses one responsive campaign or the editorial fallback", async ({ page }, testInfo) => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto(app);
      const banner = page.getByTestId("home-campaign-banner");
      await expect(banner.getByRole("heading", { name: campaign.headline })).toBeVisible();
      await expect(banner.getByRole("link", { name: campaign.ctaLabel })).toHaveAttribute("href", "/categories");
      await expect(page.getByTestId("home-editorial-intro")).toHaveCount(0);
      await expect.poll(() => banner.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth ? new URL(image.currentSrc).searchParams.get("url") : null))
        .toBe(viewport.width < 768 ? asset.mobileSrc : asset.desktopSrc);
      await auditPageLayout(page);
      await page.screenshot({ path: testInfo.outputPath(`campaign-${viewport.width}.png`), animations: "disabled" });
    }
    for (const mode of ["empty", "unavailable", "malformed"] as const) {
      state.mode = mode;
      await page.reload();
      await expect(page.getByTestId("home-editorial-intro")).toBeVisible();
      await expect(page.getByTestId("home-campaign-banner")).toHaveCount(0);
    }
    state.mode = "active";
    await page.route((url) => url.origin === app && imagePath(url) === asset.desktopSrc, (route) => route.fulfill({ status: 404 }));
    const imageFailure = page.waitForResponse((response) => imagePath(new URL(response.url())) === asset.desktopSrc && response.status() === 404);
    await page.reload();
    await imageFailure;
    await expect(page.getByTestId("home-editorial-intro")).toBeVisible();
    await expect(page.getByTestId("home-campaign-banner")).toHaveCount(0);
  });

  test("authorized admin saves a draft and sends versioned publication actions", async ({ context, page }, testInfo) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${app}/admin/content`);
    await expect(page.getByRole("link", { name: "Content and Merchandising", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByLabel("Headline").fill("Fixture draft");
    await page.getByLabel("Button label").fill("Shop products");
    await page.getByLabel("Destination").selectOption("products");
    await page.getByLabel("Approved image set").selectOption(asset.key);
    await page.getByLabel("Starts (Lusaka time)").fill("2026-12-01T10:30");
    await page.getByLabel("Ends (Lusaka time)").fill("2026-12-02T10:30");
    await page.screenshot({ path: testInfo.outputPath("admin-draft-1440.png"), animations: "disabled", fullPage: true });
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: "Fixture draft" })).toBeVisible();
    expect(state.writes[0]).toMatchObject({ method: "POST", pathname: adminEndpoint, body: { destination: "products", assetKey: asset.key, description: null, startsAt: "2026-12-01T08:30:00.000Z", endsAt: "2026-12-02T08:30:00.000Z" } });
    await page.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Headline").fill("Fixture updated draft");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: "Fixture updated draft" })).toBeVisible();
    expect(state.writes[1]).toMatchObject({ method: "PATCH", body: { version: 1, headline: "Fixture updated draft" } });
    state.conflict = true;
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/schedule overlaps/)).toBeVisible();
    await expect(page.getByText("fixture-internal-detail")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    state.conflict = false;
    await page.getByRole("button", { name: "Reload banners" }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByText("Banner paused.", { exact: true })).toBeVisible();
    expect(state.writes.slice(2)).toEqual([
      { method: "POST", pathname: `${adminEndpoint}/draft-1/publish`, body: { version: 2 } },
      { method: "POST", pathname: `${adminEndpoint}/draft-1/publish`, body: { version: 2 } },
      { method: "POST", pathname: `${adminEndpoint}/draft-1/pause`, body: { version: 3 } },
    ]);
  });

  test("admin distinguishes missing assets, upstream failure, and denied permission", async ({ context, page }, testInfo) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.setViewportSize({ width: 390, height: 844 });
    state.assets = [];
    await page.goto(`${app}/admin/content`);
    await expect(page.getByText(/No approved image sets/)).toBeVisible();
    await expect(page.getByRole("button", { name: "New draft" })).toBeDisabled();
    await auditPageLayout(page);
    await page.screenshot({ path: testInfo.outputPath("admin-no-assets-390.png"), animations: "disabled" });
    state.listStatus = 503;
    await page.reload();
    await expect(page.getByRole("alert").filter({ hasText: "Banners could not be loaded." })).toBeVisible();
    await expect(page.getByText("No homepage banners yet.")).toHaveCount(0);
    await expect(page.getByText("fixture-internal-detail")).toHaveCount(0);
    state.listStatus = 200;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText(/No approved image sets/)).toBeVisible();
    state.allowContent = false;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Homepage banners", exact: true })).toHaveCount(0);
  });
});
