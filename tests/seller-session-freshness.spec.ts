import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { basename } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { containAuditNetwork } from "./helpers/ui-audit-checks";

// Opt-in, private on-demand rendering. All auth and seller API responses are browser fixtures.
const origin = "http://127.0.0.1:44961";
const enabled = process.env.ZG_SELLER_SESSION_FIXTURE === "1";
test.skip(!enabled, "Requires the isolated seller-session build.");
test.use({ channel: "chrome", serviceWorkers: "block", viewport: { width: 390, height: 844 },
  launchOptions: { args: ["--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] } });
let server: ChildProcess | undefined;
test.beforeAll(async () => {
  if (!enabled) return;
  const api = "http://127.0.0.1:44962/api/v1";
  if (!basename(process.cwd()).startsWith("zg-shell-") || process.env.INTERNAL_BACKEND_URL !== api ||
      process.env.NEXT_PUBLIC_API_URL !== api || process.env.NODE_ENV !== "development") throw Error("Not a private fixture checkout");
  // Keep Next's dev runtime outside the Playwright worker's TypeScript transform.
  const child = spawn(process.execPath, ["-e", `
    const app = require("next")({ dev: true, hostname: "127.0.0.1", port: 44961 });
    app.prepare().then(() => {
      const server = require("node:http").createServer(app.getRequestHandler());
      process.once("disconnect", async () => { server.close(); server.closeAllConnections(); await app.close(); process.exit(0); });
      server.listen(44961, "127.0.0.1", () => process.send("ready"));
    });
  `], { stdio: ["ignore", "ignore", "inherit", "ipc"], windowsHide: true });
  server = child;
  await Promise.race([once(child, "message"), once(child, "exit").then(() => { throw Error("Fixture exited before readiness"); })]);
});
test.afterAll(async () => {
  if (server?.connected) {
    const exit = once(server, "exit"); server.disconnect();
    expect((await exit)[0]).toBe(0);
  }
});

type Identity = "Alpha" | "Bravo";
const user = (id: Identity) => ({ id, firstName: id, lastName: "Fixture", email: id + "@fixture.invalid",
  role: "seller", emailVerifiedAt: null, phoneVerifiedAt: null });
const application = (id: Identity) => ({ id: "app-" + id, userId: id, sellerType: "INDIVIDUAL",
  storeName: id + " fixture store", status: id === "Alpha" ? "APPROVED" : "PROVISIONAL" });
const me = "/user/me", vendor = "/vendor/applications/me";
declare global {
  interface Window {
    sellerFrameAudit?: { frames: number; leaks: number };
    startSellerFrames?: () => void;
  }
}
async function finishRead(page: Page, route: Route, reply: Parameters<Route["fulfill"]>[0]) {
  const response = page.waitForResponse(r => r.request() === route.request());
  await route.fulfill(reply);
  await (await response).finished();
}
async function fixture(page: Page, seed: Identity | null) {
  await containAuditNetwork(page.context(), [origin]);
  if (seed) await page.addInitScript(value => localStorage.setItem("zogular_auth_user", JSON.stringify(value)), user(seed));
  const state = { identity: seed as Identity | null, reads: [] as string[], expired: false };
  let pending: { path: string; accept: (r: Route) => void } | undefined;
  const hold = (path: string) => new Promise<Route>(accept => { pending = { path, accept }; });
  await page.route(origin + "/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/backend/, "");
    state.reads.push(path);
    if (pending?.path === path) { const { accept } = pending; pending = undefined; accept(route); return; }
    if (path === me) return route.fulfill(state.identity && !state.expired ? { json: { user: user(state.identity) } } : { status: 401, json: {} });
    if (path === vendor && state.identity) return route.fulfill({ json: { application: application(state.identity) } });
    if (path === "/auth/csrf-token") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (path === "/auth/refresh-token") {
      state.expired = false; return route.fulfill({ status: state.identity ? 200 : 401, json: {} });
    }
    if (path === "/vendor/support/tickets") return route.fulfill({ json: { data: { tickets: [] } } });
    if (path === "/auth/logout" || path === "/api/auth/clear-session") return route.fulfill({ json: {} });
    return route.fulfill({ status: 404, json: {} });
  });
  return { state, hold };
}

// Observe visible frames, not just the last DOM. The old order action belongs to approved Alpha alone.
async function watchFrames(page: Page) {
  await page.evaluate(() => {
    const audit = { frames: 0, leaks: 0 };
    Object.assign(window, { sellerFrameAudit: audit });
    const sample = () => {
      audit.frames++;
      if (/Alpha fixture store|View orders/.test(document.body.innerText)) audit.leaks++;
      requestAnimationFrame(sample);
    };
    // Caller arms immediately before the identity event in the same evaluation turn below.
    Object.assign(window, { startSellerFrames: () => requestAnimationFrame(sample) });
  });
}
async function frames(page: Page) {
  await page.evaluate(() => new Promise<void>(ok => requestAnimationFrame(() => requestAnimationFrame(() => ok()))));
  const audit = await page.evaluate(() => window.sellerFrameAudit!);
  expect(audit.frames).toBeGreaterThan(0); expect(audit.leaks).toBe(0);
}
const storeHeading = (page: Page, id: Identity) => page.getByRole("heading", { name: id + " fixture store" });

for (const phase of ["late-user", "late-application", "logout"] as const) {
  test(phase + ": same-tab seller authority never returns after a session change", async ({ page }, info) => {
    const { state, hold } = await fixture(page, "Alpha");
    await page.goto(origin + "/seller/support"); await expect(storeHeading(page, "Alpha")).toBeVisible();
    const notifications = page.getByRole("link", { name: "Open notifications" }).filter({ visible: true });
    const late = hold(phase === "late-user" ? me : vendor);
    await notifications.click();
    const a = await late;
    await expect(storeHeading(page, "Alpha")).toBeVisible(); // ordinary same-user navigation keeps the shell
    await expect(page.getByRole("link", { name: "View orders", exact: true })).toBeVisible();
    await watchFrames(page);
    if (phase === "logout") {
      await page.getByRole("button", { name: "Open more seller tools" }).click();
      state.identity = null;
      await page.evaluate(() => window.addEventListener("zogular:auth-session-changed",
        () => window.startSellerFrames!(), { once: true }));
      await page.getByRole("button", { name: "Sign out", exact: true }).filter({ visible: true }).click();
      await expect(page).toHaveURL(/\/seller\/login(?:\?|$)/);
      await finishRead(page, a, { json: { application: application("Alpha") } });
      await frames(page);
      expect(await page.evaluate(() => localStorage.getItem("zogular_auth_user"))).toBeNull();
      return;
    }
    state.identity = "Bravo";
    const next = hold(vendor);
    await page.evaluate(value => {
      localStorage.setItem("zogular_auth_user", JSON.stringify(value));
      window.dispatchEvent(new Event("zogular:auth-session-changed"));
      window.startSellerFrames!();
    }, user("Bravo"));
    const b = await next;
    await expect(page.locator("main")).toHaveCount(0);
    if (phase === "late-application") {
      await finishRead(page, a, { status: 500, json: {} }); await frames(page);
      await expect(page.getByText("Workspace Unavailable")).toHaveCount(0);
      await expect(page.locator("main")).toHaveCount(0);
    }
    await b.fulfill({ json: { application: application("Bravo") } });
    await expect(storeHeading(page, "Bravo")).toBeVisible();
    if (phase === "late-user") {
      await finishRead(page, a, { json: { user: user("Alpha") } });
      const bounds = await notifications.boundingBox();
      console.info("390px seller notifications hit area:", bounds?.width, "x", bounds?.height);
      await info.attach("mobile-header-hit-area", { body: JSON.stringify({ viewport: page.viewportSize(), bounds }), contentType: "application/json" });
      await page.screenshot({ path: info.outputPath("seller-notifications-390.png"), animations: "disabled" });
    }
    await frames(page);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("zogular_auth_user")))!).id).toBe("Bravo");
    await expect(page).toHaveURL(origin + "/seller/notifications");
    await expect(page.getByRole("link", { name: "View orders", exact: true })).toHaveCount(0);
  });
}

