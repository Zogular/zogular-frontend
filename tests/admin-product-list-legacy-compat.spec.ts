import { expect, test } from "@playwright/test";
import { ApiError } from "../src/services/api";
import { fetchAdminCatalogProducts } from "../src/services/seller-catalog";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function product(index: number) {
  return {
    id: `product-${index}`,
    slug: `fixture-${index}`,
    title: `Fixture ${index}`,
    description: "Synthetic listing",
    price: 100,
    salePrice: null,
    images: [],
    category: "OTHERS",
    condition: "NEW",
    status: "PENDING_REVIEW",
    isApproved: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// Backend main and PR #80 serialize the same legacy list envelope.
function payload(page: number, total: number) {
  const offset = (page - 1) * 100;
  const products = Array.from(
    { length: Math.max(0, Math.min(100, total - offset)) },
    (_, index) => product(offset + index),
  );
  return {
    status: "success",
    results: products.length,
    pagination: { page, limit: 100, total, pages: Math.ceil(total / 100) },
    data: { products },
  };
}

function mockPages(respond: (page: number) => Response) {
  const pages: number[] = [];
  let inFlight = false;

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.pathname).toMatch(/\/admin\/products$/);
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "include" });
    expect([...url.searchParams.keys()].sort()).toEqual(["limit", "page"]);
    expect(url.searchParams.get("limit")).toBe("100");
    expect(inFlight).toBe(false);
    inFlight = true;
    try {
      const page = Number(url.searchParams.get("page"));
      pages.push(page);
      await Promise.resolve();
      return respond(page);
    } finally {
      inFlight = false;
    }
  };

  return pages;
}

test("collects only the first 500 rows in server order, even as totals beyond the cap change", async () => {
  const pages = mockPages((page) => Response.json(payload(page, 500 + page * 53)));
  const rows = await fetchAdminCatalogProducts();

  expect(pages).toEqual([1, 2, 3, 4, 5]);
  expect(rows.map(({ id }) => id)).toEqual(Array.from({ length: 500 }, (_, index) => product(index).id));
  expect(rows[0]).toMatchObject({ slug: "fixture-0", status: "pending_review", price: 100 });
});

for (const { total, expectedPages } of [
  { total: 0, expectedPages: [1] },
  { total: 100, expectedPages: [1] },
  { total: 137, expectedPages: [1, 2] },
]) {
  test(`stops at the reported end of a ${total}-row collection`, async () => {
    const pages = mockPages((page) => Response.json(payload(page, total)));

    expect(await fetchAdminCatalogProducts()).toHaveLength(total);
    expect(pages).toEqual(expectedPages);
  });
}

type PagePayload = ReturnType<typeof payload>;

for (const { name, change, message } of [
  { name: "missing pagination", change: (p: PagePayload) => ({ ...p, pagination: undefined }), message: /inconsistent pagination/ },
  { name: "repeated page index", change: (p: PagePayload) => ({ ...p, pagination: { ...p.pagination, page: 1 } }), message: /inconsistent pagination/ },
  { name: "contradictory page count", change: (p: PagePayload) => ({ ...p, pagination: { ...p.pagination, pages: 1 } }), message: /inconsistent pagination/ },
  { name: "contradictory results", change: (p: PagePayload) => ({ ...p, results: 0 }), message: /inconsistent pagination/ },
  { name: "short page with matching results", change: (p: PagePayload) => ({ ...p, results: 0, data: { products: [] } }), message: /inconsistent pagination/ },
  { name: "drift below the cap", change: () => payload(2, 120), message: /changed while loading/ },
  {
    name: "repeated product ID",
    change: (p: PagePayload) => ({ ...p, data: { products: [{ ...product(100), id: product(0).id }, ...p.data.products.slice(1)] } }),
    message: /repeated rows/,
  },
  {
    name: "malformed row",
    change: (p: PagePayload) => ({ ...p, data: { products: [{ id: "not-a-complete-row" }, ...p.data.products.slice(1)] } }),
    message: /invalid row/,
  },
]) {
  test(`rejects ${name} without returning earlier pages`, async () => {
    const pages = mockPages((page) => {
      const result = payload(page, 137);
      return Response.json(page === 2 ? change(result) : result);
    });

    await expect(fetchAdminCatalogProducts()).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      message: expect.stringMatching(message),
    });
    expect(pages).toEqual([1, 2]);
  });
}

for (const status of [403, 503]) {
  test(`propagates a later HTTP ${status} without returning partial rows`, async () => {
    const pages = mockPages((page) => page === 1
      ? Response.json(payload(page, 137))
      : Response.json({ message: "Synthetic backend failure" }, { status }));

    const result = fetchAdminCatalogProducts();
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status, message: "Synthetic backend failure" });
    expect(pages).toEqual([1, 2]);
  });
}
