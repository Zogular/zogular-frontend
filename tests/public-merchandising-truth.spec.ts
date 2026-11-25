import { expect, test, type BrowserContext, type Locator, type Page, type Request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { ApiError } from "../src/services/api";
import { auditPageLayout, containAuditNetwork, loopbackAuditOrigin } from "./helpers/ui-audit-checks";
import {
  getHomeNewArrivals,
  ProductListContractError,
} from "../src/services/products";

const originalFetch = globalThis.fetch;

const backendProduct = {
  id: "arrival-1",
  slug: "samsung-galaxy-a55-5g",
  title: "Samsung Galaxy A55 5G",
  description: "Current public product.",
  price: 6_499,
  salePrice: null,
  images: [
    {
      url: "https://res.cloudinary.com/example/image/upload/arrival-1.webp",
      alt: "Samsung Galaxy A55 5G front view",
      isPrimary: true,
      sortOrder: 0,
      linkedVariantValue: null,
      width: 900,
      height: 1200,
    },
  ],
  category: "ELECTRONICS",
  categorySlug: "electronics",
  subcategorySlug: null,
  stock: 4,
  isSold: false,
  user: { id: "opaque-owner-id" },
  reviews: [
    {
      rating: 5,
      user: { firstName: "Review", lastName: "Author" },
    },
  ],
};

function collectionResponse(products: unknown[], results = products.length) {
  return {
    status: "success",
    results,
    data: { products, days: 7 },
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test.describe.serial("public merchandising service contract", () => {
  test.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("new arrivals uses only the dedicated public endpoint and preserves backend order", async () => {
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return jsonResponse(
        collectionResponse([
          backendProduct,
          { ...backendProduct, id: "arrival-2", slug: "arrival-2", title: "Second arrival" },
        ]),
      );
    };

    const products = await getHomeNewArrivals(20);

    expect(products.map((product) => product.id)).toEqual(["arrival-1", "arrival-2"]);
    expect(requests).toHaveLength(1);
    const requestedUrl = new URL(requests[0]);
    expect(requestedUrl.pathname).toBe("/api/v1/products/new-arrivals");
    expect(requestedUrl.searchParams.get("limit")).toBe("20");
  });

  test("an empty dedicated response stays empty", async () => {
    globalThis.fetch = async () => jsonResponse(collectionResponse([]));

    await expect(getHomeNewArrivals()).resolves.toEqual([]);
  });

  test("backend unavailability remains a typed API failure", async () => {
    globalThis.fetch = async () =>
      jsonResponse({ status: "error", message: "Service unavailable" }, 503);

    await expect(getHomeNewArrivals()).rejects.toMatchObject({
      name: ApiError.name,
      status: 503,
    });
  });

  test("timeout remains a typed API failure", async () => {
    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Request aborted", "AbortError")),
          { once: true },
        );
      });

    await expect(getHomeNewArrivals(10, { timeout: 5 })).rejects.toMatchObject({
      name: ApiError.name,
      status: 408,
    });
  });

  test("malformed collection metadata cannot become an empty success", async () => {
    for (const payload of [
      null,
      {},
      { status: "success", results: 0, data: {} },
      collectionResponse([backendProduct], 2),
    ]) {
      globalThis.fetch = async () => jsonResponse(payload);
      await expect(getHomeNewArrivals()).rejects.toBeInstanceOf(ProductListContractError);
    }
  });

  test("a malformed required product cannot become a fabricated card", async () => {
    globalThis.fetch = async () =>
      jsonResponse(collectionResponse([{ ...backendProduct, title: "" }]));

    await expect(getHomeNewArrivals()).rejects.toBeInstanceOf(ProductListContractError);
  });

  test("public owner ID is preserved without deriving store identity from review authors", async () => {
    globalThis.fetch = async () => jsonResponse(collectionResponse([backendProduct]));

    const [product] = await getHomeNewArrivals();

    expect(product.ownerId).toBe("opaque-owner-id");
    expect(product.storeName).toBeUndefined();
    expect(JSON.stringify(product)).not.toContain("Review Author");
  });
});

test("route sources prohibit generic New Arrivals and fabricated storefront fallbacks", () => {
  const newArrivalsSource = fs.readFileSync(
    path.resolve("src/app/(consumer)/new-arrivals/page.tsx"),
    "utf8",
  );
  const storeSource = fs.readFileSync(
    path.resolve("src/app/(consumer)/store/[slug]/page.tsx"),
    "utf8",
  );
  const unavailableSource = fs.readFileSync(
    path.resolve("src/app/(consumer)/new-arrivals/NewArrivalsUnavailable.tsx"),
    "utf8",
  );

  expect(newArrivalsSource).toContain("getHomeNewArrivals(20)");
  expect(newArrivalsSource).not.toMatch(
    /getSearchableProducts|sort\(|reviews|fallback|getSellerProducts/,
  );
  expect(storeSource).toContain("notFound()");
  expect(storeSource).not.toMatch(
    /getSearchableProducts|getSellerProducts|ProductCollectionPage|category|humanize|Storefront/,
  );
  expect(unavailableSource).toContain("window.location.reload()");
  expect(unavailableSource).toContain("retryStartedRef.current");
  expect(unavailableSource).not.toMatch(/router\.refresh|useTransition/);
});

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
  frameworkPrefetchCancellations: string[];
  expectedStoreDocument404s: string[];
};

