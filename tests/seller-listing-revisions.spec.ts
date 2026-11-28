import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { listingRevisionProjections, listingRevisionReservationSchema } from "../src/features/listing-revisions/types";

const requireFromRepo = createRequire(resolve("package.json"));
const productId = "e695f846-5d60-4374-9429-b2bc46b96287";
const revisionId = "bf1a1091-b208-4f4e-97e6-a2004a261cad";
const serverKey = "8fe1899b-c325-4146-984a-05dfe827de47";
const sellerA = "81eca643-6f28-43cf-9529-c63e79309531";
const sellerB = "2e4db919-e918-4f4e-97e6-a2004a261cad";
const path = `/api/backend/vendor/products/${productId}/listing-revisions`;
const origin = "http://127.0.0.1:1";
const live = {
  id: productId, listingVersion: 2, title: "Approved desk lamp",
  description: "A bright lamp for a small writing desk.", price: 120, salePrice: null,
};
const panel = "src/features/listing-revisions/components/SellerListingRevisionPanel.tsx";
let bundle: string;
let css: string;
test.use({ viewport: { width: 375, height: 812 }, channel: process.env.A5_TEST_BROWSER_CHANNEL });

test("reservation projections distinguish absence, OPEN, and exact outcomes without private data", () => {
  const identity = { submissionKey: serverKey, baseVersion: 2 };
  expect(listingRevisionReservationSchema.safeParse({ ...identity, changes: { salePrice: null } }).success).toBe(false);
  expect(listingRevisionProjections.outstandingAttempt.parse({ attempt: null })).toEqual({ attempt: null });
  expect(listingRevisionProjections.outstandingAttempt.safeParse({}).success).toBe(false);
  expect(listingRevisionProjections.exactAttempt.safeParse({ attempt: null }).success).toBe(false);
  expect(listingRevisionProjections.exactAttempt.parse({ attempt: { ...identity, status: "OPEN" } }).attempt.status).toBe("OPEN");
  for (const status of ["PENDING_REVIEW", "APPROVED", "NEEDS_CHANGES", "WITHDRAWN"] as const) {
    expect(listingRevisionProjections.settleAttempt.parse({ attempt: { ...identity, status, revisionId } }).attempt.status).toBe(status);
    expect(listingRevisionProjections.exactAttempt.safeParse({ attempt: { ...identity, status } }).success).toBe(false);
  }
  expect(listingRevisionProjections.settleAttempt.parse({ attempt: { ...identity, status: "RETIRED" } }).attempt.status).toBe("RETIRED");
  expect(listingRevisionProjections.reserveAttempt.safeParse({
    attempt: { ...identity, status: "OPEN", submissionHash: "private" },
  }).success).toBe(false);
});

