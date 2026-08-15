import { expect, test } from "@playwright/test";
import {
  buildDiscoveryUrl,
  hasActiveDiscoveryQuery,
  parseDiscoveryQuery,
  serializeDiscoveryQuery,
  updateDiscoveryQuery,
} from "../src/features/consumer-discovery/lib/discovery-query";
import { classifyDiscoveryCollection } from "../src/features/consumer-discovery/lib/discovery-outcomes";
import { getCategoryMetaBySlug } from "../src/services/categories";
import { ApiError } from "../src/services/api";
import {
  getDiscoveryListingPageData,
  ProductListContractError,
  type BackendProduct,
} from "../src/services/products";
import type { DiscoveryQueryState } from "../src/features/consumer-discovery/types/discovery.types";
import type { Product } from "../src/types/product";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function backendProduct(id: string, title = `Product ${id}`): BackendProduct {
  return {
    id,
    slug: `product-${id}`,
    title,
    price: 100,
    stock: 4,
    categoryRef: { id: "category-1", name: "Electronics", slug: "electronics" },
    images: [],
    reviews: [],
    user: { id: "owner-1" },
  };
}

function productListPayload(
  products: BackendProduct[],
  pagination: { page: number; limit: number; total: number; pages: number },
) {
  return {
    status: "success",
    results: products.length,
    pagination,
    data: { products },
  };
}

const normalizedProduct: Product = {
  id: "product-1",
  slug: "product-1",
  title: "Product 1",
  name: "Product 1",
  price: 100,
  oldPrice: null,
  originalPrice: null,
  discount: null,
  badge: null,
  isNew: false,
  rating: 0,
  reviews: 0,
  image: "",
};

test("parser normalizes malformed, repeated, excessive, and unknown parameters", () => {
  const query = new URLSearchParams([
    ["page", "-4"],
    ["page", "3"],
    ["categorySlug", "https://external.example/path"],
    ["subcategorySlug", "../phones"],
    ["search", "   Galaxy    A55   "],
    ["sort", "top-rated"],
    ["unknown", "discard-me"],
  ]);

  const parsed = parseDiscoveryQuery(query);
  expect(parsed).toEqual({ page: 1, sort: "newest", search: "Galaxy A55" });
  expect(serializeDiscoveryQuery(parsed)).toBe("search=Galaxy+A55");
  expect(parseDiscoveryQuery({ page: "10001", category: "Electronics" })).toEqual({
    page: 1,
    sort: "newest",
    categorySlug: "electronics",
  });
  expect(parseDiscoveryQuery({ page: "1.5" }).page).toBe(1);
  expect(parseDiscoveryQuery({ page: "01" }).page).toBe(1);
});

test("category aliases and repeated values canonicalize without ambiguity", () => {
  expect(parseDiscoveryQuery({ category: "Electronics" }).categorySlug).toBe("electronics");
  expect(
    parseDiscoveryQuery({ category: "electronics", categorySlug: "phones" }).categorySlug,
  ).toBeUndefined();
  expect(parseDiscoveryQuery({ search: ["phone", "tablet"] }).search).toBeUndefined();
  expect(parseDiscoveryQuery(new URLSearchParams("sort=price_asc&sort=price_desc")).sort).toBe(
    "newest",
  );
});

test("popular ordering is admitted only for the explicit Most Viewed context", () => {
  expect(parseDiscoveryQuery({ sort: "popular" }).sort).toBe("newest");
  expect(parseDiscoveryQuery({ sort: "popular" }, { allowPopular: true }).sort).toBe(
    "popular",
  );
});

test("serializer emits stable canonical internal URLs only", () => {
  const state: DiscoveryQueryState = {
    page: 3,
    sort: "price_desc",
    categorySlug: "electronics",
    subcategorySlug: "mobile-phones",
    search: "Galaxy A55",
  };

  expect(serializeDiscoveryQuery(state)).toBe(
    "categorySlug=electronics&subcategorySlug=mobile-phones&search=Galaxy+A55&sort=price_desc&page=3",
  );
  expect(buildDiscoveryUrl("/products", state)).toBe(
    "/products?categorySlug=electronics&subcategorySlug=mobile-phones&search=Galaxy+A55&sort=price_desc&page=3",
  );
  expect(buildDiscoveryUrl("https://external.example/products", state)).toMatch(/^\/products\?/);
  expect(buildDiscoveryUrl("//external.example/products", state)).toMatch(/^\/products\?/);
  expect(buildDiscoveryUrl("/products/../admin", state)).toMatch(/^\/products\?/);
  expect(buildDiscoveryUrl("/products/%2e%2e/admin", state)).toMatch(/^\/products\?/);
});