type ResponseDiagnostic = {
  method: string;
  resourceType: string;
  status: number;
  url: string;
};

const testedStorePath = "/store/arbitrary-market";

type PrefetchCancellationDiagnostic = {
  failure: string;
  method: string;
  resourceType: string;
  url: string;
  headers: Record<string, string | undefined>;
};

function isExpectedTestStoreNotFound(
  response: ResponseDiagnostic,
  expectedOrigin: string | null,
): boolean {
  const url = new URL(response.url);
  return expectedOrigin !== null
    && response.method === "GET"
    && response.resourceType === "document"
    && response.status === 404
    && url.origin === expectedOrigin
    && url.pathname === testedStorePath
    && url.search === "";
}

async function installLocalTelemetryFixtureRoutes(page: Page, origin: string): Promise<void> {
  const expectedOrigin = new URL(origin);
  if (expectedOrigin.protocol !== "http:") {
    throw new Error("Local telemetry fixtures require the isolated HTTP frontend origin.");
  }
  for (const pathname of ["/_vercel/insights/script.js", "/_vercel/speed-insights/script.js"]) {
    await page.route(`${origin}${pathname}`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const isExactFixtureDependency = request.method() === "GET"
        && request.resourceType() === "script"
        && url.protocol === expectedOrigin.protocol
        && url.hostname === expectedOrigin.hostname
        && url.port === expectedOrigin.port
        && url.pathname === pathname
        && url.search === "";
      if (!isExactFixtureDependency) {
        await route.continue();
        return;
      }
      await route.fulfill({
        body: "",
        contentType: "application/javascript",
        status: 200,
      });
    });
  }
}

async function settleRenderedNavigation(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
  await page.waitForLoadState("networkidle");
}

function createFrameworkPrefetchTracker(page: Page, expectedOrigin: string) {
  const active = new Set<Request>();
  const lifecycle: string[] = [];
  let revision = 0;

  const isPrefetchRequest = (request: Request) => {
    const url = new URL(request.url());
    const headers = request.headers();
    return request.method() === "GET"
      && request.resourceType() === "fetch"
      && url.origin === expectedOrigin
      && [...url.searchParams.keys()].length === 1
      && url.searchParams.has("_rsc")
      && headers.rsc === "1"
      && headers["next-router-prefetch"] === "1"
      && (headers["next-router-segment-prefetch"] === undefined
        || headers["next-router-segment-prefetch"] === "/_tree");
  };
  const recordTerminal = (event: "finished" | "failed", request: Request) => {
    if (!active.delete(request)) return;
    revision += 1;
    lifecycle.push(`${event} ${request.url()}`);
  };

  page.on("request", (request) => {
    if (!isPrefetchRequest(request)) return;
    active.add(request);
    revision += 1;
    lifecycle.push(`request ${request.url()}`);
  });
  page.on("requestfinished", (request) => recordTerminal("finished", request));
  page.on("requestfailed", (request) => recordTerminal("failed", request));

  return {
    lifecycle,
    async waitForQuiescence() {
      let previousRevision = -1;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            requestIdleCallback(() => resolve(), { timeout: 1_000 });
          });
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
        });
        await page.waitForLoadState("networkidle");
        if (active.size === 0 && revision === previousRevision) return;
        previousRevision = revision;
      }
      throw new Error(
        `Framework prefetches did not settle: ${JSON.stringify({ active: active.size, lifecycle })}`,
      );
    },
  };
}

function isFrameworkLinkPrefetchCancellation(
  diagnostic: PrefetchCancellationDiagnostic,
  expectedOrigin: string,
): boolean {
  const url = new URL(diagnostic.url);
  return diagnostic.failure === "net::ERR_ABORTED"
    && diagnostic.method === "GET"
    && diagnostic.resourceType === "fetch"
    && url.origin === expectedOrigin
    && [...url.searchParams.keys()].length === 1
    && url.searchParams.has("_rsc")
    && diagnostic.headers.rsc === "1"
    && diagnostic.headers["next-router-prefetch"] === "1"
    && (diagnostic.headers["next-router-segment-prefetch"] === undefined
      || diagnostic.headers["next-router-segment-prefetch"] === "/_tree");
}