test.describe("mounted seller reservation flow", () => {
// Mount the real edit page and application context with only navigation and HTTP replaced.
test.beforeAll(async () => {
  const root = process.cwd();
  const scratch = await mkdtemp(join(tmpdir(), "zogular-a5-panel-"));
  try {
    const loader = join(scratch, "typescript.cjs");
    const entry = join(scratch, "entry.tsx");
    const navigation = join(scratch, "navigation.ts");
    await writeFile(loader, `const ts = require(${JSON.stringify(requireFromRepo.resolve("typescript"))});
module.exports = (source) => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020
}}).outputText;`);
    await writeFile(navigation, `const params = { id: ${JSON.stringify(productId)} };
const query = new URLSearchParams();
const router = { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} };
export const useParams = () => params;
export const useSearchParams = () => query;
export const useRouter = () => router;
export const usePathname = () => location.pathname;`);
    await writeFile(entry, `import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import EditSellerProductPage from "@/app/seller/products/[id]/edit/page";
import { SellerApplicationContext } from "@/components/seller/SellerApplicationContext";
function Fixture() {
  const [sellerId, setSellerId] = useState(window.fixtureSellerId);
  useEffect(() => {
    const switchSeller = (event) => setSellerId(event.detail);
    window.addEventListener("fixture-seller-switch", switchSeller);
    return () => window.removeEventListener("fixture-seller-switch", switchSeller);
  }, []);
  return <SellerApplicationContext.Provider value={{ application: { status: "APPROVED", userId: sellerId },
    status: "APPROVED", loading: false, error: null, refresh: async () => {}, setApplication() {} }}>
    <EditSellerProductPage />
  </SellerApplicationContext.Provider>;
}
createRoot(document.getElementById("app")).render(<Fixture />);`);
    const webpack = requireFromRepo("next/dist/compiled/webpack/bundle5")().webpack;
    const compiler = webpack({
      mode: "production", context: root, entry, output: { path: scratch, filename: "panel.js" },
      optimization: { minimize: false },
      resolve: { alias: { "@": resolve("src"), "next/navigation$": navigation }, extensions: [".tsx", ".ts", ".js"], modules: [resolve("node_modules")] },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }] },
      plugins: [new webpack.DefinePlugin({
        "process.env.__NEXT_ROUTER_BASEPATH": '""',
        "process.env.INTERNAL_BACKEND_URL": "undefined",
        "process.env.NEXT_PUBLIC_API_URL": "undefined",
        "process.env.NEXT_PUBLIC_API_PROXY_URL": '"/api/backend"',
        "process.env.NEXT_PUBLIC_PRODUCT_LISTING_REVISIONS_ENABLED": "window.fixtureA5Enabled",
      })],
    });
    try {
      await new Promise<void>((done, reject) => compiler.run((error: Error | null, stats: {
        hasErrors: () => boolean; toString: (options: string) => string;
      } | undefined) => error ? reject(error) : stats?.hasErrors()
        ? reject(new Error(stats.toString("errors-only"))) : done()));
    } finally {
      await new Promise<void>((done, reject) => compiler.close((error: Error | null) => error ? reject(error) : done()));
    }
    bundle = await readFile(join(scratch, "panel.js"), "utf8");
    const files = [panel, ...["button", "input", "textarea"].map((name) => `src/components/ui/${name}.tsx`)];
    const scanner = new Scanner({ sources: [] });
    const { build } = await compile(await readFile("src/app/globals.css", "utf8"), { base: resolve("src/app"), onDependency() {} });
    css = build(scanner.scanFiles(await Promise.all(files.map(async (file) => ({
      content: await readFile(file, "utf8"), extension: "tsx",
    })))));
  } finally {
    await rm(scratch, { recursive: true });
  }
});

type FixtureOptions = {
  failure?: "read" | "conflict" | "timeout" | "server" | "malformed" | "reserve-timeout" | "exact-unavailable";
  committedStatus?: "PENDING_REVIEW" | "APPROVED" | "NEEDS_CHANGES" | "WITHDRAWN";
  status?: string;
  isApproved?: boolean | string;
  commitBeforeFailure?: boolean;
  sellerId?: string;
  updatedAt?: string | null;
  approvedAt?: string | null;
  flagOff?: boolean;
  listingVersion?: number;
  beforeReserveReply?: () => Promise<void>;
  sellerForRequest?: () => string;
  staleHistory?: () => boolean;
  failedHistory?: () => boolean;
};