test("same session: an older route refresh cannot downgrade the current seller or redirect", async ({ page }) => {
  const { hold } = await fixture(page, "Alpha");
  await page.goto(origin + "/seller/support"); await expect(storeHeading(page, "Alpha")).toBeVisible();
  const first = hold(vendor);
  await page.getByRole("link", { name: "Open notifications" }).filter({ visible: true }).click();
  const earlier = await first;
  const second = hold(vendor);
  await page.getByRole("link", { name: "Contact support", exact: true }).click();
  await finishRead(page, await second, { json: { application: { ...application("Alpha"), storeName: "Updated fixture store" } } });
  const heading = page.getByRole("heading", { name: "Updated fixture store" });
  await expect(heading).toBeVisible();
  await finishRead(page, earlier, { json: { application: { ...application("Alpha"), status: "SUBMITTED" } } });
  await page.evaluate(() => new Promise<void>(ok => requestAnimationFrame(() => requestAnimationFrame(() => ok()))));
  await expect(heading).toBeVisible(); await expect(page).toHaveURL(origin + "/seller/support");
});

for (const canRecover of [true, false]) {
  test("empty local identity and " + (canRecover ? "recoverable expired access" : "missing cookie session"), async ({ page }) => {
    const { state } = await fixture(page, null);
    state.identity = canRecover ? "Bravo" : null; state.expired = true;
    await page.goto(origin + "/seller/notifications");
    if (canRecover) await expect(storeHeading(page, "Bravo")).toBeVisible();
    else {
      await expect(page).toHaveURL(/\/seller\/login\?next=%2Fseller%2Fnotifications$/);
      expect(state.reads).not.toContain(vendor);
    }
    expect(state.reads).toContain("/auth/refresh-token");
  });
}