test("filter and sort changes reset page while pagination preserves supported state", () => {
  const current: DiscoveryQueryState = {
    page: 7,
    sort: "price_asc",
    categorySlug: "electronics",
    search: "phone",
  };

  expect(updateDiscoveryQuery(current, { sort: "price_desc" })).toEqual({
    ...current,
    page: 1,
    sort: "price_desc",
  });
  expect(updateDiscoveryQuery(current, { search: "tablet" })).toEqual({
    ...current,
    page: 1,
    search: "tablet",
  });
  expect(updateDiscoveryQuery(current, { page: 8 })).toEqual({ ...current, page: 8 });
  expect(updateDiscoveryQuery(current, { sort: "price_asc" })).toEqual(current);
  expect(updateDiscoveryQuery(current, { subcategorySlug: null })).toEqual(current);
  expect(hasActiveDiscoveryQuery(current)).toBe(true);
});

test("approved-public category counts distinguish true empty from filtered zero", () => {
  expect(
    classifyDiscoveryCollection({
      products: [],
      hasActiveQuery: true,
      approvedPublicProductCount: 0,
    }),
  ).toEqual({ status: "true-empty", products: [] });
  expect(
    classifyDiscoveryCollection({
      products: [],
      hasActiveQuery: false,
      approvedPublicProductCount: 12,
    }),
  ).toEqual({ status: "filtered-zero", products: [] });
  expect(
    classifyDiscoveryCollection({
      products: [normalizedProduct],
      approvedPublicProductCount: 12,
    }),
  ).toEqual({ status: "success", products: [normalizedProduct] });
});

test("category metadata preserves the approved-public product count", async () => {
  globalThis.fetch = async () => jsonResponse({
    status: "success",
    results: 1,
    data: {
      categories: [{
        id: "category-1",
        name: "Electronics",
        slug: "electronics",
        description: "Devices",
        icon: null,
        parentId: null,
        isActive: true,
        sortOrder: 1,
        children: [],
        _count: { products: 9 },
      }],
    },
  });

  await expect(getCategoryMetaBySlug("electronics")).resolves.toMatchObject({
    title: "Electronics",
    approvedPublicProductCount: 9,
  });

  globalThis.fetch = async () => jsonResponse({ status: "fail", message: "Unavailable" }, 503);
  await expect(getCategoryMetaBySlug("electronics")).rejects.toMatchObject({
    name: "ApiError",
    status: 503,
  });
});

test("listing service maps only supported parameters and preserves backend order", async () => {
  const requestedUrls: URL[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(new URL(String(input)));
    return jsonResponse(productListPayload(
      [backendProduct("third"), backendProduct("first"), backendProduct("second")],
      { page: 2, limit: 24, total: 30, pages: 2 },
    ));
  };

  const result = await getDiscoveryListingPageData({
    page: 2,
    sort: "price_desc",
    categorySlug: "electronics",
    subcategorySlug: "mobile-phones",
    search: "galaxy",
  });

  expect(result.products.map((product) => product.id)).toEqual(["third", "first", "second"]);
  expect(result.pageResolution).toBe("requested");
  expect(Object.fromEntries(requestedUrls[0].searchParams)).toEqual({
    page: "2",
    limit: "24",
    sort: "price_desc",
    categorySlug: "electronics",
    subcategorySlug: "mobile-phones",
    search: "galaxy",
  });
  expect(requestedUrls[0].searchParams.has("minPrice")).toBe(false);
  expect(requestedUrls[0].searchParams.has("condition")).toBe(false);
  expect(requestedUrls[0].searchParams.has("availability")).toBe(false);
});

test("listing service downgrades popular outside Most Viewed and permits it inside", async () => {
  const sorts: Array<string | null> = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    sorts.push(url.searchParams.get("sort"));
    return jsonResponse(productListPayload([], { page: 1, limit: 24, total: 0, pages: 0 }));
  };

  await getDiscoveryListingPageData({ page: 1, sort: "popular" });
  await getDiscoveryListingPageData(
    { page: 1, sort: "popular" },
    { orderingContext: "most-viewed" },
  );
  expect(sorts).toEqual(["newest", "popular"]);
});

test("out-of-range pages refetch the last valid page exactly once without a loop", async () => {
  const requestedPages: string[] = [];
  globalThis.fetch = async (input) => {
    const page = new URL(String(input)).searchParams.get("page") ?? "";
    requestedPages.push(page);
    if (page === "9") {
      return jsonResponse(productListPayload([], { page: 9, limit: 2, total: 5, pages: 3 }));
    }
    return jsonResponse(productListPayload(
      [backendProduct("last")],
      { page: 3, limit: 2, total: 5, pages: 3 },
    ));
  };

  const result = await getDiscoveryListingPageData(
    { page: 9, sort: "newest", search: "phone" },
    { pageSize: 2 },
  );
  expect(requestedPages).toEqual(["9", "3"]);
  expect(result.pageResolution).toBe("last-page");
  expect(result.requestedQuery.page).toBe(9);
  expect(result.query.page).toBe(3);
  expect(result.pagination.page).toBe(3);
  expect(result.products.map((product) => product.id)).toEqual(["last"]);
});