function collectDiagnostics(
  page: Page,
  expectedOrigin: string,
  getPhase: () => string = () => "unclassified",
): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    frameworkPrefetchCancellations: [],
    expectedStoreDocument404s: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    const headers = request.headers();
    const diagnostic = `${getPhase()} ${failure} ${request.method()} ${request.resourceType()}`
      + ` ${request.url()} prefetch=${headers["next-router-prefetch"] ?? ""}`
      + ` segment=${headers["next-router-segment-prefetch"] ?? ""}`;
    if (isFrameworkLinkPrefetchCancellation({
      failure,
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
      headers,
    }, expectedOrigin)) {
      diagnostics.frameworkPrefetchCancellations.push(diagnostic);
    } else {
      diagnostics.failedRequests.push(diagnostic);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const isExpectedStore404 = isExpectedTestStoreNotFound(
        {
          method: response.request().method(),
          resourceType: response.request().resourceType(),
          status: response.status(),
          url: response.url(),
        },
        expectedOrigin,
      );
      if (isExpectedStore404) {
        diagnostics.expectedStoreDocument404s.push(
          `${response.status()} ${response.request().method()} ${response.request().resourceType()} ${response.url()}`,
        );
      } else {
        diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
      }
    }
  });
  return diagnostics;
}

test("diagnostics isolate only exact store 404 and framework-prefetch signatures", () => {
  const expectedOrigin = "https://fixture.zogular.test";
  const expectedResponse: ResponseDiagnostic = {
    method: "GET",
    resourceType: "document",
    status: 404,
    url: `${expectedOrigin}${testedStorePath}`,
  };
  const unrelatedStoreResponse: ResponseDiagnostic = {
    ...expectedResponse,
    url: `${expectedOrigin}/store/unrelated-market`,
  };

  expect(isExpectedTestStoreNotFound(expectedResponse, expectedOrigin)).toBe(true);
  expect(isExpectedTestStoreNotFound(unrelatedStoreResponse, expectedOrigin)).toBe(false);

  let caughtNegativeControl: unknown;
  try {
    expect(isExpectedTestStoreNotFound(unrelatedStoreResponse, expectedOrigin)).toBe(true);
  } catch (error) {
    caughtNegativeControl = error;
  }
  expect(caughtNegativeControl).toBeInstanceOf(Error);

  const exactPrefetchCancellation: PrefetchCancellationDiagnostic = {
    failure: "net::ERR_ABORTED",
    method: "GET",
    resourceType: "fetch",
    url: `${expectedOrigin}/about?_rsc=fixture-key`,
    headers: {
      rsc: "1",
      "next-router-prefetch": "1",
      "next-router-segment-prefetch": "/_tree",
    },
  };
  expect(isFrameworkLinkPrefetchCancellation(exactPrefetchCancellation, expectedOrigin)).toBe(true);
  for (const unrelatedFailure of [
    { ...exactPrefetchCancellation, failure: "net::ERR_FAILED" },
    { ...exactPrefetchCancellation, method: "POST" },
    { ...exactPrefetchCancellation, resourceType: "script" },
    { ...exactPrefetchCancellation, url: `${expectedOrigin}/about?_rsc=fixture-key&extra=1` },
    { ...exactPrefetchCancellation, url: "https://unrelated.example/about?_rsc=fixture-key" },
    { ...exactPrefetchCancellation, headers: { ...exactPrefetchCancellation.headers, "next-router-prefetch": undefined } },
    { ...exactPrefetchCancellation, headers: { ...exactPrefetchCancellation.headers, "next-router-segment-prefetch": "/unexpected" } },
  ]) {
    expect(isFrameworkLinkPrefetchCancellation(unrelatedFailure, expectedOrigin)).toBe(false);
  }
});

const useLocalFixture = process.env.PUBLIC_MERCHANDISING_LOCAL_FIXTURE === "1";
const localAppOrigin = "http://127.0.0.1:3259";
const localFixtureOrigin = "http://127.0.0.1:5059";
const browserBaseUrl = useLocalFixture ? localAppOrigin : process.env.PUBLIC_MERCHANDISING_BASE_URL;
const fixtureControlUrl = useLocalFixture ? localFixtureOrigin : process.env.PUBLIC_MERCHANDISING_FIXTURE_URL;
const fixtureImagePath = "/__storefront-fixture/arrival.svg";
const rawCategoryDiagnostic = "FIXTURE_CATEGORY_UPSTREAM_503 correlation=synthetic-581";
const longCategoryName = "AccessoriesAndEquipmentForHomeElectronicsAndProfessionalAudioSystems";
const longSubcategoryName = "ReplacementComponentsAndMountingAccessoriesForHomeAudioSystems";
const fixtureCategory = {
  id: "accessories", slug: "accessories", name: longCategoryName, description: "Home and audio accessories",
  icon: null, parentId: null, isActive: true, sortOrder: 1, _count: { products: 1 },
};
const fixtureCategories = [{
  ...fixtureCategory,
  children: [{ ...fixtureCategory, id: "components", slug: "components", name: longSubcategoryName, parentId: fixtureCategory.id }],
}];
const standardCategories = [{ ...fixtureCategory, name: "Accessories" }];

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL, serviceWorkers: "block" });

let localApi: Server | undefined;
let localNext: ChildProcess | undefined;

