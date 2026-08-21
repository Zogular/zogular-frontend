import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildSellerAnalyticsCsv,
  fetchSellerAnalyticsData,
  getSellerMetricsErrorMessage,
  getSellerSnapshotPresentationState,
  getSellerMetricsUtcBounds,
} from "../src/services/seller-metrics";
import {
  SellerOrderCollectionError,
  sellerOrdersApi,
} from "../src/services/seller-orders";
import {
  SellerCatalogCollectionError,
  fetchSellerCatalogProducts,
} from "../src/services/seller-catalog";

test.describe.configure({ mode: "serial" });

const originalFetch = globalThis.fetch;
const NOW = new Date("2026-08-21T12:34:56.789Z");

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

type BackendStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
type FixtureOrder = ReturnType<typeof makeOrder>;
type FixtureProduct = ReturnType<typeof makeProduct>;

function makeOrder({
  id,
  itemId = `item-${id}`,
  productId = "product-shared",
  status = "DELIVERED" as BackendStatus,
  createdAt = "2026-08-20T12:00:00.000Z",
  price = 10,
  quantity = 1,
}:
{
  id: string;
  itemId?: string;
  productId?: string;
  status?: BackendStatus;
  createdAt?: string;
  price?: number;
  quantity?: number;
}) {
  const subtotal = price * quantity;
  return {
    id,
    orderNumber: `ZG-${id}`,
    status,
    sellerStatus: status,
    allowedSellerTransitions: [],
    totalAmount: subtotal,
    paymentMethod: null,
    paymentStatus: null,
    sellerCommissionAmount: null,
    sellerNetAmount: null,
    createdAt,
    updatedAt: createdAt,
    deliveryMethod: "standard",
    shippingAddress: null,
    sellerVisibleTotals: { subtotal, shipping: null, discount: null, total: subtotal },
    user: {
      firstName: "Fixture",
      lastName: "Buyer",
      email: "fixture@example.test",
      telephone: "+260000000000",
    },
    items: [{
      id: itemId,
      productId,
      quantity,
      price,
      vendorStatus: status,
      product: {
        id: productId,
        title: `Product ${productId}`,
        images: [],
        category: "electronics",
        brand: null,
      },
    }],
  };
}