test("an out-of-range empty collection resolves to page one without refetching", async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return jsonResponse(productListPayload([], { page: 8, limit: 24, total: 0, pages: 0 }));
  };

  const result = await getDiscoveryListingPageData({ page: 8, sort: "newest" });
  expect(requestCount).toBe(1);
  expect(result.pageResolution).toBe("empty-first-page");
  expect(result.query.page).toBe(1);
  expect(result.pagination).toMatchObject({ page: 1, total: 0, totalPages: 1 });
});

test("API, network, timeout, and malformed-response failures remain typed", async () => {
  globalThis.fetch = async () => jsonResponse({ status: "fail", message: "Unavailable" }, 503);
  await expect(
    getDiscoveryListingPageData({ page: 1, sort: "newest" }),
  ).rejects.toMatchObject({ name: "ApiError", status: 503 });

  globalThis.fetch = async () => {
    throw new TypeError("offline");
  };
  await expect(
    getDiscoveryListingPageData({ page: 1, sort: "newest" }),
  ).rejects.toMatchObject({ name: "ApiError", status: 503 });

  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  await expect(
    getDiscoveryListingPageData(
      { page: 1, sort: "newest" },
      { timeout: 5 },
    ),
  ).rejects.toMatchObject({ name: "ApiError", status: 408 });

  globalThis.fetch = async () => jsonResponse({ status: "success", data: { products: [] } });
  await expect(
    getDiscoveryListingPageData({ page: 1, sort: "newest" }),
  ).rejects.toBeInstanceOf(ProductListContractError);

  expect(new ApiError("typed", 500)).toBeInstanceOf(Error);
});

test("Fixture-based QA, not production-runtime proof: Back and Forward restore rendered query state", async ({ page }) => {
  await page.exposeFunction("parseFixtureQuery", (href: string) => {
    const url = new URL(href);
    return parseDiscoveryQuery(url.searchParams);
  });
  await page.exposeFunction(
    "updateFixtureQuery",
    (href: string, patch: Parameters<typeof updateDiscoveryQuery>[1]) => {
      const url = new URL(href);
      const current = parseDiscoveryQuery(url.searchParams);
      const next = updateDiscoveryQuery(current, patch);
      return { state: next, url: buildDiscoveryUrl(url.pathname, next) };
    },
  );

  const html = `<!doctype html>
    <html><body>
      <output id="state"></output>
      <button id="sort" type="button">Price high to low</button>
      <button id="next" type="button">Next page</button>
      <script>
        const output = document.querySelector('#state');
        async function render() {
          const state = await window.parseFixtureQuery(location.href);
          output.textContent = JSON.stringify(state);
        }
        async function apply(patch) {
          const next = await window.updateFixtureQuery(location.href, patch);
          history.pushState({}, '', next.url);
          await render();
        }
        document.querySelector('#sort').addEventListener('click', () => apply({ sort: 'price_desc' }));
        document.querySelector('#next').addEventListener('click', async () => {
          const current = await window.parseFixtureQuery(location.href);
          await apply({ page: current.page + 1 });
        });
        addEventListener('popstate', render);
        render();
      </script>
    </body></html>`;

  await page.route("http://fixture.local/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: html,
  }));
  await page.goto("http://fixture.local/products?search=phone&page=3");
  const state = page.locator("#state");
  await expect(state).toHaveText('{"page":3,"sort":"newest","search":"phone"}');

  await page.getByRole("button", { name: "Price high to low" }).click();
  await expect(page).toHaveURL("http://fixture.local/products?search=phone&sort=price_desc");
  await expect(state).toHaveText('{"page":1,"sort":"price_desc","search":"phone"}');

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(
    "http://fixture.local/products?search=phone&sort=price_desc&page=2",
  );
  await expect(state).toHaveText('{"page":2,"sort":"price_desc","search":"phone"}');

  await page.goBack();
  await expect(state).toHaveText('{"page":1,"sort":"price_desc","search":"phone"}');
  await page.goBack();
  await expect(state).toHaveText('{"page":3,"sort":"newest","search":"phone"}');
  await page.goForward();
  await expect(state).toHaveText('{"page":1,"sort":"price_desc","search":"phone"}');
});