// Keep the existing fixture-control URL contract and run the production app on loopback.
test.beforeAll(async () => {
  if (!useLocalFixture) return;
  let arrivalsMode = "success";
  let categoriesMode = "standard";
  localApi = createServer((request, response) => {
    const url = new URL(request.url ?? "/", localFixtureOrigin);
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(value));
    };
    if (request.method !== "GET") return send(405, { status: "fail" });
    switch (url.pathname) {
      case "/__fixture": {
        const mode = url.searchParams.get("mode");
        const categoryMode = url.searchParams.get("categories");
        if (mode) {
          arrivalsMode = mode;
          categoriesMode = "standard";
        }
        if (categoryMode) categoriesMode = categoryMode;
        return send(200, { arrivalsMode, categoriesMode });
      }
      case "/api/v1/categories": {
        if (categoriesMode === "unavailable") return send(503, { status: "fail", message: rawCategoryDiagnostic });
        const categories = categoriesMode === "empty" ? [] : categoriesMode === "standard" ? standardCategories : fixtureCategories;
        return send(200, { status: "success", results: categories.length, data: { categories } });
      }
      case "/api/v1/user/me":
        return send(200, { status: "success", data: { user: {
          id: "storefront-buyer", firstName: "Fixture", lastName: "Buyer", email: "buyer@example.test", role: "buyer",
        } } });
      case "/api/v1/cart":
        return send(200, { status: "success", data: { cart: {
          id: "00000000-0000-4000-8000-000000000001", items: [],
          summary: { totalItems: 0, uniqueItems: 0, subtotal: 0 },
        } } });
      case "/api/v1/wishlist":
        return send(200, { status: "success", results: 0, data: { items: [] },
          pagination: { page: 1, limit: 100, total: 0, pages: 0 } });
      case "/api/v1/products/new-arrivals":
        if (arrivalsMode === "unavailable") return send(503, { status: "fail", message: "Synthetic arrivals failure" });
        return send(200, collectionResponse(arrivalsMode === "empty" ? [] : [{
          ...backendProduct, images: backendProduct.images.map((image) => ({ ...image, url: fixtureImagePath })),
        }]));
      default:
        return send(404, { status: "fail", message: "Fixture route not found" });
    }
  });
  localApi.listen(5059, "127.0.0.1");
  await once(localApi, "listening");

  const cwd = path.resolve(__dirname, "..");
  const apiBase = `${localFixtureOrigin}/api/v1`;
  localNext = spawn(process.execPath, [path.resolve(cwd, "node_modules/next/dist/bin/next"), "start",
    "--hostname", "127.0.0.1", "--port", "3259"], {
    cwd,
    env: { ...process.env, INTERNAL_BACKEND_URL: apiBase, NEXT_PUBLIC_API_URL: apiBase, NEXT_PUBLIC_API_PROXY_URL: "/api/backend" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  for (const stream of [localNext.stdout, localNext.stderr]) {
    stream?.on("data", (chunk: Buffer) => { logs = (logs + chunk.toString()).slice(-3500); });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    if (localNext.exitCode !== null) break;
    const response = await originalFetch(`${localAppOrigin}/categories`, { signal: AbortSignal.timeout(500) }).catch(() => null);
    if (response?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Merchandising fixture needs a runnable production build.\n${logs}`);
});

test.afterAll(async () => {
  if (localNext && localNext.exitCode === null && localNext.signalCode === null && localNext.pid) {
    const exited = once(localNext, "exit");
    localNext.kill();
    await exited;
  }
  if (localApi?.listening) {
    const closed = once(localApi, "close");
    localApi.close();
    localApi.closeAllConnections();
    await closed;
  }
});

async function containMerchandisingContext(context: BrowserContext, origin: string) {
  await containAuditNetwork(context, [origin]);
  if (useLocalFixture) {
    await context.route(`${origin}${fixtureImagePath}`, (route) => route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="120"><rect width="90" height="120" fill="#065f46"/></svg>',
    }));
  }
}

const browserViewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

for (const viewport of browserViewports.filter(({ width }) => width !== 768)) {
  test(`category discovery separates empty, search miss and recovery at ${viewport.name}`, async ({ page, request }, testInfo) => {
    test.skip(!useLocalFixture, "Category discovery requires the isolated merchandising fixture.");
    const origin = loopbackAuditOrigin(browserBaseUrl!);
    await containMerchandisingContext(page.context(), origin);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const setCategories = async (mode: "success" | "empty" | "unavailable") => {
      await expect(await request.get(`${localFixtureOrigin}/__fixture?categories=${mode}`)).toBeOK();
    };
    const categoryResponse = (status: number) => page.waitForResponse((response) =>
      response.url() === `${origin}/api/backend/categories` && response.status() === status,
    );

    await setCategories("success");
    await page.goto(`${origin}/categories`);
    const directory = page.getByRole("main");
    await expect(page.locator("main")).toHaveCount(1);
    const search = directory.getByRole("textbox", { name: "Search categories" });
    const category = directory.getByRole("link", { name: longCategoryName, exact: true });
    const subcategory = directory.getByRole("link", { name: longSubcategoryName, exact: true });
    const viewAll = directory.getByRole("link", { name: `View All ${longCategoryName}`, exact: true });
    await expect(category).toHaveAttribute("href", "/category/accessories");
    await expect(subcategory).toHaveAttribute("href", "/category/accessories?subcategory=components");
    await expect(viewAll).toHaveAttribute("href", "/category/accessories");
    for (const link of [category, subcategory, viewAll]) {
      expect(await link.evaluate((element) => {
        const tile = element.closest(".group");
        if (!tile) return false;
        const range = document.createRange();
        range.selectNodeContents(element);
        const tileBounds = tile.getBoundingClientRect();
        return [...range.getClientRects()].every((rect) =>
          rect.left >= tileBounds.left - 1 && rect.right <= tileBounds.right + 1,
        );
      }), "long link text stays inside the category tile").toBe(true);
    }
    await auditPageLayout(page);
    await viewAll.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("categories-long-labels.png"), animations: "disabled" });

    await search.fill("  replacementcomponents  ");
    await expect(category).toBeVisible();
    const unmatched = "UnmatchedCategory".repeat(5);
    await search.fill(`  ${unmatched}  `);
    await expect(directory.getByRole("heading", { name: "No matching categories" })).toBeVisible();
    await expect(directory.getByText(`No categories match "${unmatched}". Try a different search term.`, { exact: true })).toBeVisible();
    await expect(directory.getByRole("heading", { name: "No categories are available yet" })).toHaveCount(0);
    await auditPageLayout(page);
    await page.screenshot({ path: testInfo.outputPath("categories-search-miss.png"), animations: "disabled" });
    await directory.getByRole("button", { name: "Clear Search" }).click();
    await expect(search).toHaveValue("");
    await expect(category).toBeVisible();

    await setCategories("empty");
    await Promise.all([categoryResponse(200), page.reload()]);
    await expect(directory.getByRole("heading", { name: "No categories are available yet" })).toBeVisible();
    await search.fill("electronics");
    await expect(directory.getByRole("heading", { name: "No categories are available yet" })).toBeVisible();
    await expect(directory.getByRole("button", { name: "Clear Search" })).toHaveCount(0);
    await expect(directory.getByRole("button", { name: "Retry" })).toHaveCount(0);
    const browse = directory.getByRole("link", { name: "Browse all products", exact: true });
    await expect(browse).toHaveAttribute("href", "/products");
    await browse.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("categories-empty.png"), animations: "disabled" });

    await setCategories("unavailable");
    const [failed] = await Promise.all([categoryResponse(503), page.reload()]);
    expect(await failed.text()).toContain(rawCategoryDiagnostic);
    const unavailable = directory.getByRole("heading", { name: "Categories are temporarily unavailable" });
    await expect(unavailable).toBeVisible();
    await expect(directory.getByText("We couldn't load categories. Try again to see what's available.", { exact: true })).toBeVisible();
    await expect(page.getByText(rawCategoryDiagnostic, { exact: false })).toHaveCount(0);
    await expect(directory.getByRole("heading", { name: "No categories are available yet" })).toHaveCount(0);
    const retry = directory.getByRole("button", { name: "Retry" });
    await retry.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("categories-unavailable.png"), animations: "disabled" });

    await setCategories("success");
    await Promise.all([categoryResponse(200), retry.click()]);
    await expect(category).toBeVisible();
    await expect(unavailable).toHaveCount(0);
  });
}

async function textOverflowsControl(locator: Locator) {
  return locator.evaluate((element) => {
    const control = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    return Array.from(range.getClientRects()).some((rect) => rect.left < control.left - 1 || rect.right > control.right + 1);
  });
}

test("VIS-06 mobile category drawer contains category labels at 320px", async ({ page, request }, testInfo) => {
  test.skip(!useLocalFixture, "Navbar containment requires the isolated merchandising fixture.");
  const origin = loopbackAuditOrigin(browserBaseUrl!);
  await containMerchandisingContext(page.context(), origin);
  await expect(await request.get(`${localFixtureOrigin}/__fixture?mode=success&categories=success`)).toBeOK();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${origin}/new-arrivals`);
  const menu = page.getByRole("button", { name: "Open menu", exact: true });
  await menu.click();
  const drawer = page.getByRole("dialog", { name: "Shop menu", exact: true });
  const topLink = drawer.getByRole("link", { name: longCategoryName, exact: true });
  await expect(topLink).toHaveAttribute("href", "/category/accessories");
  await topLink.scrollIntoViewIfNeeded();
  await auditPageLayout(page);
  await page.screenshot({ path: testInfo.outputPath("navbar-mobile-drawer-320.png"), animations: "disabled" });
  expect.soft(await textOverflowsControl(topLink), "Top Categories link text stays inside its tile").toBe(false);

  await drawer.getByRole("button", { name: new RegExp(`^${longCategoryName}`) }).click();
  const browse = drawer.getByText(`Browse ${longCategoryName}`, { exact: true });
  const shop = drawer.getByRole("link", { name: `Shop all ${longCategoryName}`, exact: true });
  const child = drawer.getByRole("link", { name: longSubcategoryName, exact: true });
  const back = drawer.getByRole("button", { name: "Back to categories" });
  await expect(shop).toHaveAttribute("href", "/category/accessories");
  await expect(child).toHaveAttribute("href", "/category/accessories?subcategory=components");
  await auditPageLayout(page);
  await page.screenshot({ path: testInfo.outputPath("navbar-mobile-category-320.png"), animations: "disabled" });
  expect.soft(await textOverflowsControl(browse), "active category heading stays inside its panel").toBe(false);
  expect.soft(await textOverflowsControl(shop), "Shop all text stays inside its link").toBe(false);
  expect.soft((await shop.locator("svg").boundingBox())?.width, "Shop all chevron keeps its width").toBeGreaterThanOrEqual(15);
  expect.soft((await back.boundingBox())?.width, "category back button keeps its width").toBeGreaterThanOrEqual(35);
  await back.click();
  await expect(topLink).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
});

test("VIS-06 category navbar contains long labels without clipping ordinary links", async ({ page, request }, testInfo) => {
  test.skip(!useLocalFixture, "Navbar containment requires the isolated merchandising fixture.");
  const origin = loopbackAuditOrigin(browserBaseUrl!);
  await containMerchandisingContext(page.context(), origin);
  await expect(await request.get(`${localFixtureOrigin}/__fixture?mode=success&categories=success`)).toBeOK();

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${origin}/new-arrivals`);
  const categoryNav = page.locator("header nav").filter({ has: page.locator('a[href="/new-arrivals"]') });
  const longLink = categoryNav.getByRole("link", { name: longCategoryName, exact: true });
  await expect(longLink).toBeVisible();

  for (const width of [768, 820, 1440, 767, 320]) {
    await test.step(`long category at ${width}px`, async () => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : width === 1440 ? 900 : 1024 });
      await settleRenderedNavigation(page);
      await page.screenshot({ path: testInfo.outputPath(`navbar-long-${width}.png`), animations: "disabled" });
      await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
      if (width < 768) {
        await expect(categoryNav).toBeHidden();
        await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
        return;
      }
      await expect(longLink).toHaveAttribute("href", "/category/accessories");
      await expect(longLink).toHaveAttribute("title", longCategoryName);
      await expect(longLink).toHaveCSS("text-overflow", "ellipsis");
      expect(await longLink.evaluate((link) => link.scrollWidth > link.clientWidth)).toBe(true);
      for (const link of [
        categoryNav.getByRole("link", { name: "All Products", exact: true }),
        categoryNav.getByRole("link", { name: "New Arrivals", exact: true }),
        longLink,
      ]) {
        await expect(link).toBeInViewport({ ratio: 1 });
        await link.focus();
        await expect(link).toBeFocused();
      }
    });
  }

  await expect(await request.get(`${localFixtureOrigin}/__fixture?mode=success`)).toBeOK();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();
  const ordinaryLink = categoryNav.getByRole("link", { name: "Accessories", exact: true });
  await expect(ordinaryLink).toHaveAttribute("href", "/category/accessories");
  for (const width of [768, 820, 1440]) {
    await page.setViewportSize({ width, height: 1024 });
    await expect(ordinaryLink).toBeInViewport({ ratio: 1 });
    expect(await ordinaryLink.evaluate((link) => link.scrollWidth <= link.clientWidth)).toBe(true);
  }
});

for (const viewport of browserViewports) {
  test(`source-aligned merchandising routes are truthful at ${viewport.name}`, async ({
    browser,
    page,
    request,
  }) => {
    test.skip(!browserBaseUrl || !fixtureControlUrl, "Source-aligned fixture runtime is not active.");
    const browserOrigin = new URL(browserBaseUrl!).origin;
    await containMerchandisingContext(page.context(), browserOrigin);
    let phase = "initial";
    const diagnostics = collectDiagnostics(page, browserOrigin, () => phase);
    await installLocalTelemetryFixtureRoutes(page, browserOrigin);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await request.get(`${fixtureControlUrl}/__fixture?mode=success`);
    phase = "success-navigation";
    await page.goto(`${browserBaseUrl}/new-arrivals`, { waitUntil: "networkidle" });
    await settleRenderedNavigation(page);
    phase = "success-settled";
    await expect(page.locator("header.sticky")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.getByRole("heading", { name: "New Arrivals", exact: true })).toBeVisible();
    await expect(page.getByText("Samsung Galaxy A55 5G", { exact: true })).toBeVisible();
    await expect(page.getByText("Review Author", { exact: true })).toHaveCount(0);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", viewport.width);
    if (viewport.width < 768) {
      const bottomNavigation = page.getByTestId("mobile-bottom-navigation");
      await expect(bottomNavigation).toBeVisible();
      await expect(bottomNavigation.getByRole("link")).toHaveCount(5);
      const box = await bottomNavigation.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    } else {
      await expect(page.getByTestId("mobile-bottom-navigation")).toBeHidden();
    }
    await page.screenshot({
      path: `output/playwright/public-merchandising-truth/new-arrivals-success-${viewport.name}.png`,
      fullPage: false,
    });

    await request.get(`${fixtureControlUrl}/__fixture?mode=empty`);
    phase = "empty-reload";
    await page.reload({ waitUntil: "networkidle" });
    await settleRenderedNavigation(page);
    phase = "empty-settled";
    await expect(page.getByRole("heading", { name: "No new arrivals yet" })).toBeVisible();
    await expect(page.locator("[data-testid='product-card']")).toHaveCount(0);
    await page.screenshot({
      path: `output/playwright/public-merchandising-truth/new-arrivals-empty-${viewport.name}.png`,
      fullPage: false,
    });

    await request.get(`${fixtureControlUrl}/__fixture?mode=unavailable`);
    phase = "unavailable-reload";
    await page.reload({ waitUntil: "networkidle" });
    await settleRenderedNavigation(page);
    phase = "unavailable-settled";
    await expect(page.getByTestId("new-arrivals-unavailable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await page.screenshot({
      path: `output/playwright/public-merchandising-truth/new-arrivals-unavailable-${viewport.name}.png`,
      fullPage: false,
    });

    expect(diagnostics.badResponses).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
    expect(diagnostics.expectedStoreDocument404s).toEqual([]);
    await test.info().attach(`new-arrivals-prefetch-${viewport.name}`, {
      body: Buffer.from(JSON.stringify(diagnostics.frameworkPrefetchCancellations, null, 2)),
      contentType: "application/json",
    });
    await page.close();
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
    expect(diagnostics.badResponses).toEqual([]);

    const retryContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
    await containMerchandisingContext(retryContext, browserOrigin);
    const retryPage = await retryContext.newPage();
    const retryPrefetchTracker = createFrameworkPrefetchTracker(retryPage, browserOrigin);
    let retryPhase = "unavailable-navigation";
    const retryDiagnostics = collectDiagnostics(retryPage, browserOrigin, () => retryPhase);
    await installLocalTelemetryFixtureRoutes(retryPage, browserOrigin);
    await request.get(`${fixtureControlUrl}/__fixture?mode=unavailable`);
    await retryPage.goto(`${browserBaseUrl}/new-arrivals`, { waitUntil: "networkidle" });
    await settleRenderedNavigation(retryPage);
    retryPhase = "unavailable-settled";
    await expect(retryPage.getByTestId("new-arrivals-unavailable")).toBeVisible();
    await retryPrefetchTracker.waitForQuiescence();

    await request.get(`${fixtureControlUrl}/__fixture?mode=success`);
    retryPhase = "retry-document-navigation";
    let retryDocumentRequests = 0;
    retryPage.on("request", (retryRequest) => {
      const url = new URL(retryRequest.url());
      if (
        retryRequest.method() === "GET"
        && retryRequest.resourceType() === "document"
        && url.origin === browserOrigin
        && url.pathname === "/new-arrivals"
        && url.search === ""
      ) {
        retryDocumentRequests += 1;
      }
    });
    const completedRetryNavigation = retryPage.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET"
        && response.request().resourceType() === "document"
        && response.status() === 200
        && url.origin === browserOrigin
        && url.pathname === "/new-arrivals"
        && url.search === "";
    });
    await Promise.all([
      completedRetryNavigation,
      retryPage.getByRole("button", { name: "Retry" }).click(),
    ]);
    await settleRenderedNavigation(retryPage);
    await expect(retryPage.getByText("Samsung Galaxy A55 5G", { exact: true })).toBeVisible();
    await expect(retryPage.getByTestId("new-arrivals-unavailable")).toHaveCount(0);
    await retryPrefetchTracker.waitForQuiescence();
    retryPhase = "retry-settled";
    expect(retryDocumentRequests).toBe(1);
    expect(retryDiagnostics.consoleErrors).toEqual([]);
    expect(retryDiagnostics.pageErrors).toEqual([]);
    expect(retryDiagnostics.failedRequests).toEqual([]);
    expect(retryDiagnostics.badResponses).toEqual([]);
    expect(retryDiagnostics.expectedStoreDocument404s).toEqual([]);
    await test.info().attach(`retry-prefetch-${viewport.name}`, {
      body: Buffer.from(JSON.stringify(retryDiagnostics.frameworkPrefetchCancellations, null, 2)),
      contentType: "application/json",
    });
    await retryContext.close();

    const storeContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
    await containMerchandisingContext(storeContext, browserOrigin);
    const storePage = await storeContext.newPage();
    const storeDiagnostics = collectDiagnostics(storePage, browserOrigin);
    await installLocalTelemetryFixtureRoutes(storePage, browserOrigin);
    const storeNavigationResponse = await storePage.goto(`${browserBaseUrl}${testedStorePath}`, {
      waitUntil: "networkidle",
    });
    await settleRenderedNavigation(storePage);
    expect(storeNavigationResponse?.status()).toBe(200);
    await expect(storePage.locator("header.sticky")).toBeVisible();
    await expect(storePage.locator("footer")).toBeVisible();
    await expect(storePage.getByRole("heading", { name: "Store unavailable" })).toBeVisible();
    await expect(storePage.getByText(/Storefront|verified listings|seller storefront/i)).toHaveCount(0);
    await expect(storePage.getByRole("link", { name: "Browse products" })).toBeVisible();
    await expect(storePage.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(storePage.locator("html")).toHaveJSProperty("scrollWidth", viewport.width);
    await storePage.screenshot({
      path: `output/playwright/public-merchandising-truth/store-unavailable-${viewport.name}.png`,
      fullPage: false,
    });

    expect(storeDiagnostics).toEqual({
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      badResponses: [],
      frameworkPrefetchCancellations: storeDiagnostics.frameworkPrefetchCancellations,
      expectedStoreDocument404s: [],
    });
    await test.info().attach(`store-prefetch-${viewport.name}`, {
      body: Buffer.from(JSON.stringify(storeDiagnostics.frameworkPrefetchCancellations, null, 2)),
      contentType: "application/json",
    });
    await storeContext.close();

    fs.writeFileSync(
      path.resolve(`output/playwright/public-merchandising-truth/diagnostics-${viewport.name}.json`),
      `${JSON.stringify({ main: diagnostics, retry: retryDiagnostics, retryDocumentRequests, retryPrefetchLifecycle: retryPrefetchTracker.lifecycle, store: storeDiagnostics }, null, 2)}\n`,
      "utf8",
    );

  });
}

test("storefront business attribution and policy FAQs remain readable on mobile and desktop", async ({ page }, testInfo) => {
  test.skip(!useLocalFixture, "Policy verification requires the isolated merchandising fixture.");
  const origin = loopbackAuditOrigin(browserBaseUrl!);
  await containMerchandisingContext(page.context(), origin);
  const routes = [
    { path: "about", title: "About Zogular", text: /Zogular by Vendara Enterprises is/ },
    { path: "careers", title: "Careers at Zogular", text: "Where will open roles appear?" },
    { path: "help", title: "Help Center", text: "How do I pay for my order?" },
    { path: "privacy", title: "Privacy Policy", text: "How do I make a privacy request?" },
    { path: "returns", title: "Returns Policy", text: /within seven days after receiving them/ },
    { path: "terms", title: "Terms and Conditions", text: /do not limit rights you have under Zambian law/ },
  ];

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    for (const { path, title, text } of routes) {
      await page.goto(`${origin}/${path}`);
      const main = page.getByRole("main", { includeHidden: true });
      await expect(main.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(page.locator("main"), `/${path} at ${width}px should have one <main>`).toHaveCount(1);
      await expect(main, `/${path} at ${width}px should expose one main landmark`).toHaveCount(1);
      await expect(main.getByRole("region", { name: "Frequently asked questions" })).toBeVisible();
      await expect(page.getByText(text, { exact: typeof text === "string" })).toBeVisible();
      await expect(page.getByRole("contentinfo")).toContainText("Zogular by Vendara Enterprises");
      await auditPageLayout(page);
      if (path === "help") {
        await page.getByRole("heading", { name: "Frequently asked questions" }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`help-faq-${width}.png`), animations: "disabled" });
      }
    }
  }
});

test("VIS-04 storefront footer uses plain payment copy at mobile and desktop widths", async ({ page, request }, testInfo) => {
  test.skip(!useLocalFixture, "Footer verification requires the isolated merchandising fixture.");
  const origin = loopbackAuditOrigin(browserBaseUrl!);
  await containMerchandisingContext(page.context(), origin);
  await expect(await request.get(`${localFixtureOrigin}/__fixture?mode=success`)).toBeOK();

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${origin}/new-arrivals`);
  const footer = page.getByRole("contentinfo");
  const cashOnDelivery = footer.getByText("Cash on delivery", { exact: true });
  for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
    await test.step(`footer at ${viewport.width}px`, async () => {
      await page.setViewportSize(viewport);
      await expect(cashOnDelivery).toBeVisible();
      await expect(footer.getByRole("link", { name: "Careers", exact: true })).toHaveCount(0);
      for (const [name, href] of [["About Zogular", "/about"], ["Become a Seller", "/sell"], ["Terms & Conditions", "/terms"]]) {
        const companyLink = footer.getByRole("link", { name, exact: true });
        await expect(companyLink).toBeVisible();
        await expect(companyLink).toHaveAttribute("href", href);
      }
      await expect(footer).not.toContainText(/backend[- ]quoted|\bCOD\b/i);
      await cashOnDelivery.scrollIntoViewIfNeeded();
      await expect(cashOnDelivery).toBeInViewport({ ratio: 1 });
      expect(await footer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await auditPageLayout(page);
      await page.screenshot({ path: testInfo.outputPath(`footer-payment-${viewport.width}.png`), animations: "disabled" });
    });
  }
});
