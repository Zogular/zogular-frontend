import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

const host = "127.0.0.1";
const appPort = 3284;
const backendPort = 5084;
const appOrigin = `http://${host}:${appPort}`;
const backendOrigin = `http://${host}:${backendPort}`;
const backendApi = `${backendOrigin}/api/v1`;
const validDate = "2026-10-15T10:00:00.000Z";
const formattedDate = new Intl.DateTimeFormat("en-ZM", {
  timeZone: "Africa/Lusaka", month: "short", day: "numeric", year: "numeric",
}).format(new Date(validDate));

const scenarios = [
  { id: "pending", title: "Zambian Honey Jar", status: "PENDING_REVIEW", expected: "Timestamp unavailable" },
  { id: "published", title: "Copper Bracelet", status: "PUBLISHED", expected: "Timestamp unavailable" },
  { id: "malformed", title: "Ceramic Tea Set", status: "PUBLISHED", expected: "Timestamp unavailable" },
  { id: "valid", title: "Chitenge Tote Bag", status: "PUBLISHED", expected: formattedDate },
  { id: "draft", title: "Unsubmitted Fixture Draft", status: "DRAFT", expected: null },
] as const;

const products = scenarios.map(({ id, title, status }) => ({
  id, slug: id, title, status,
  description: "Synthetic product for submission date checks.",
  price: 185, salePrice: null, images: [],
  category: "OTHERS", categorySlug: "groceries", subcategorySlug: "honey",
  condition: "NEW", stock: 12, isApproved: status === "PUBLISHED",
  createdAt: validDate, updatedAt: validDate,
  user: { id: "seller-fixture", firstName: "Mutale", lastName: "Banda", email: "seller@example.test" },
}));

let backend: Server | undefined;
let next: ChildProcess | undefined;
let nextLogs = "";
const unhandledRequests: string[] = [];

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", serviceWorkers: "block", timezoneId: "Africa/Lusaka" });
test.describe.configure({ timeout: 60_000 });

test.beforeAll(async () => {
  backend = createServer((req, res) => {
    const url = new URL(req.url ?? "/", backendOrigin);
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && url.pathname === "/api/v1/user/me") {
      res.end(JSON.stringify({
        status: "success",
        data: { user: {
          id: "admin-fixture", name: "Fixture Admin", email: "admin@example.test",
          role: "SUPER_ADMIN", permissions: ["access_admin_panel", "view_all_products", "approve_products"],
        } },
      }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v1/admin/products"
      && url.searchParams.get("page") === "1" && url.searchParams.get("limit") === "100") {
      res.end(JSON.stringify({
        status: "success", results: products.length, data: { products },
        pagination: { page: 1, limit: 100, total: products.length, pages: 1 },
      }));
      return;
    }
    unhandledRequests.push(`${req.method} ${url.pathname}${url.search}`);
    res.writeHead(404).end(JSON.stringify({ status: "fail", message: "Fixture route not found." }));
  });
  backend.listen(backendPort, host);
  await once(backend, "listening");

  const cwd = resolve(__dirname, "..");
  next = spawn(process.execPath, [resolve(cwd, "node_modules/next/dist/bin/next"), "start",
    "--hostname", host, "--port", String(appPort)], {
    cwd,
    env: {
      ...process.env, INTERNAL_BACKEND_URL: backendApi, ADMIN_API_URL: backendApi,
      NEXT_PUBLIC_API_URL: backendApi, NEXT_PUBLIC_API_PROXY_URL: "/api/backend",
      ADMIN_AUTH_SESSION_ENDPOINT: "/user/me", NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [next.stdout, next.stderr]) {
    stream?.on("data", (chunk: Buffer) => { nextLogs = (nextLogs + chunk.toString()).slice(-4000); });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    if (next.exitCode !== null) break;
    const response = await fetch(`${appOrigin}/admin/login`, { signal: AbortSignal.timeout(500) }).catch(() => null);
    if (response?.ok) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Products fixture could not start with the production build.\n${nextLogs}`);
});

test.afterAll(async () => {
  if (next && next.exitCode === null && next.signalCode === null && next.pid) {
    const exited = once(next, "exit");
    next.kill();
    await exited;
  }
  if (backend?.listening) {
    const closed = once(backend, "close");
    backend.close();
    backend.closeAllConnections();
    await closed;
  }
  expect(unhandledRequests).toEqual([]);
});

async function prepareContext(context: BrowserContext) {
  await context.addCookies([{ name: "zogular_admin_session", value: "products-fixture-token", url: appOrigin }]);
  // Use the existing legacy enrichment path for the two non-empty date inputs.
  await context.addInitScript((timestamp) => {
    Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
    window.localStorage.setItem("zogular-seller-product-enrichments", JSON.stringify({
      valid: { moderation: { submittedAt: timestamp } },
      malformed: { moderation: { submittedAt: "not-a-timestamp" } },
    }));
  }, validDate);
  await context.route("**/*", (route) => {
    const { origin, pathname, protocol } = new URL(route.request().url());
    if (origin === "https://va.vercel-scripts.com" || (origin === appOrigin && pathname.startsWith("/_vercel/"))) {
      return route.fulfill({ status: 204, contentType: "application/javascript", body: "" });
    }
    if (origin === appOrigin || protocol === "blob:" || protocol === "data:") return route.continue();
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", (socket) => {
    if (new URL(socket.url()).origin === `ws://${host}:${appPort}`) socket.connectToServer();
    else void socket.close({ code: 1008, reason: "Non-fixture WebSocket blocked" });
  });
}

async function verifyLabels(page: Page, rows: Locator) {
  for (const { title, expected } of scenarios) {
    const row = rows.filter({ hasText: title });
    if (expected === null) {
      await expect(row).toHaveCount(0); // The current Admin queue excludes drafts.
      continue;
    }
    await expect(row.getByText(expected, { exact: true })).toBeVisible();
    await expect(row.getByText("Awaiting submission", { exact: true })).toHaveCount(0);
    if (expected === formattedDate) await expect(row.getByText("Timestamp unavailable", { exact: true })).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [320, 390, 1440]) {
  test(`renders honest submitted-date labels in the Products queue at ${width}px`, async ({ context, page }, testInfo) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    await prepareContext(context);
    await page.goto(`${appOrigin}/admin/products`);

    if (width === 1440) {
      await verifyLabels(page, page.getByRole("row"));
      await page.screenshot({ path: testInfo.outputPath("products-table.png"), animations: "disabled" });
    } else {
      const cards = page.getByRole("article");
      for (const mode of ["List", "Grid"]) {
        await page.getByRole("button", { name: mode, exact: true }).click();
        await verifyLabels(page, cards);
        await cards.filter({ hasText: "Ceramic Tea Set" }).getByText("Timestamp unavailable", { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`products-${mode.toLowerCase()}.png`), animations: "disabled" });
      }
    }
    expect(errors).toEqual([]);
  });
}
