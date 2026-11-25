import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

const host = "127.0.0.1";
const appPort = 3244;
const apiPort = 5044;
const appOrigin = `http://${host}:${appPort}`;
const apiOrigin = `http://${host}:${apiPort}`;
const repo = resolve(__dirname, "..");
const csrfToken = "fixture-access-csrf";
const reason = "Quarterly access review completed.";
const actorId = "actor-fixture";
const subjectId = "staff-fixture";
const targetName = "Mwansa Banda";
const defaultPermissions = ["access_admin_panel", "view_all_users", "manage_roles", "edit_users"];
const createdAt = "2026-01-01T10:00:00.000Z";
const longEmail = `${"accessreview".repeat(5)}@example.test`;

type Mode = "success" | "invalid" | "unauthenticated" | "forbidden" | "conflict" | "wrong-id" | "wrong-status";
type CapturedMutation = { method: string; path: string; csrf: string | undefined; body: unknown };

let fixture: Server | undefined;
let next: ChildProcess | undefined;
let nextLogs = "";
let access: ReturnType<typeof createFixtureState>;

function createFixtureState() {
  return {
    actorRole: "SUPER_ADMIN",
    permissions: [...defaultPermissions],
    active: true,
    mode: "success" as Mode,
    listStatus: 200,
    reads: 0,
    mutations: [] as CapturedMutation[],
    mutationHold: null as Promise<void> | null,
  };
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

async function handleFixture(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", apiOrigin);
  if (req.method === "GET" && url.pathname === "/api/v1/user/me") {
    return send(res, 200, {
      status: "success",
      data: { user: { id: actorId, name: "Fixture Reviewer", email: "reviewer@example.test",
        role: access.actorRole, permissions: access.permissions } },
    });
  }
  if (req.method === "GET" && url.pathname === "/api/v1/auth/csrf-token") {
    res.setHeader("Set-Cookie", `_csrf=${csrfToken}; Path=/; HttpOnly; SameSite=Lax`);
    res.setHeader("X-CSRF-Token", csrfToken);
    return send(res, 200, { status: "success", data: { csrfToken } });
  }
  if (req.method === "GET" && url.pathname === "/api/v1/admin/users") {
    access.reads += 1;
    if (access.listStatus !== 200) {
      return send(res, access.listStatus, { status: "fail", message: "internal-fixture-detail" });
    }
    const users = [
      { id: subjectId, firstName: "Mwansa", lastName: "Banda", email: longEmail,
        role: "OPERATIONS", isActive: access.active, createdAt },
      { id: actorId, firstName: "Fixture", lastName: "Reviewer", email: "reviewer@example.test",
        role: access.actorRole, isActive: true, createdAt },
      { id: "protected-fixture", firstName: "Protected", lastName: "Admin", email: "protected@example.test",
        role: "SUPER_ADMIN", isActive: true, createdAt },
    ];
    return send(res, 200, { status: "success", results: users.length,
      pagination: { total: users.length, page: 1, limit: 100, pages: 1 }, data: { users } });
  }
  if (req.method === "PATCH" && /^\/api\/v1\/admin\/users\/[^/]+\/toggle-status$/.test(url.pathname)) {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw) as { isActive: boolean };
    access.mutations.push({ method: req.method, path: url.pathname, csrf: req.headers["x-csrf-token"] as string, body });
    await access.mutationHold;
    const failure = { status: "fail", message: "internal-fixture-detail" };
    if (access.mode === "invalid") return send(res, 400, failure);
    if (access.mode === "unauthenticated") return send(res, 401, failure);
    if (access.mode === "forbidden") return send(res, 403, failure);
    if (access.mode === "conflict") return send(res, 409, failure);
    if (!req.headers.cookie?.includes(`_csrf=${csrfToken}`) || req.headers["x-csrf-token"] !== csrfToken) {
      return send(res, 403, failure);
    }
    if (access.mode === "success") access.active = body.isActive;
    return send(res, 200, { status: "success", data: { user: {
      id: access.mode === "wrong-id" ? "different-fixture" : subjectId,
      isActive: access.mode === "wrong-status" ? !body.isActive : body.isActive,
    } } });
  }
  send(res, 404, { status: "fail", message: "Fixture route not found" });
}