async function openPanel(page: Page, options: FixtureOptions = {}) {
  const { failure, status = "PUBLISHED", isApproved = true, commitBeforeFailure = false, committedStatus = "PENDING_REVIEW",
    sellerId = sellerA, updatedAt = "2026-10-01T09:00:00.000Z", approvedAt = "2026-10-01T09:00:00.000Z",
    flagOff = false, listingVersion = live.listingVersion } = options;
  const writes: { method: string; path: string; body: unknown }[] = [];
  const publicListing = { ...live, listingVersion };
  let revision: Record<string, unknown> | null = null;
  let attempt: { submissionKey: string; baseVersion: number; status: "OPEN" | "RETIRED" } | null = null;
  let attemptOwner: string | undefined;
  let lookedUpOpen = false;
  let submissions = 0;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const method = route.request().method();
    const caller = options.sellerForRequest?.() ?? sellerId;
    if (url.pathname === "/seller-edit") {
      return route.fulfill({ contentType: "text/html", body:
        `<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/panel.css"><div id="app" style="padding:16px"></div><script>window.process={env:{}};window.fixtureSellerId=${JSON.stringify(sellerId)};window.fixtureA5Enabled=${JSON.stringify(flagOff ? "false" : "true")}</script><script src="/panel.js"></script>` });
    }
    if (url.pathname === "/panel.css") return route.fulfill({ contentType: "text/css", body: css });
    if (url.pathname === "/panel.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
    if (url.pathname === "/api/backend/auth/csrf-token") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === "/public-listing") return route.fulfill({ json: publicListing });
    if (method !== "GET") writes.push({ method, path: url.pathname, body: route.request().postDataJSON() });
    if (url.pathname === `/api/backend/vendor/products/${productId}` && method === "GET") {
      return route.fulfill({ json: { status: "success", data: { product: {
        ...live, status, isApproved, approvedAt, isSold: false,
        slug: "desk-lamp", condition: "NEW", category: "OTHER", stock: 5, images: [],
        createdAt: "2026-10-01T09:00:00.000Z", ...(updatedAt !== null && { updatedAt }),
      } } } });
    }
    if (url.pathname === `${path}/${revisionId}/withdraw` && method === "POST" && revision) {
      revision = { ...revision, status: "WITHDRAWN", decidedAt: "2026-11-02T09:00:00.000Z" };
      return route.fulfill({ json: { status: "success", data: { revision } } });
    }
    const replyAttempt = (value: unknown) => route.fulfill({ json: { status: "success", data: { attempt: value } } });
    const exact = () => revision ? { submissionKey: serverKey, baseVersion: 2, status: revision.status, revisionId } : attempt;
    if (url.pathname === `${path}/attempts`) {
      if (method === "GET") {
        if (url.searchParams.has("submissionKey")) {
          if (failure === "exact-unavailable" || caller !== attemptOwner ||
            url.searchParams.get("submissionKey") !== serverKey || !exact()) {
            return route.fulfill({ status: 404, json: { message: "fixture-internal-error" } });
          }
          return replyAttempt(exact());
        }
        lookedUpOpen = true;
        return replyAttempt(attempt?.status === "OPEN" && caller === attemptOwner ? attempt : null);
      }
      expect(lookedUpOpen).toBe(true);
      const body = route.request().postDataJSON() as { submissionKey?: string; baseVersion: number };
      expect(body.submissionKey).toBeUndefined();
      attempt = { submissionKey: serverKey, baseVersion: body.baseVersion, status: "OPEN" };
      attemptOwner = caller;
      await options.beforeReserveReply?.();
      if (options.beforeReserveReply) {
        // The fixture may commit the reservation even after Chrome aborts the old editor's request.
        await replyAttempt(attempt).catch(() => undefined);
        return;
      }
      return failure === "reserve-timeout" ? route.fulfill({ status: 408, json: {} }) : replyAttempt(attempt);
    }
    if (url.pathname === `${path}/attempts/${serverKey}/settlement` && method === "PUT" && attempt) {
      expect(route.request().headers()["x-csrf-token"]).toBe("fixture");
      attempt = { ...attempt, status: "RETIRED" };
      return replyAttempt(exact());
    }
    if (url.pathname !== path) return route.fulfill({ status: 404, json: {} });
    if (method === "GET") {
      if (options.failedHistory?.()) return route.fulfill({ status: 503, json: {} });
      const stale = revision && options.staleHistory?.();
      return failure === "read"
        ? route.fulfill({ status: 404, json: { message: "fixture-internal-error" } })
        : route.fulfill({ json: { status: "success", data: {
          product: stale ? live : publicListing,
          revisions: revision ? [stale ? { ...revision, status: "PENDING_REVIEW" } : revision] : [],
        } } });
    }
    expect(lookedUpOpen).toBe(true);
    expect(route.request().postDataJSON().submissionKey).toBe(serverKey);
    expect(attempt?.status).toBe("OPEN");
    submissions++;
    if (failure === "conflict") return route.fulfill({ status: 409, json: { message: "fixture-internal-error" } });
    const { title, description, price, salePrice } = publicListing;
    const next = {
      id: revisionId, productId, baseVersion: 2, status: committedStatus,
      createdAt: "2026-11-01T09:00:00.000Z", decidedAt: null, sellerVisibleReason: null,
      payload: { title, description, price, salePrice, ...(writes.at(-1)?.body as { changes: object }).changes, schemaVersion: 1 },
    };
    if (submissions === 1 && failure) {
      if (commitBeforeFailure) {
        revision = next;
        attempt = null;
        if (committedStatus === "APPROVED") publicListing.listingVersion = 3;
      }
      return route.fulfill(failure === "malformed"
        ? { status: 201, json: { status: "success", data: {} } }
        : { status: failure === "timeout" ? 408 : 500, json: { message: "fixture-internal-error" } });
    }
    revision = next;
    attempt = null;
    return route.fulfill({ status: 201, json: { status: "success", data: { revision } } });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/seller-edit`);
  expect(errors).toEqual([]);
  return writes;
}

test("mobile seller stages only an explicit revision while the approved listing stays unchanged", async ({ page }, info) => {
  const writes = await openPanel(page);
  const submit = page.getByRole("button", { name: "Submit revision for review" });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Title", { exact: true }).fill("Proposed desk lamp");
  await expect(submit).toBeEnabled();
  expect(writes).toEqual([]);
  const price = await page.getByLabel("Price (K)", { exact: true }).boundingBox();
  const sale = await page.getByLabel("Sale price (K)", { exact: true }).boundingBox();
  await expect(submit).toHaveCSS("display", "inline-flex");
  expect(sale!.y).toBeGreaterThan(price!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: info.outputPath("mobile-editor.png"), fullPage: true });
  await submit.click();
  await expect(page.getByRole("region", { name: "Pending revision" })).toContainText("Proposed desk lamp");
  await expect(page.getByRole("region", { name: "Current listing" })).toContainText("Approved desk lamp");
  await page.screenshot({ path: info.outputPath("mobile-pending.png"), fullPage: true });
  expect(await page.evaluate(() => fetch("/public-listing").then((response) => response.json()))).toEqual(live);
  const reservation = { baseVersion: 2, changes: { title: "Proposed desk lamp" } };
  expect(writes).toEqual([
    { method: "POST", path: `${path}/attempts`, body: reservation },
    { method: "POST", path, body: { ...reservation, submissionKey: serverKey } },
  ]);
  await page.getByRole("button", { name: "Withdraw revision", exact: true }).click();
  await page.getByRole("button", { name: "Keep in review" }).click();
  expect(writes).toHaveLength(2);
  await page.getByRole("button", { name: "Withdraw revision", exact: true }).click();
  await page.getByRole("button", { name: "Confirm withdrawal" }).click();
  await expect(page.getByRole("region", { name: "Pending revision" })).toHaveCount(0);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(live.title);
  expect(writes[2]).toEqual({ method: "POST", path: `${path}/${revisionId}/withdraw`, body: {} });
  expect(await page.evaluate(() => fetch("/public-listing").then((response) => response.json()))).toEqual(live);
});

test("unknown raw status cannot mount the legacy editor; paused requires actual approval", async ({ page }) => {
  const writes = await openPanel(page, { status: "NEW_UNKNOWN_STATUS" });
  await expect(page.getByRole("alert")).toHaveText("Editing is unavailable because the listing state could not be confirmed.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.unrouteAll();
  await openPanel(page, { status: "PAUSED", isApproved: "true" });
  await expect(page.getByText("This listing is not available for revision.")).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
  await page.unrouteAll();
  const pausedWrites = await openPanel(page, { status: "PAUSED", isApproved: true });
  await page.getByLabel("Title", { exact: true }).fill("Proposed paused lamp");
  await page.getByRole("button", { name: "Submit revision for review" }).click();
  await expect(page.getByText("The listing remains paused during review.")).toBeVisible();
  expect(pausedWrites.map((write) => write.path)).toEqual([`${path}/attempts`, path]);
});

for (const failure of ["timeout", "server", "malformed"] as const) {
  test(`${failure}: lock the draft, refresh history, and never replay or change the key automatically`, async ({ page }) => {
    const writes = await openPanel(page, { failure, commitBeforeFailure: failure === "malformed" });
    const title = page.getByLabel("Title", { exact: true });
    await title.fill("Proposed desk lamp");
    await page.getByRole("button", { name: "Submit revision for review" }).click();
    await expect(page.getByRole("alert")).toHaveText("The submission could not be confirmed. Refresh the listing before trying again.");
    await expect(title).toBeDisabled();
    await expect(page.getByRole("button", { name: "Retry same submission" })).toHaveCount(0);
    expect(writes).toHaveLength(2);
    await page.getByRole("button", { name: "Refresh listing" }).click();
    if (failure === "malformed") {
      await expect(page.getByRole("region", { name: "Pending revision" })).toContainText("Proposed desk lamp");
      await expect(page.getByRole("button", { name: "Retry same submission" })).toHaveCount(0);
      expect(writes).toHaveLength(2);
      return;
    }
    await expect(title).toHaveValue("Proposed desk lamp");
    await expect(title).toBeDisabled();
    expect(writes).toHaveLength(2);
    await page.getByRole("button", { name: "Retry same submission" }).click();
    await expect(page.getByRole("region", { name: "Pending revision" })).toBeVisible();
    expect(writes).toEqual([writes[0], writes[1], writes[1]]);
  });
}

test("conflict blocks further writes until explicit refresh; unavailable history never exposes editing", async ({ page }) => {
  const writes = await openPanel(page, { failure: "conflict" });
  await page.getByLabel("Title", { exact: true }).fill("Proposed desk lamp");
  await page.getByRole("button", { name: "Submit revision for review" }).click();
  await expect(page.getByRole("alert")).toHaveText("Refresh the listing revision before trying again.");
  await expect(page.getByRole("button", { name: "Submit revision for review" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh listing" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeDisabled();
  expect(writes.map(({ method, path }) => ({ method, path }))).toEqual([
    { method: "POST", path: `${path}/attempts` }, { method: "POST", path },
  ]);
  await page.unrouteAll();
  const unavailableWrites = await openPanel(page, { failure: "read" });
  await expect(page.getByRole("alert")).toHaveText("This listing revision action is not available.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
  expect(unavailableWrites).toEqual([]);
});

test("A5 draft snapshot guard blocks missing or malformed timestamps without changing valid or flag-off entry", async ({ page }) => {
  const draft = { status: "DRAFT", isApproved: false, approvedAt: null };
  for (const updatedAt of [null, "1234"]) {
    const writes = await openPanel(page, { ...draft, updatedAt });
    await expect(page.getByRole("alert")).toHaveText("Editing is unavailable because the listing state could not be confirmed.");
    await expect(page.getByRole("heading", { name: "Edit Product" })).toHaveCount(0);
    expect(writes).toEqual([]);
    await page.unrouteAll();
  }
  const validWrites = await openPanel(page, draft);
  await expect(page.getByRole("heading", { name: "Edit Product" })).toBeVisible();
  expect(validWrites).toEqual([]);
  await page.unrouteAll();
  const offWrites = await openPanel(page, { ...draft, updatedAt: null, flagOff: true });
  await expect(page.getByRole("heading", { name: "Edit Product" })).toBeVisible();
  expect(offWrites).toEqual([]);
});

test("A5 reload receipt is seller-scoped and needs exact settlement, not a version guess", async ({ page }) => {
  const writes = await openPanel(page, { failure: "server" });
  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Unconfirmed desk lamp");
  await page.getByRole("button", { name: "Submit revision for review" }).click();
  await expect(page.getByRole("alert")).toContainText("The submission could not be confirmed.");
  const key = `zogular:a5-attempt:v1:${sellerA}:${productId}`;
  const receipt = await page.evaluate((name) => JSON.parse(sessionStorage.getItem(name)!), key);
  expect(receipt).toEqual({ baseVersion: 2, submissionKey: serverKey });

  await page.reload();
  await expect(page.getByRole("region", { name: "Open submission" })).toBeVisible();
  await expect(title).toHaveValue(live.title);
  await expect(title).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry same submission" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retire submission" }).click();
  await page.getByRole("button", { name: "Keep submission" }).click();
  expect(writes).toHaveLength(2);

  await page.unrouteAll();
  const otherWrites = await openPanel(page, { sellerId: sellerB });
  await expect(title).toBeEnabled();
  expect(otherWrites).toEqual([]);
  expect(await page.evaluate((name) => JSON.parse(sessionStorage.getItem(name)!), key)).toEqual(receipt);

  await page.unrouteAll();
  const unresolvedWrites = await openPanel(page, { listingVersion: 3, failure: "exact-unavailable" });
  await expect(title).toBeDisabled();
  expect(await page.evaluate((name) => JSON.parse(sessionStorage.getItem(name)!), key)).toEqual(receipt);
  expect(unresolvedWrites).toEqual([]);
});

test("lost reserve response is recovered after reload and retirement requires an explicit PUT", async ({ page }) => {
  const writes = await openPanel(page, { failure: "reserve-timeout" });
  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Proposed desk lamp");
  await page.getByRole("button", { name: "Submit revision for review" }).click();
  await expect(page.getByRole("alert")).toHaveText("The submission could not be confirmed. Refresh the listing before trying again.");
  expect(writes.map(({ path }) => path)).toEqual([`${path}/attempts`]);
  await page.reload();
  await expect(title).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry same submission" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retire submission" }).click();
  await page.getByRole("button", { name: "Confirm retirement" }).click();
  await expect(page.getByRole("status")).toHaveText("The unused submission was retired.");
  await expect(title).toBeEnabled();
  expect(writes[1]).toEqual({ method: "PUT", path: `${path}/attempts/${serverKey}/settlement`, body: {} });
});

test("a delayed reservation cannot submit after the mounted seller identity changes", async ({ page }) => {
  let activeSeller = sellerA;
  let reserveStarted!: () => void;
  let releaseReserve!: () => void;
  const started = new Promise<void>((resolve) => { reserveStarted = resolve; });
  const release = new Promise<void>((resolve) => { releaseReserve = resolve; });
  const writes = await openPanel(page, {
    sellerForRequest: () => activeSeller,
    beforeReserveReply: async () => { reserveStarted(); await release; },
  });
  const title = page.getByLabel("Title", { exact: true });
  const switchSeller = async (sellerId: string) => {
    activeSeller = sellerId;
    await page.evaluate((id) => window.dispatchEvent(new CustomEvent("fixture-seller-switch", { detail: id })), sellerId);
  };
  try {
    await title.fill("Only the old seller proposed this");
    await page.getByRole("button", { name: "Submit revision for review" }).click();
    await started;
    await switchSeller(sellerB);
    await expect(title).toHaveValue(live.title);
    await expect(title).toBeEnabled();
    await expect(page.getByRole("region", { name: "Open submission" })).toHaveCount(0);
    releaseReserve();
    await switchSeller(sellerA);
    await expect(page.getByRole("region", { name: "Open submission" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry same submission" })).toHaveCount(0);
    expect(writes.map(({ method, path }) => ({ method, path }))).toEqual([{ method: "POST", path: `${path}/attempts` }]);
  } finally {
    releaseReserve();
  }
});

test("terminal readback locks stale or failed history and recovers only after confirmation", async ({ page }) => {
  let stale = true;
  let failRefetch = false;
  let reads = 0;
  const writes = await openPanel(page, {
    failure: "malformed", commitBeforeFailure: true, committedStatus: "APPROVED",
    staleHistory: () => stale,
    failedHistory: () => failRefetch && ++reads === 2,
  });
  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Approved desk lamp revision");
  await page.getByRole("button", { name: "Submit revision for review" }).click();
  await expect(page.getByRole("alert")).toContainText("could not be confirmed");
  const refresh = page.getByRole("button", { name: "Refresh listing" });
  const locked = page.getByText("A new revision is locked because the previous submission cannot be confirmed.");
  const approved = page.getByText("The earlier revision was approved.");
  await refresh.click();
  await expect(locked).toBeVisible();
  await expect(title).toBeDisabled();
  await expect(approved).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Withdraw revision" })).toHaveCount(0);
  const key = `zogular:a5-attempt:v1:${sellerA}:${productId}`;
  expect(await page.evaluate((name) => sessionStorage.getItem(name), key)).not.toBeNull();

  stale = false;
  failRefetch = true;
  await refresh.click();
  await expect(locked).toBeVisible();
  await expect(approved).toHaveCount(0);
  failRefetch = false;
  await refresh.click();
  await expect(approved).toBeVisible();
  await expect(title).toBeEnabled();
  expect(await page.evaluate((name) => sessionStorage.getItem(name), key)).toBeNull();
  expect(writes).toHaveLength(2);
});

for (const [status, message] of [
  ["APPROVED", "The earlier revision was approved."],
  ["NEEDS_CHANGES", "The earlier revision needs changes."],
  ["WITHDRAWN", "The earlier revision was withdrawn."],
] as const) {
  test(`reload reconciles an exact ${status} without sending another write`, async ({ page }) => {
    const writes = await openPanel(page, { failure: "malformed", commitBeforeFailure: true, committedStatus: status });
    const title = page.getByLabel("Title", { exact: true });
    await title.fill("Proposed desk lamp");
    await page.getByRole("button", { name: "Submit revision for review" }).click();
    await expect(page.getByRole("alert")).toContainText("The submission could not be confirmed.");
    await page.reload();
    await expect(page.getByRole("status")).toHaveText(message);
    await expect(title).toBeEnabled();
    expect(writes).toHaveLength(2);
  });
}
});