function makeProduct(index: number) {
  return {
    id: index === 0 ? "product-shared" : `product-${index}`,
    slug: `product-${index}`,
    title: `Product ${index}`,
    description: "Fixture product",
    price: 10,
    salePrice: null,
    images: [],
    condition: "NEW",
    category: "ELECTRONICS",
    status: "PUBLISHED",
    stock: index % 20 === 0 ? 1 : 10,
    isSold: false,
    lowStockThreshold: 2,
    categorySlug: "electronics",
    subcategorySlug: "accessories",
    isApproved: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as const;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function orderPayload(orders: FixtureOrder[], page: number, total = orders.length) {
  const limit = 100;
  const pages = Math.ceil(total / limit);
  const rows = orders.slice((page - 1) * limit, page * limit);
  const counts = new Map<BackendStatus, number>();
  for (const order of orders) counts.set(order.sellerStatus, (counts.get(order.sellerStatus) ?? 0) + 1);
  const count = (status: BackendStatus) => counts.get(status) ?? 0;

  return {
    status: "success",
    results: rows.length,
    pagination: { total, page, limit, pages },
    data: {
      orders: rows,
      summary: {
        totalOrders: total,
        activeOrders: count("PENDING") + count("CONFIRMED") + count("PROCESSING") + count("SHIPPED"),
        completedOrders: count("DELIVERED"),
        cancelledOrders: count("CANCELLED"),
        refundedOrders: count("REFUNDED"),
      },
      facets: {
        statuses: (["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as BackendStatus[])
          .map((status) => ({ status, count: count(status) })),
      },
    },
  };
}

function productPayload(products: FixtureProduct[], page: number, total = products.length) {
  const limit = 100;
  const pages = Math.ceil(total / limit);
  const rows = products.slice((page - 1) * limit, page * limit);
  const lowStock = products.filter((product) => product.stock <= product.lowStockThreshold).length;

  return {
    status: "success",
    results: rows.length,
    pagination: { total, page, limit, pages },
    data: {
      products: rows,
      summary: { total, buyerVisible: total, pendingReview: 0, lowStock, outOfStock: 0 },
      facets: {
        categories: [{ id: null, slug: "electronics", name: "Electronics", count: total }],
        statuses: { PUBLISHED: total },
        stock: { inStock: total - lowStock, lowStock, outOfStock: 0 },
      },
    },
  };
}

type RouterOptions = {
  orderMutator?: (payload: ReturnType<typeof orderPayload>, page: number) => unknown;
  productMutator?: (payload: ReturnType<typeof productPayload>, page: number) => unknown;
  failOrderPage?: number;
  failProductPage?: number;
  abortOrderPage?: number;
};

function installRouter(
  orders: FixtureOrder[],
  products: FixtureProduct[] = [],
  options: RouterOptions = {},
): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    urls.push(url.toString());
    const page = Number(url.searchParams.get("page") ?? "1");

    if (url.pathname.endsWith("/vendor/orders")) {
      if (options.abortOrderPage === page) throw new DOMException("Timed out", "AbortError");
      if (options.failOrderPage === page) return jsonResponse({ status: "fail", message: "internal detail" }, 503);
      const payload = orderPayload(orders, page);
      return jsonResponse(options.orderMutator?.(payload, page) ?? payload);
    }

    if (url.pathname.endsWith("/vendor/products")) {
      if (options.failProductPage === page) return jsonResponse({ status: "fail", message: "internal detail" }, 503);
      const payload = productPayload(products, page);
      return jsonResponse(options.productMutator?.(payload, page) ?? payload);
    }

    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  return urls;
}

test("calculates exact rolling UTC bounds, including prior-year 12-month bounds", () => {
  expect(getSellerMetricsUtcBounds("24h", NOW)).toEqual({
    createdFrom: "2026-08-20T12:34:56.789Z",
    createdTo: "2026-08-21T12:34:56.789Z",
  });
  expect(getSellerMetricsUtcBounds("7d", NOW).createdFrom).toBe("2026-08-14T12:34:56.789Z");
  expect(getSellerMetricsUtcBounds("30d", NOW).createdFrom).toBe("2026-07-22T12:34:56.789Z");
  expect(getSellerMetricsUtcBounds("12m", NOW).createdFrom).toBe("2025-08-21T12:34:56.789Z");
  expect(getSellerMetricsUtcBounds("12m", new Date("2024-02-29T08:00:00.000Z")).createdFrom)
    .toBe("2023-02-28T08:00:00.000Z");
});

test("collects 145 orders and 101 products across page-size-100 responses without detail N+1 calls", async () => {
  const orders = Array.from({ length: 145 }, (_, index) => makeOrder({
    id: `order-${index}`,
    itemId: `item-${index}`,
    productId: "product-shared",
    createdAt: `2026-08-${String(1 + (index % 20)).padStart(2, "0")}T12:00:00.000Z`,
    price: 10,
  }));
  const products = Array.from({ length: 101 }, (_, index) => makeProduct(index));
  const urls = installRouter(orders, products);

  const data = await fetchSellerAnalyticsData("30d", NOW);

  expect(data.summary.ordersWithGrossItemSales).toBe(145);
  expect(data.summary.grossItemSales).toBe(1450);
  expect(data.summary.buyerVisibleProducts).toBe(101);
  expect(data.topProducts[0]).toMatchObject({ id: "product-shared", sales: 145, grossItemSales: 1450 });
  expect(urls.filter((url) => new URL(url).pathname.endsWith("/vendor/orders"))).toHaveLength(2);
  expect(urls.filter((url) => new URL(url).pathname.endsWith("/vendor/products"))).toHaveLength(2);
  expect(urls.every((url) => new URL(url).searchParams.get("limit") === "100")).toBe(true);
  expect(urls.some((url) => /\/vendor\/orders\/[^?]+/.test(new URL(url).pathname))).toBe(false);
  const orderUrl = new URL(urls.find((url) => new URL(url).pathname.endsWith("/vendor/orders"))!);
  expect(orderUrl.searchParams.get("createdFrom")).toBe("2026-07-22T12:34:56.789Z");
  expect(orderUrl.searchParams.get("createdTo")).toBe("2026-08-21T12:34:56.789Z");
});

test("defensively enforces range boundaries and gross subtotal status semantics", async () => {
  const bounds = getSellerMetricsUtcBounds("24h", NOW);
  const orders = [
    makeOrder({ id: "at-start", status: "PENDING", createdAt: bounds.createdFrom, price: 10 }),
    makeOrder({ id: "delivered", status: "DELIVERED", createdAt: "2026-08-21T00:00:00.000Z", price: 20 }),
    makeOrder({ id: "cancelled", status: "CANCELLED", createdAt: "2026-08-21T01:00:00.000Z", price: 30 }),
    makeOrder({ id: "refunded", status: "REFUNDED", createdAt: "2026-08-21T02:00:00.000Z", price: 40 }),
    makeOrder({ id: "at-end", status: "CONFIRMED", createdAt: bounds.createdTo, price: 50 }),
    makeOrder({ id: "old-prior-year", status: "DELIVERED", createdAt: "2025-08-21T12:34:56.788Z", price: 1_000 }),
  ];
  installRouter(orders, [makeProduct(0)]);

  const data = await fetchSellerAnalyticsData("24h", NOW);

  expect(data.orderStats).toEqual({ total: 5, delivered: 1, processing: 2, cancelled: 1, refunded: 1 });
  expect(data.summary).toMatchObject({ grossItemSales: 80, ordersWithGrossItemSales: 3, deliveredOrders: 1 });
  expect(data.trends.reduce((sum, point) => sum + point.grossItemSales, 0)).toBe(80);
  expect(data.trends.reduce((sum, point) => sum + point.orders, 0)).toBe(3);
});

test("aggregates the same product across distinct order-item IDs by backend productId", async () => {
  installRouter([
    makeOrder({ id: "order-a", itemId: "item-a", productId: "product-shared", price: 25, quantity: 2 }),
    makeOrder({ id: "order-b", itemId: "item-b", productId: "product-shared", price: 25, quantity: 3 }),
  ], [makeProduct(0)]);

  const data = await fetchSellerAnalyticsData("7d", NOW);
  expect(data.topProducts).toEqual([
    expect.objectContaining({ id: "product-shared", sales: 5, grossItemSales: 125 }),
  ]);
});

test("mixed item statuses count only eligible lines while order status statistics remain aggregate-level", async () => {
  const mixedOrder = makeOrder({
    id: "mixed-order",
    status: "DELIVERED",
    productId: "eligible-product",
    price: 10,
    quantity: 2,
  });
  mixedOrder.items = [
    mixedOrder.items[0],
    { ...mixedOrder.items[0], id: "cancelled-line", productId: "cancelled-product", price: 100, quantity: 3, vendorStatus: "CANCELLED", product: { ...mixedOrder.items[0].product, id: "cancelled-product", title: "Cancelled product", category: "fashion" } },
    { ...mixedOrder.items[0], id: "refunded-line", productId: "refunded-product", price: 200, quantity: 2, vendorStatus: "REFUNDED", product: { ...mixedOrder.items[0].product, id: "refunded-product", title: "Refunded product", category: "fashion" } },
    { ...mixedOrder.items[0], id: "unknown-line", productId: "unknown-product", price: 500, quantity: 1, vendorStatus: "UNRECOGNIZED" as BackendStatus, product: { ...mixedOrder.items[0].product, id: "unknown-product", title: "Unknown product", category: "fashion" } },
  ];
  const allLineSubtotal = mixedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  mixedOrder.sellerVisibleTotals = { subtotal: allLineSubtotal, shipping: null, discount: null, total: allLineSubtotal };
  installRouter([mixedOrder], [makeProduct(0)]);

  const data = await fetchSellerAnalyticsData("7d", NOW);

  expect(data.orderStats).toEqual({ total: 1, delivered: 1, processing: 0, cancelled: 0, refunded: 0 });
  expect(data.summary).toMatchObject({ grossItemSales: 20, ordersWithGrossItemSales: 1 });
  expect(data.trends.reduce((sum, point) => sum + point.grossItemSales, 0)).toBe(20);
  expect(data.topProducts).toEqual([
    expect.objectContaining({ id: "eligible-product", sales: 2, grossItemSales: 20 }),
  ]);
  expect(data.categoryPerformance).toEqual([
    expect.objectContaining({ slug: "electronics", sales: 2, grossItemSales: 20 }),
  ]);
  expect(data.topProducts.map((product) => product.id)).not.toContain("unknown-product");
});

test("requested and applied ranges stay separate through pending and failed transitions, and CSV uses applied range", async () => {
  expect(getSellerSnapshotPresentationState("7d", "30d", true, null)).toEqual({
    appliedRange: "30d",
    isRangeTransition: true,
    isStale: true,
    canExport: false,
  });
  expect(getSellerSnapshotPresentationState("7d", "30d", false, "Refresh failed")).toEqual({
    appliedRange: "30d",
    isRangeTransition: true,
    isStale: true,
    canExport: false,
  });

  installRouter([makeOrder({ id: "applied-range" })], [makeProduct(0)]);
  const appliedData = await fetchSellerAnalyticsData("30d", NOW);
  const csv = buildSellerAnalyticsCsv(appliedData, "all");
  expect(csv).toContain('"Range","30d"');
  expect(csv).not.toContain('"Range","7d"');
});

test("rejects duplicate, malformed, incomplete, and drifting order pagination", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => makeOrder({ id: `order-${index}` }));
  const cases: Array<{ code: SellerOrderCollectionError["code"]; mutator: RouterOptions["orderMutator"] }> = [
    {
      code: "repeated-order",
      mutator: (payload, page) => {
        if (page === 2) payload.data.orders[0] = rows[0];
        return payload;
      },
    },
    {
      code: "malformed-pagination",
      mutator: (payload) => ({ ...payload, pagination: { ...payload.pagination, page: 9 } }),
    },
    {
      code: "incomplete-collection",
      mutator: (payload, page) => page === 2 ? { ...payload, results: 0, data: { ...payload.data, orders: [] } } : payload,
    },
    {
      code: "pagination-drift",
      mutator: (payload, page) => page === 2
        ? { ...payload, pagination: { ...payload.pagination, total: 102, pages: 2 }, data: { ...payload.data, summary: { ...payload.data.summary, totalOrders: 102 }, facets: { statuses: payload.data.facets.statuses.map((facet, index) => index === 4 ? { ...facet, count: facet.count + 1 } : facet) } } }
        : payload,
    },
  ];

  for (const fixture of cases) {
    installRouter(rows, [], { orderMutator: fixture.mutator });
    await expect(sellerOrdersApi.fetchAllForMetrics()).rejects.toMatchObject({
      name: "SellerOrderCollectionError",
      code: fixture.code,
    });
  }
});

test("fails closed on later-page failure, timeout, and the order safety cap", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => makeOrder({ id: `order-${index}` }));
  installRouter(rows, [], { failOrderPage: 2 });
  await expect(sellerOrdersApi.fetchAllForMetrics()).rejects.toMatchObject({ status: 503 });

  installRouter(rows, [], { abortOrderPage: 2 });
  await expect(sellerOrdersApi.fetchAllForMetrics()).rejects.toMatchObject({ status: 408 });

  const firstPage = Array.from({ length: 100 }, (_, index) => makeOrder({ id: `cap-${index}` }));
  installRouter(firstPage, [], {
    orderMutator: (payload) => {
      payload.pagination.total = 10_001;
      payload.pagination.pages = 101;
      payload.data.summary.totalOrders = 10_001;
      payload.data.facets.statuses = payload.data.facets.statuses.map((facet) => facet.status === "DELIVERED" ? { ...facet, count: 10_001 } : facet);
      return payload;
    },
  });
  await expect(sellerOrdersApi.fetchAllForMetrics()).rejects.toMatchObject({ code: "safety-cap-exceeded" });
});