// Only these two loopback services participate in interactive acceptance.
test.use({ serviceWorkers: "block", channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined) });
test.describe.configure({ mode: "default", timeout: 60_000 });
test.beforeAll(async () => {
  access = createFixtureState();
  fixture = createServer((req, res) => {
    void handleFixture(req, res).catch(() => send(res, 500, { status: "error" }));
  });
  fixture.listen(apiPort, host);
  await once(fixture, "listening");
  const apiUrl = `${apiOrigin}/api/v1`;
  next = spawn(process.execPath, [resolve(repo, "node_modules/next/dist/bin/next"), "start",
    "--hostname", host, "--port", String(appPort)], {
    cwd: repo,
    env: {
      ...process.env,
      ADMIN_API_URL: apiUrl,
      INTERNAL_BACKEND_URL: apiUrl,
      NEXT_PUBLIC_API_URL: apiUrl,
      NEXT_PUBLIC_API_PROXY_URL: "/api/backend",
      ADMIN_AUTH_SESSION_ENDPOINT: "/user/me",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [next.stdout, next.stderr]) {
    stream?.on("data", (data: Buffer) => { nextLogs = (nextLogs + data.toString()).slice(-3000); });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    if (next.exitCode !== null) break;
    const response = await fetch(`${appOrigin}/admin/login`, { signal: AbortSignal.timeout(500) }).catch(() => null);
    if (response?.ok) return;
    await new Promise((resolveAttempt) => setTimeout(resolveAttempt, 250));
  }
  throw new Error(`Access application fixture did not start. Build the checkout with loopback API settings first.\n${nextLogs}`);
});

test.afterAll(async () => {
  if (next && next.exitCode === null && next.signalCode === null && next.pid) {
    const exited = once(next, "exit");
    next.kill();
    await exited;
  }
  if (fixture?.listening) {
    const closed = once(fixture, "close");
    fixture.close();
    fixture.closeAllConnections();
    await closed;
  }
});

test.beforeEach(async ({ context }) => {
  access = createFixtureState();
  await containNetwork(context);
  await context.addCookies([{ name: "zogular_admin_session", value: "admin-fixture-token", url: appOrigin }]);
});

async function containNetwork(context: BrowserContext) {
  await context.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
  await context.route("**/*", async (route) => {
    const { origin, pathname, protocol } = new URL(route.request().url());
    if (origin === "https://va.vercel-scripts.com" || (origin === appOrigin && pathname.startsWith("/_vercel/"))) {
      return route.fulfill({ status: 204, contentType: "application/javascript", body: "" });
    }
    if (origin === appOrigin || origin === apiOrigin || protocol === "data:" || protocol === "blob:") {
      return route.continue();
    }
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", (socket) => {
    const origin = new URL(socket.url().replace(/^ws/, "http")).origin;
    if (origin === appOrigin || origin === apiOrigin) socket.connectToServer();
    else void socket.close({ code: 1008, reason: "Non-loopback address blocked" });
  });
}

async function openAdmin(page: Page, name = targetName, listScreenshotPath?: string) {
  await page.goto(`${appOrigin}/admin/access`, { waitUntil: "domcontentloaded" });
  const row = page.getByRole("button", { name, exact: true });
  await expect(row).toBeVisible();
  if (listScreenshotPath) {
    const table = page.getByRole("table");
    const adminRow = table.getByRole("row").filter({ has: row });
    await expect(adminRow.getByText("Active", { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(adminRow.getByText("OPERATIONS", { exact: true }).filter({ visible: true })).toBeInViewport({ ratio: 1 });
    expect(await table.evaluate((el) => {
      const scroller = el.parentElement;
      return !!scroller && scroller.scrollWidth <= scroller.clientWidth + 1;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: listScreenshotPath, animations: "disabled" });
  }
  await row.focus();
  await row.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Administrator Context" });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function openConfirmation(page: Page, action: "Revoke access" | "Restore access") {
  const trigger = page.getByRole("button", { name: action, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: action, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function settlePanelMotion(panel: Locator) {
  // Opening translations may intentionally put part of the panel offscreen.
  await panel.evaluate(async (element) => {
    await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
  });
}

function confirmPayload(isActive: boolean) {
  return {
    method: "PATCH",
    path: `/api/v1/admin/users/${subjectId}/toggle-status`,
    csrf: csrfToken,
    body: { isActive, reason, reasonCode: isActive ? "APPROVED_REACTIVATION" : "APPROVED_DEACTIVATION" },
  };
}

test("revokes and restores access once per confirmation using the strict audited PATCH contract", async ({ page }) => {
  const sheet = await openAdmin(page);
  const revoke = await openConfirmation(page, "Revoke access");
  const reasonField = revoke.getByRole("textbox", { name: "Reason" });
  const submit = revoke.getByRole("button", { name: "Revoke access", exact: true });
  await reasonField.fill("   too short   ");
  await submit.click();
  await expect(revoke.getByRole("alert")).toContainText("10 and 500 characters");
  await expect(reasonField).toBeFocused();
  expect(access.mutations).toHaveLength(0);
  await reasonField.fill(`  ${reason}  `);
  await submit.click();
  await expect(revoke).toBeHidden();
  await expect(sheet.getByRole("button", { name: "Restore access", exact: true })).toBeFocused();
  expect(access.mutations).toEqual([confirmPayload(false)]);
  expect(access.reads).toBe(1);

  const restore = await openConfirmation(page, "Restore access");
  await restore.getByRole("textbox", { name: "Reason" }).fill(reason);
  await restore.getByRole("button", { name: "Restore access", exact: true }).click();
  await expect(restore).toBeHidden();
  await expect(sheet.getByRole("button", { name: "Revoke access", exact: true })).toBeVisible();
  expect(access.mutations).toEqual([confirmPayload(false), confirmPayload(true)]);
  expect(access.reads).toBe(1);
});

test("does not expose a status action on self or a protected super administrator", async ({ page }) => {
  for (const name of ["Fixture Reviewer", "Protected Admin"]) {
    const sheet = await openAdmin(page, name);
    await expect(sheet.getByRole("button", { name: /revoke access|restore access/i })).toHaveCount(0);
  }
  expect(access.mutations).toHaveLength(0);
});

for (const actor of [
  { role: "SUPER_ADMIN", permissions: defaultPermissions.filter((p) => p !== "edit_users") },
  { role: "OPERATIONS", permissions: defaultPermissions },
]) {
  test(`does not expose a status action for ${actor.role} with incomplete mutation authority`, async ({ page }) => {
    access.actorRole = actor.role;
    access.permissions = actor.permissions;
    const sheet = await openAdmin(page);
    await expect(sheet.getByRole("button", { name: /revoke access|restore access/i })).toHaveCount(0);
    expect(access.mutations).toHaveLength(0);
  });
}

test("does not fetch the directory without view_all_users", async ({ page }) => {
  access.permissions = defaultPermissions.filter((permission) => permission !== "view_all_users");
  await page.goto(`${appOrigin}/admin/access`);
  await expect(page.getByRole("heading", { name: "Access Control" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "You do not have permission to view the admin directory." })).toBeVisible();
  await expect(page.getByRole("button", { name: targetName, exact: true })).toHaveCount(0);
  expect(access.reads).toBe(0);
});

test("preserves the reason and displays safe inline feedback when the backend rejects sensitive reason content", async ({ page }) => {
  access.mode = "invalid";
  await openAdmin(page);
  const dialog = await openConfirmation(page, "Revoke access");
  const invalid = "Review this link https://example.test/fixture";
  await dialog.getByRole("textbox", { name: "Reason" }).fill(invalid);
  await dialog.getByRole("button", { name: "Revoke access", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Reason" })).toHaveValue(invalid);
  await expect(dialog).not.toContainText("internal-fixture-detail");
  expect(access.mutations).toHaveLength(1);
  expect(access.active).toBe(true);
});

for (const mode of ["forbidden", "conflict", "wrong-id", "wrong-status"] as const) {
  test(`holds further status changes after ${mode} until an authoritative refresh`, async ({ page }) => {
    access.mode = mode;
    await openAdmin(page);
    const dialog = await openConfirmation(page, "Revoke access");
    const field = dialog.getByRole("textbox", { name: "Reason" });
    const submit = dialog.getByRole("button", { name: "Revoke access", exact: true });
    await field.fill(reason);
    await submit.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(field).toHaveValue(reason);
    await expect(submit).toBeDisabled();
    expect(access.mutations).toEqual([confirmPayload(false)]);
    expect(access.active).toBe(true);

    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Restore access", exact: true })).toHaveCount(0);
    const sheet = page.getByRole("dialog", { name: "Administrator Context" });
    if (await sheet.isVisible()) await sheet.getByRole("button", { name: "Close panel" }).click();
    access.active = false;
    const response = page.waitForResponse((res) => res.url().includes("/api/backend/admin/users") &&
      res.request().method() === "GET");
    await page.getByRole("button", { name: "Refresh admins", exact: true }).click();
    expect((await response).ok()).toBe(true);
    await page.getByRole("button", { name: targetName, exact: true }).click();
    await expect(page.getByRole("button", { name: "Restore access", exact: true })).toBeVisible();
    expect(access.mutations).toHaveLength(1);
  });
}

test("does not replay a decision after session expiry", async ({ page }) => {
  access.mode = "unauthenticated";
  const authRefreshes: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/refresh-token")) authRefreshes.push(request.url());
  });
  await openAdmin(page);
  const dialog = await openConfirmation(page, "Revoke access");
  await dialog.getByRole("textbox", { name: "Reason" }).fill(reason);
  await dialog.getByRole("button", { name: "Revoke access", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your session is no longer authorized." })).toBeVisible();
  expect(access.mutations).toEqual([confirmPayload(false)]);
  expect(authRefreshes).toHaveLength(0);
});

const refreshFailures = [
  [401, "Your session is no longer authorized."],
  [403, "The server denied access to the admin directory."],
  [500, "The admin directory could not be refreshed. Try again."],
] as const;

for (const [status, feedback] of refreshFailures) {
  test(`drops the stale directory when a recovery refresh returns ${status}`, async ({ page }) => {
    access.mode = "conflict";
    await openAdmin(page);
    const dialog = await openConfirmation(page, "Revoke access");
    await dialog.getByRole("textbox", { name: "Reason" }).fill(reason);
    await dialog.getByRole("button", { name: "Revoke access", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    const sheet = page.getByRole("dialog", { name: "Administrator Context" });
    if (await sheet.isVisible()) await sheet.getByRole("button", { name: "Close panel" }).click();
    access.listStatus = status;
    const response = page.waitForResponse((res) => res.url().includes("/api/backend/admin/users") &&
      res.request().method() === "GET");
    await page.getByRole("button", { name: "Refresh admins", exact: true }).click();
    expect((await response).status()).toBe(status);
    await expect(page.getByRole("alert").filter({ hasText: feedback })).toBeVisible();
    await expect(page.getByRole("button", { name: targetName, exact: true })).toHaveCount(0);
    expect(access.mutations).toEqual([confirmPayload(false)]);
  });
}

test("locks pending dismissal and repeat submissions, then restores keyboard focus", async ({ page }) => {
  const sheet = await openAdmin(page);
  const trigger = sheet.getByRole("button", { name: "Revoke access", exact: true });
  const canceled = await openConfirmation(page, "Revoke access");
  await page.keyboard.press("Escape");
  await expect(canceled).toBeHidden();
  await expect(trigger).toBeFocused();

  const dialog = await openConfirmation(page, "Revoke access");
  const field = dialog.getByRole("textbox", { name: "Reason" });
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  const submit = dialog.getByRole("button", { name: "Revoke access", exact: true });
  await field.fill(reason);
  await submit.focus();
  await page.keyboard.press("Tab");
  await expect(field).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(submit).toBeFocused();

  const hold = Promise.withResolvers<void>();
  access.mutationHold = hold.promise;
  try {
    await page.keyboard.press("Enter");
    await expect.poll(() => access.mutations.length).toBe(1);
    await expect(cancel).toBeDisabled();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    expect(access.mutations).toEqual([confirmPayload(false)]);
  } finally {
    hold.resolve();
  }
  await expect(dialog).toBeHidden();
  await expect(sheet.getByRole("button", { name: "Restore access", exact: true })).toBeFocused();
});

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`contains the access sheet and confirmation at ${width}px`, async ({ page }, testInfo) => {
    const height = width === 320 ? 568 : 844;
    await page.setViewportSize({ width, height });
    const sheet = await openAdmin(page, targetName, testInfo.outputPath(`access-list-${width}.png`));
    const email = sheet.getByText(`Email: ${longEmail}`, { exact: true });
    await expect(email).toBeVisible();
    await settlePanelMotion(sheet);
    const sheetBox = await sheet.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(sheetBox!.x).toBeGreaterThanOrEqual(-1);
    expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(width + 1);
    if (width < 640) expect(sheetBox!.width).toBeGreaterThanOrEqual(width - 1);
    else expect(sheetBox!.width).toBeLessThanOrEqual(576 + 1);
    const close = sheet.getByRole("button", { name: "Close panel" });
    await expect(close).toBeInViewport();
    await expect(close).toHaveCSS("color", "rgb(255, 255, 255)");
    const emailBox = await email.boundingBox();
    expect(emailBox).not.toBeNull();
    expect(emailBox!.x + emailBox!.width).toBeLessThanOrEqual(sheetBox!.x + sheetBox!.width);
    expect(await email.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`access-sheet-${width}.png`), animations: "disabled" });
    const dialog = await openConfirmation(page, "Revoke access");
    await dialog.getByRole("textbox", { name: "Reason" }).fill(reason);
    const submit = dialog.getByRole("button", { name: "Revoke access", exact: true });
    await expect(submit).toBeInViewport();
    await settlePanelMotion(dialog);
    if (width < 640) {
      const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeInViewport();
      for (const control of [cancel, submit]) {
        const box = await control.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    }
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(bounds!.y).toBeGreaterThanOrEqual(-1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`access-confirmation-${width}.png`), animations: "disabled" });
    expect(access.mutations).toHaveLength(0);
  });
}
