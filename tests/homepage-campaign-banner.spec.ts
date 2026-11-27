import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { campaignImagePathSchema, homepageBannerCopyShape } from "../src/services/homepage-banners";
import { auditPageLayout, containAuditNetwork } from "./helpers/ui-audit-checks";

const app = "http://127.0.0.1:3281";
const api = "http://127.0.0.1:5081/api/v1";
const adminEndpoint = "/api/v1/admin/content/homepage-banners";
const enabled = process.env.HOMEPAGE_CAMPAIGN_LOCAL_FIXTURE === "1";
test.use({ serviceWorkers: "block", channel: "chrome", launchOptions: { args: [
  "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
] } });
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
    assets: [asset], items: [] as FixtureBanner[], listStatus: 200, allowContent: true, conflict: false, listReads: 0,
    writes: [] as { method: string; pathname: string; body: Record<string, unknown> }[],
  };
}

let state = initialState();
let fixture: Server | undefined;
let next: ChildProcess | undefined;

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "private, No-StOrE" });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const { pathname } = new URL(req.url ?? "/", api);
  const method = req.method ?? "GET";
  const ok = (data: unknown) => send(res, 200, { status: "success", data });
  if (pathname === adminEndpoint && method === "GET") state.listReads++;
  if ((pathname === adminEndpoint || pathname.startsWith(adminEndpoint + "/")) &&
      (!state.allowContent || req.headers.authorization !== "Bearer fixture-token")) return send(res, 403, rejected);
  if (pathname === "/api/v1/user/me") {
    if (req.headers.authorization !== "Bearer fixture-token") return send(res, 401, rejected);
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
    const root = realpathSync.native(resolve(__dirname, ".."));
    if (dirname(root) !== realpathSync.native(tmpdir()) || !basename(root).startsWith("zg-campaign-chrome-") ||
        process.env.ADMIN_API_URL !== api || process.env.INTERNAL_BACKEND_URL !== api || process.env.NEXT_PUBLIC_API_URL !== api)
      throw new Error("Requires a private temporary build pinned to the loopback fixture");
    fixture = createServer((req, res) => { void handle(req, res).catch(() => send(res, 500, rejected)); });
    fixture.listen(5081, "127.0.0.1");
    await once(fixture, "listening");
    // IPC readiness is emitted only after this process owns the listener. Never probe an unknown app.
    next = spawn(process.execPath, ["-e", `
      const app = require("next")({ dev: false, hostname: "127.0.0.1", port: 3281 });
      app.prepare().then(() => {
        const http = require("node:http").createServer(app.getRequestHandler());
        process.once("disconnect", async () => { http.close(); http.closeAllConnections(); await app.close(); process.exit(0); });
        http.listen(3281, "127.0.0.1", () => process.send("ready"));
      });
    `], {
      cwd: root,
      env: { ...process.env, ADMIN_API_URL: api, INTERNAL_BACKEND_URL: api, NEXT_PUBLIC_API_URL: api, NEXT_PUBLIC_API_PROXY_URL: "/api/backend", ADMIN_AUTH_SESSION_ENDPOINT: "/user/me", NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true,
    });
    await Promise.race([once(next, "message").then(([message]) => expect(message).toBe("ready")),
      once(next, "exit").then(() => { throw new Error("Private frontend exited before binding"); })]);
  });

  test.afterAll(async () => {
    if (next?.pid && next.exitCode === null && next.signalCode === null) {
      const closed = once(next, "exit");
      next.disconnect();
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
      if (viewport.width === 1440) await expect(page.getByText("Sign In", { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`campaign-${viewport.width}.png`), animations: "disabled" });
      await banner.getByRole("link", { name: campaign.ctaLabel }).click();
      await expect(page).toHaveURL(app + "/categories");
      await expect(page.getByRole("heading", { name: "All Categories" })).toBeVisible();
    }
    for (const mode of ["empty", "unavailable", "malformed"] as const) {
      state.mode = mode;
      await page.goto(app);
      await expect(page.getByTestId("home-editorial-intro")).toBeVisible();
      await expect(page.getByTestId("home-campaign-banner")).toHaveCount(0);
      if (mode === "unavailable") await page.screenshot({ path: testInfo.outputPath("home-unavailable-1440.png"), animations: "disabled" });
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
    const listReply = page.waitForResponse(r => r.url() === app + "/api/backend/admin/content/homepage-banners" && r.status() === 200);
    await page.goto(`${app}/admin/content`);
    expect(await (await listReply).headerValue("cache-control")).toBe("no-store");
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
    const rejectedWrite = page.waitForResponse(r => r.url().endsWith("/draft-1/publish") && r.status() === 409);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    expect(await (await rejectedWrite).headerValue("cache-control")).toBe("no-store");
    await expect(page.getByText(/schedule overlaps/)).toBeVisible();
    await expect(page.getByText("fixture-internal-detail")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    expect(state.items).toMatchObject([{ headline: "Fixture updated draft", state: "DRAFT", version: 2 }]);
    await expect(page.getByText("Banner publication saved.", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("admin-conflict-1440.png"), animations: "disabled" });
    state.conflict = false;
    const freshList = page.waitForResponse(r => r.url() === app + "/api/backend/admin/content/homepage-banners" && r.status() === 200);
    await page.getByRole("button", { name: "Reload banners" }).click();
    await freshList;
    await expect(page.getByText("Draft · All products", { exact: true })).toBeVisible();
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
    const readsBeforeDenial = state.listReads;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Page unavailable", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Homepage banners", exact: true })).toHaveCount(0);
    expect(state.listReads).toBe(readsBeforeDenial);
    expect(state.writes).toEqual([]);
  });
});