test("catalog collector rejects duplicates, drift, incomplete pages, failures, and the safety cap", async () => {
  const products = Array.from({ length: 101 }, (_, index) => makeProduct(index));
  const cases: Array<{ code?: SellerCatalogCollectionError["code"]; options: RouterOptions }> = [
    {
      code: "repeated-product",
      options: { productMutator: (payload, page) => {
        if (page === 2) payload.data.products[0] = products[0];
        return payload;
      } },
    },
    {
      code: "malformed-pagination",
      options: { productMutator: (payload) => ({ ...payload, pagination: { ...payload.pagination, limit: 20 } }) },
    },
    {
      code: "incomplete-collection",
      options: { productMutator: (payload, page) => page === 2 ? { ...payload, results: 0, data: { ...payload.data, products: [] } } : payload },
    },
    {
      code: "pagination-drift",
      options: { productMutator: (payload, page) => page === 2 ? { ...payload, data: { ...payload.data, summary: { ...payload.data.summary, buyerVisible: 100 } } } : payload },
    },
  ];

  for (const fixture of cases) {
    installRouter([], products, fixture.options);
    await expect(fetchSellerCatalogProducts()).rejects.toMatchObject({
      name: "SellerCatalogCollectionError",
      code: fixture.code,
    });
  }

  installRouter([], products, { failProductPage: 2 });
  await expect(fetchSellerCatalogProducts()).rejects.toMatchObject({ status: 503 });

  const firstPage = Array.from({ length: 100 }, (_, index) => makeProduct(index));
  installRouter([], firstPage, {
    productMutator: (payload) => {
      payload.pagination.total = 10_001;
      payload.pagination.pages = 101;
      payload.data.summary.total = 10_001;
      payload.data.summary.buyerVisible = 10_001;
      payload.data.facets.statuses.PUBLISHED = 10_001;
      payload.data.facets.categories[0].count = 10_001;
      payload.data.facets.stock.inStock = 9_996;
      return payload;
    },
  });
  await expect(fetchSellerCatalogProducts()).rejects.toMatchObject({ code: "safety-cap-exceeded" });
});

test("safe error copy does not leak backend details", () => {
  const error = new SellerOrderCollectionError("pagination-drift");
  expect(getSellerMetricsErrorMessage(error)).toBe(
    "A complete seller metrics snapshot could not be verified. No partial totals are being shown.",
  );
  expect(getSellerMetricsErrorMessage(error)).not.toContain("pagination-drift");
});

test("seller metric UI uses gross subtotal terminology and exposes stale snapshot feedback", async () => {
  const files = [
    "src/app/seller/page.tsx",
    "src/app/seller/analytics/page.tsx",
    "src/features/seller-analytics/components/AnalyticsCharts.tsx",
    "src/features/seller-analytics/hooks/useSellerAnalytics.ts",
    "src/services/seller-metrics.ts",
  ];
  const source = (await Promise.all(files.map((file) => fs.readFile(path.resolve(file), "utf8")))).join("\n");

  expect(source).not.toMatch(/Seller Revenue/i);
  expect(source).toMatch(/Gross item sales/i);
  expect(source).toMatch(/last successful/i);
  expect(source).toMatch(/No partial totals/i);
});
