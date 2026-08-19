import { expect, test, type Page, type Request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ApiError } from "../src/services/api";
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

const browserBaseUrl = process.env.PUBLIC_MERCHANDISING_BASE_URL;
const fixtureControlUrl = process.env.PUBLIC_MERCHANDISING_FIXTURE_URL;
const browserViewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

for (const viewport of browserViewports) {
  test(`source-aligned merchandising routes are truthful at ${viewport.name}`, async ({
    browser,
    page,
    request,
  }) => {
    test.skip(!browserBaseUrl || !fixtureControlUrl, "Source-aligned fixture runtime is not active.");
    const browserOrigin = new URL(browserBaseUrl!).origin;
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

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
    expect(diagnostics.badResponses).toEqual([]);
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
    });
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
    });
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
