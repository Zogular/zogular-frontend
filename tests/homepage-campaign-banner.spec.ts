import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { adminContentApi, type HomepageBannerInput } from "../src/services/admin/content";
import { ApiError, resetApiClientSecurityStateForTests } from "../src/services/api";
import { campaignImagePathSchema, homepageBannerCopyShape } from "../src/services/homepage-banners";
import { auditPageLayout, containAuditNetwork } from "./helpers/ui-audit-checks";

const app = "http://127.0.0.1:3281";
const api = "http://127.0.0.1:5081/api/v1";
const adminEndpoint = "/api/v1/admin/content/homepage-banners";
const bannerId = "01cc7255-6deb-4ded-9b9c-bd472dc056f3";
const enabled = process.env.HOMEPAGE_CAMPAIGN_LOCAL_FIXTURE === "1";
test.use({ serviceWorkers: "block", channel: "chrome", launchOptions: { args: [
  "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
] } });
const csrf = "banner-fixture-csrf";
const rejected = { status: "fail", message: "fixture-internal-detail" };
const fixtureReviewers = {
  "Bearer fixture-token": { id: "295a6d68-5fbb-4c68-a5e7-8ba20afaa103", name: "Fixture Reviewer", email: "reviewer@example.test" },
  "Bearer fixture-second-token": { id: "be975a05-ab42-4bed-bce6-be38dc77c037", name: "Second Fixture Reviewer", email: "second-reviewer@example.test" },
  "Bearer fixture-no-id-token": { name: "Reviewer Without ID", email: "no-id@example.test" },
};
const fixtureActorHeader = "x-campaign-expected-actor";
const asset = { key: "test-crops", mobileSrc: "/images/campaigns/test-mobile.png", desktopSrc: "/images/campaigns/test-desktop.png" };
const campaign = { headline: "Fixture campaign", description: "A test-only editorial banner.", ctaLabel: "Browse categories", href: "/categories", mobileSrc: asset.mobileSrc, desktopSrc: asset.desktopSrc };
const fixtureImages = new Map([
  [asset.mobileSrc, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPQSvDQSvBggFAAFo4DSTrXNE0AAAAASUVORK5CYII=", "base64")],
  [asset.desktopSrc, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWMwi8w0i8xkgFAAGmID4ZrWdxoAAAAASUVORK5CYII=", "base64")],
]);
const imagePath = (url: URL) => url.searchParams.get("url") ?? url.pathname;
const adminPage = `${app}/admin/content`;

async function fillDraft(page: Page, headline: string, { open = true } = {}) {
  if (open) await page.getByRole("button", { name: "New draft" }).click();
  await page.getByLabel("Headline").fill(headline);
  await page.getByLabel("Button label").fill("Shop products");
  await page.getByLabel("Destination").selectOption("products");
  await page.getByLabel("Approved image set").selectOption(asset.key);
  await page.getByLabel("Starts (Lusaka time)").fill("2026-12-01T10:30");
  await page.getByLabel("Ends (Lusaka time)").fill("2026-12-02T10:30");
}

async function refreshMountedAdmin(page: Page) {
  // Refresh the protected server layout; AdminShell must receive the new verified identity.
  await page.evaluate(() => {
    const router = (window as Window & { next?: { router?: { refresh(): void } } }).next?.router;
    if (!router) throw new Error("The mounted Next App Router refresh entry point is unavailable.");
    router.refresh();
  });
}

type FixtureBanner = {
  id: string; headline: string; description: string | null; ctaLabel: string; destination: string;
  assetKey: string; startsAt: string; endsAt: string; state: string; version: number;
};

const fixtureDraft: HomepageBannerInput = {
  headline: "Existing fixture draft", description: null, ctaLabel: "Shop products", destination: "products",
  assetKey: asset.key, startsAt: "2026-12-01T08:30:00.000Z", endsAt: "2026-12-02T08:30:00.000Z",
};
const preconditionPayloads = ["typed", "bodyless", "text"] as const;
type PreconditionPayload = typeof preconditionPayloads[number];
type MountedPreconditionPayload = PreconditionPayload | "malformed-json";

function preconditionBody(payload: MountedPreconditionPayload) {
  if (payload === "typed") return { body: JSON.stringify(rejected), contentType: "application/json", details: rejected };
  if (payload === "text") return { body: rejected.message, contentType: "text/plain", details: rejected.message };
  if (payload === "malformed-json") return { body: `{${rejected.message}`, contentType: "application/json", details: undefined };
  return { body: null, contentType: undefined, details: "" };
}

function initialState() {
  return {
    mode: "active" as "active" | "empty" | "unavailable" | "malformed",
    assets: [asset], items: [] as FixtureBanner[], listStatus: 200, allowContent: true, conflict: false, listReads: 0,
    writeMode: "normal" as "normal" | "csrf-denied" | "denied" | "malformed-denial" | "unconfirmed-create" | "unconfirmed-edit" | "unconfirmed-edit-not-applied",
    actorPrecondition: undefined as 412 | 428 | undefined,
    actorPreconditionPayload: "typed" as MountedPreconditionPayload,
    beforeCsrfReply: undefined as Promise<void> | undefined,
    csrfReads: 0,
    listOmitsTarget: false,
    beforeCreateReply: undefined as Promise<void> | undefined,
    releasedCreateReplies: 0,
    mutationAttempts: 0,
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
  const authorization = req.headers.authorization;
  const reviewer = authorization === "Bearer fixture-token" || authorization === "Bearer fixture-second-token" || authorization === "Bearer fixture-no-id-token"
    ? fixtureReviewers[authorization] : undefined;
  const method = req.method ?? "GET";
  const ok = (data: unknown) => send(res, 200, { status: "success", data });
  if (pathname === adminEndpoint && method === "GET") state.listReads++;
  if ((pathname === adminEndpoint || pathname.startsWith(adminEndpoint + "/")) &&
      (!state.allowContent || !reviewer)) return send(res, 403, rejected);
  if (pathname === "/api/v1/user/me") {
    if (!reviewer) return send(res, 401, rejected);
    return ok({ user: { ...reviewer, role: "SUPER_ADMIN", permissions: state.allowContent ? ["access_admin_panel", "manage_content"] : ["access_admin_panel"] } });
  }
  if (pathname === "/api/v1/auth/csrf-token") {
    state.csrfReads++;
    await state.beforeCsrfReply;
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
    return state.listStatus === 200 ? ok({ items: state.listOmitsTarget ? [] : state.items, assets: state.assets }) : send(res, state.listStatus, rejected);
  }
  if (pathname === adminEndpoint || pathname.startsWith(`${adminEndpoint}/`)) {
    state.mutationAttempts++;
    if (req.headers["x-csrf-token"] !== csrf || !req.headers.cookie?.includes(`_csrf=${csrf}`)) return send(res, 403, rejected);
    const actor = req.headers[fixtureActorHeader];
    if (actor === undefined) return send(res, 428, rejected);
    if (typeof actor !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(actor)) return send(res, 400, rejected);
    if (!reviewer || !("id" in reviewer) || actor !== reviewer.id) return send(res, 412, rejected);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    state.writes.push({ method, pathname, body });
    if (state.actorPrecondition) {
      const { body: reply, contentType } = preconditionBody(state.actorPreconditionPayload);
      res.writeHead(state.actorPrecondition, {
        "Cache-Control": "no-store", ...(contentType ? { "Content-Type": contentType } : {}),
      });
      return res.end(reply ?? undefined);
    }
    if (state.writeMode === "csrf-denied") return send(res, 403, { status: "fail", message: "Invalid CSRF token. Please refresh the page and try again." });
    if (state.writeMode === "denied") return send(res, 403, { status: "fail", message: "fixture-internal-detail: Access denied for the CSRF settings permission." });
    if (state.writeMode === "malformed-denial") {
      res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end("{");
    }
    if (state.conflict) return send(res, 409, rejected);
    if (pathname === adminEndpoint && method === "POST") {
      const banner: FixtureBanner = { ...body, id: bannerId, state: "DRAFT", version: 1 };
      state.items = [banner];
      await state.beforeCreateReply;
      state.releasedCreateReplies++;
      if (state.writeMode === "unconfirmed-create") return send(res, 502, rejected);
      return send(res, 201, { status: "success", data: { banner } });
    }
    const current = state.items[0];
    if (!current || body.version !== current.version) return send(res, 409, rejected);
    if (state.writeMode === "unconfirmed-edit-not-applied") return send(res, 502, rejected);
    const banner = { ...current, ...(method === "PATCH" ? body : {}), state: pathname.endsWith("/publish") ? "PUBLISHED" : pathname.endsWith("/pause") ? "PAUSED" : current.state, version: current.version + 1 };
    state.items = [banner];
    if (state.writeMode === "unconfirmed-edit") return ok({ banner: { ...banner, version: banner.version + 1 } });
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

test("Campaign transport preserves 412 and 428 even without a typed failure envelope", async () => {
  const originalFetch = globalThis.fetch;
  const session = { expectedActor: fixtureReviewers["Bearer fixture-token"].id, signal: new AbortController().signal };
  const calls: string[] = [];
  let status: 412 | 428 = 412;
  let payload: PreconditionPayload = "typed";
  resetApiClientSecurityStateForTests();
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(init?.method ?? "GET");
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return Response.json({ status: "success", data: { csrfToken: csrf } });
    }
    expect(url.pathname).toMatch(new RegExp(`/admin/content/homepage-banners/${bannerId}$`));
    expect(new Headers(init?.headers).get(fixtureActorHeader)).toBe(session.expectedActor);
    const { body, contentType } = preconditionBody(payload);
    return new Response(body, { status, headers: contentType ? { "Content-Type": contentType } : undefined });
  };
  try {
    for (const outcome of [412, 428] as const) {
      status = outcome;
      for (const representation of preconditionPayloads) {
        payload = representation;
        const error = await adminContentApi.updateHomepageBanner(bannerId, 1, fixtureDraft, session)
          .then(() => undefined, (failure: unknown) => failure);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status, details: preconditionBody(payload).details });
      }
    }
    expect(calls).toEqual(["GET", "PATCH", "PATCH", "PATCH", "PATCH", "PATCH", "PATCH"]);
  } finally {
    globalThis.fetch = originalFetch;
    resetApiClientSecurityStateForTests();
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
    const rejectedWrite = page.waitForResponse(r => r.url() === `${app}/api/backend/admin/content/homepage-banners/${bannerId}/publish` && r.status() === 409);
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
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    expect(state.writes).toHaveLength(3);
    await page.getByRole("button", { name: "Use reviewed banner" }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByText("Banner paused.", { exact: true })).toBeVisible();
    expect(state.writes.slice(2)).toEqual([
      { method: "POST", pathname: `${adminEndpoint}/${bannerId}/publish`, body: { version: 2 } },
      { method: "POST", pathname: `${adminEndpoint}/${bannerId}/publish`, body: { version: 2 } },
      { method: "POST", pathname: `${adminEndpoint}/${bannerId}/pause`, body: { version: 3 } },
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

  test("unconfirmed create holds the visit and keeps a read-only copy even when the list fails", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(adminPage);
    await fillDraft(page, "Held fixture draft");
    state.writeMode = "unconfirmed-create";
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "New drafts are locked for this visit" })).toBeVisible();
    await expect(page.getByText("Draft saved.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("fixture-internal-detail")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New draft" })).toBeDisabled();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Reload banners" }).click();
    await expect(page.getByRole("heading", { name: "Held fixture draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New draft" })).toBeDisabled();
    state.listStatus = 503;
    await page.getByRole("button", { name: "Reload banners" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Banners could not be loaded." })).toBeVisible();
    await page.getByRole("button", { name: "View submitted draft" }).click();
    await expect(page.getByLabel("Headline")).toHaveValue("Held fixture draft");
    await expect(page.getByLabel("Headline")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New draft" })).toBeDisabled();
    expect(state.writes.map(({ method }) => method)).toEqual(["POST"]);

    // A new mount with the same verified persona does not inherit the held input or outcome.
    state.listStatus = 200;
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(page).toHaveURL(`${app}/admin/dashboard`);
    await page.goBack();
    await expect(page).toHaveURL(adminPage);
    await expect(page.getByRole("button", { name: "New draft" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "View submitted draft" })).toHaveCount(0);
    await page.getByRole("button", { name: "New draft" }).click();
    await expect(page.getByLabel("Headline")).toHaveValue("");
    expect(state.writes).toHaveLength(1);
  });

  test("late create confirmation cannot update a newly mounted editor for the same admin", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(adminPage);
    await fillDraft(page, "Earlier visit draft");
    let release!: () => void;
    state.beforeCreateReply = new Promise<void>((resolve) => { release = resolve; });
    try {
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect.poll(() => state.writes.length).toBe(1);
      await page.getByRole("link", { name: "Overview", exact: true }).click();
      await expect(page).toHaveURL(`${app}/admin/dashboard`);
      await page.goBack();
      await expect(page).toHaveURL(adminPage);
      await page.getByRole("button", { name: "New draft" }).click();
      await page.getByLabel("Headline").fill("New visit input");
      release();
      await expect.poll(() => state.releasedCreateReplies).toBe(1);
      await expect(page.getByLabel("Headline")).toHaveValue("New visit input");
      await expect(page.getByText("Draft saved.", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "View submitted draft" })).toHaveCount(0);
      expect(state.writes).toHaveLength(1);
    } finally {
      release();
    }
  });

  test("late create uncertainty cannot affect a different verified admin in the same document", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(adminPage);
    const profile = page.getByTestId("admin-profile-trigger");
    await expect(profile).toHaveAttribute("aria-label", "Open admin profile for Fixture Reviewer");
    const documentStart = await page.evaluate(() => performance.timeOrigin);
    await fillDraft(page, "First authority input");
    state.writeMode = "unconfirmed-create";
    let release!: () => void;
    state.beforeCreateReply = new Promise<void>((resolve) => { release = resolve; });
    try {
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect.poll(() => state.writes.length).toBe(1);
      await context.addCookies([{ name: "zogular_admin_session", value: "fixture-second-token", url: app }]);
      await refreshMountedAdmin(page);
      await expect(profile).toHaveAttribute("aria-label", "Open admin profile for Second Fixture Reviewer");
      await expect(page).toHaveURL(adminPage);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
      await page.getByRole("button", { name: "New draft" }).click();
      await expect(page.getByLabel("Headline")).toHaveValue("");
      await fillDraft(page, "Second authority input", { open: false });
      await expect(page.getByLabel("Approved image set")).toHaveValue(asset.key);
      expect(state.mutationAttempts).toBe(1);

      release();
      await expect.poll(() => state.releasedCreateReplies).toBe(1);
      await expect(page.getByLabel("Headline")).toHaveValue("Second authority input");
      await expect(page.getByLabel("Approved image set")).toHaveValue(asset.key);
      await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "View submitted draft" })).toHaveCount(0);
      await expect(page.getByText("New drafts are locked for this visit.", { exact: false })).toHaveCount(0);
      expect(state.writes).toHaveLength(1);
      expect(state.mutationAttempts).toBe(1);
    } finally {
      release();
    }
  });

  test("a verified admin change during CSRF preparation cancels the queued Campaign write", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.goto(adminPage);
    const profile = page.getByTestId("admin-profile-trigger");
    await expect(profile).toHaveAttribute("aria-label", "Open admin profile for Fixture Reviewer");
    const documentStart = await page.evaluate(() => performance.timeOrigin);
    let release!: () => void;
    state.beforeCsrfReply = new Promise<void>((resolve) => { release = resolve; });
    try {
      await fillDraft(page, "Cancelled before dispatch");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect.poll(() => state.csrfReads).toBe(1);
      expect(state.mutationAttempts).toBe(0);
      await context.addCookies([{ name: "zogular_admin_session", value: "fixture-second-token", url: app }]);
      await refreshMountedAdmin(page);
      await expect(profile).toHaveAttribute("aria-label", "Open admin profile for Second Fixture Reviewer");
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
      const prepared = page.waitForResponse(response => response.url() === `${app}/api/backend/auth/csrf-token` && response.status() === 200);
      release();
      await (await prepared).finished();
      await expect(page.getByLabel("Headline")).toHaveCount(0);
      await fillDraft(page, "Explicit new actor input");
      expect(state.mutationAttempts).toBe(0);
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
      expect(state.writes).toHaveLength(1);
      expect(state.mutationAttempts).toBe(1);
      expect(state.items.map(({ headline }) => headline)).toEqual(["Explicit new actor input"]);
    } finally {
      release();
    }
  });

  test("invalid edit receipt needs exact current readback and acknowledgment before another decision", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.goto(adminPage);
    await fillDraft(page, "Fixture draft");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Headline").fill("Changed after write");
    state.writeMode = "unconfirmed-edit";
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "We could not confirm whether the banner change completed." })).toBeVisible();
    await expect(page.getByText("Draft saved.", { exact: true })).toHaveCount(0);
    state.listOmitsTarget = true;
    await page.getByRole("button", { name: "Reload banners" }).click();
    await expect(page.getByText("The banner could not be verified in the latest list. It is still locked.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Use reviewed banner" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New draft" })).toBeDisabled();

    state.listOmitsTarget = false;
    await page.getByRole("button", { name: "Reload banners" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Latest banner: Changed after write" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    expect(state.writes.map(({ method }) => method)).toEqual(["POST", "PATCH"]);
    await expect(page.getByLabel("Headline")).toHaveValue("Changed after write");
    await expect(page.getByLabel("Headline")).toBeDisabled();
    await page.getByRole("button", { name: "Discard submitted edit", exact: true }).click();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "View submitted edit" })).toHaveCount(0);
    await page.getByRole("button", { name: "Use reviewed banner" }).click();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
    expect(state.writes).toHaveLength(2);
    state.writeMode = "normal";
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Banner publication saved.", { exact: true })).toBeVisible();
    expect(state.writes.at(-1)).toEqual({ method: "POST", pathname: `${adminEndpoint}/${bannerId}/publish`, body: { version: 2 } });
  });

  test("unconfirmed edit survives a failed list read and unchanged version until a deliberate new edit", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.goto(adminPage);
    await fillDraft(page, "Last saved headline");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Headline").fill("Unconfirmed edit input");
    state.writeMode = "unconfirmed-edit-not-applied";
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: "Submitted edit", exact: true })).toBeVisible();
    await expect(page.getByLabel("Headline")).toHaveValue("Unconfirmed edit input");
    await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);

    state.listStatus = 503;
    await page.getByRole("button", { name: "Reload banners" }).click();
    await expect(page.getByText("The latest banners could not be checked.")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "View submitted edit", exact: true }).click();
    await expect(page.getByLabel("Headline")).toHaveValue("Unconfirmed edit input");
    await expect(page.getByLabel("Headline")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Start new edit from reviewed banner" })).toHaveCount(0);

    state.listStatus = 200;
    await page.getByRole("button", { name: "Reload banners" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Latest banner: Last saved headline" })).toBeVisible();
    expect(state.items[0].version).toBe(1);
    await expect(page.getByLabel("Headline")).toHaveValue("Unconfirmed edit input");
    await expect(page.getByLabel("Headline")).toBeDisabled();
    expect(state.writes.map(({ method }) => method)).toEqual(["POST", "PATCH"]);
    await page.getByRole("button", { name: "Start new edit from reviewed banner" }).click();
    await expect(page.getByLabel("Headline")).toHaveValue("Last saved headline");
    await expect(page.getByLabel("Headline")).toBeEnabled();
    await expect(page.getByRole("button", { name: "View submitted edit" })).toHaveCount(0);
    expect(state.writes).toHaveLength(2);
    state.writeMode = "normal";
    await page.getByLabel("Headline").fill("Deliberately edited headline");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    expect(state.writes.at(-1)).toMatchObject({ method: "PATCH", body: { version: 1, headline: "Deliberately edited headline" } });
    expect(state.writes).toHaveLength(3);
  });

  test("typed CSRF denial keeps input and never replays; unclassified 403 is terminal", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.goto(adminPage);
    await fillDraft(page, "Draft kept after verification denial");
    state.writeMode = "csrf-denied";
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "This request could not be verified." })).toBeVisible();
    await expect(page.getByLabel("Headline")).toHaveValue("Draft kept after verification denial");
    await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
    await expect(page.getByText("Invalid CSRF token.", { exact: false })).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(state.items).toEqual([]);

    await page.getByLabel("Headline").fill("Draft kept after list failure");
    state.listStatus = 503;
    await page.getByRole("button", { name: "Reload banners" }).click();
    await expect(page.getByText("Banners could not be loaded.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Headline")).toHaveValue("Draft kept after list failure");
    await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "View submitted draft" })).toHaveCount(0);
    state.listStatus = 200;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
    await expect(page.getByLabel("Headline")).toHaveValue("Draft kept after list failure");
    expect(state.writes).toHaveLength(1);

    state.writeMode = "denied";
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "You no longer have access to homepage banners." })).toBeVisible();
    await expect(page.getByLabel("Headline")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New draft" })).toHaveCount(0);
    await expect(page.getByText("fixture-internal-detail")).toHaveCount(0);
    expect(state.writes).toHaveLength(2);
  });

  test("email fallback cannot open a Campaign write or start preparation", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-no-id-token", url: app }]);
    await page.goto(adminPage);
    await expect(page.getByTestId("admin-profile-trigger")).toHaveAttribute("aria-label", "Open admin profile for Reviewer Without ID");
    await expect(page.getByRole("alert").filter({ hasText: "Refresh the page to verify your admin account." })).toBeVisible();
    await expect(page.getByRole("button", { name: "New draft" })).toHaveCount(0);
    expect(state.csrfReads).toBe(0);
    expect(state.mutationAttempts).toBe(0);
  });

  for (const status of [412, 428] as const) {
    test(`typed Campaign ${status} requires a fresh page and a new action without replay`, async ({ context, page }) => {
      await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
      await page.goto(adminPage);
      await fillDraft(page, "Original submission");
      state.actorPrecondition = status;
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Refresh the page to verify your admin account." })).toBeVisible();
      await expect(page.getByText("fixture-internal-detail")).toHaveCount(0);
      await expect(page.getByLabel("Headline")).toHaveCount(0);
      expect(state.writes).toHaveLength(1);
      expect(state.items).toEqual([]);
      state.actorPrecondition = undefined;
      await page.getByRole("button", { name: "Refresh page" }).click();
      await expect(page.getByRole("button", { name: "New draft" })).toBeEnabled();
      expect(state.writes).toHaveLength(1);
      await fillDraft(page, "Explicit new submission");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
      expect(state.writes).toHaveLength(2);
    });
    for (const payload of [...preconditionPayloads, "malformed-json"] as const) {
      test(`Campaign ${status} (${payload}) cannot reopen an existing editor without a fresh page`, async ({ context, page }) => {
        const stored: FixtureBanner = { ...fixtureDraft, id: bannerId, state: "DRAFT", version: 1 };
        state.items = [stored];
        await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
        await page.goto(adminPage);
        await page.getByRole("button", { name: "Edit draft", exact: true }).click();
        await page.getByLabel("Headline").fill("Unaccepted fixture edit");
        state.actorPrecondition = status;
        state.actorPreconditionPayload = payload;
        const rejectedWrite = page.waitForResponse(response => response.url() === `${app}/api/backend/admin/content/homepage-banners/${bannerId}`
          && response.request().method() === "PATCH" && response.status() === status);
        await page.getByRole("button", { name: "Save draft", exact: true }).click();
        const response = await rejectedWrite;
        if (payload === "malformed-json") {
          expect(await response.headerValue("cache-control")).toBe("no-store");
          await expect(response.json()).resolves.toEqual({
            status: "fail", message: "Refresh the campaign editor before making another change.",
          });
        }
        await expect(page.getByRole("alert").filter({ hasText: "Refresh the page to verify your admin account." })).toBeVisible();
        await expect(page.getByRole("button", { name: "Refresh page", exact: true })).toBeVisible();
        for (const action of ["Edit draft", "New draft", "Reload banners", "Use reviewed banner", "Start new edit from reviewed banner"]) {
          await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
        }
        await expect(page.getByLabel("Headline")).toHaveCount(0);
        await expect(page.getByText(rejected.message)).toHaveCount(0);
        expect(state.mutationAttempts).toBe(1);
        expect(state.items).toEqual([stored]);

        state.actorPrecondition = undefined;
        await page.getByRole("button", { name: "Refresh page", exact: true }).click();
        await expect(page.getByRole("button", { name: "Edit draft", exact: true })).toBeEnabled();
        await expect(page.getByLabel("Headline")).toHaveCount(0);
        await page.getByRole("button", { name: "Edit draft", exact: true }).click();
        await expect(page.getByLabel("Headline")).toHaveValue(stored.headline);
        expect(state.mutationAttempts).toBe(1);
      });
    }
  }

  // This mounted case requires the current-dev transport composition that preserves malformed HTTP denials.
  test("malformed HTTP 403 remains terminal with current-dev transport", async ({ context, page }) => {
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", url: app }]);
    await page.goto(adminPage);
    await fillDraft(page, "Denied draft input");
    state.writeMode = "malformed-denial";
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "You no longer have access to homepage banners." })).toBeVisible();
    await expect(page.getByLabel("Headline")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "View submitted draft" })).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(state.items).toEqual([]);
  });
});
