import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { orderHistoryHref, parseOrderFilter } from "../src/features/buyer-orders/lib/order-return-state";
import { getInvoiceById, getMyOrdersPage, OrderContractError, OrderListContractError } from "../src/services/orders";
import type { BackendOrder } from "../src/types/backend-order";

const repoRoot = path.resolve(__dirname, "..");
const orderDetailSource = () =>
  fs.readFileSync(path.join(repoRoot, "src/app/(consumer)/account/orders/[id]/page.tsx"), "utf8");

test("buyer order detail cannot rebuild cart from historical order items", () => {
  const source = orderDetailSource();

  expect(source).not.toContain("@/hooks/use-cart");
  expect(source).not.toContain("useCart.getState");
  expect(source).not.toContain(".addItem(");
  expect(source).not.toContain("Order Again");
});

test("buyer order detail does not claim future rider contact", () => {
  const source = orderDetailSource();

  expect(source).not.toContain("Rider contact will appear here once assigned.");
  expect(source).not.toMatch(/rider contact/i);
  expect(source).toContain("Delivery updates are coordinated by Zogular support from the latest order status.");
});

test("buyer order detail keeps a real recovery CTA for order support", () => {
  const source = orderDetailSource();

  expect(source).toContain("WhatsApp Support");
  expect(source).toContain("Call Support");
  expect(source).toContain("Need order help?");
  expect(source).toContain("Share your order number with Zogular support for help with delivery, address changes, or payment questions.");
  expect(source).not.toContain("backend order record");
  expect(source).not.toContain("old cart prices");
  expect(source).toContain("Browse Products");
});

const recordedOrder = {
  id: "refunded-fixture",
  orderNumber: "ZO-001",
  userId: "buyer-fixture",
  status: "REFUNDED",
  totalAmount: 180,
  paymentMethod: "CASH_ON_DELIVERY",
  paymentCollectionMode: "DELIVERY_FEE_THEN_CASH",
  deliveryFeeAmount: 35,
  cashDueOnDelivery: 180,
  grandTotalAmount: 215,
  commitmentFeeStatus: "PENDING",
  shippingAddress: "Lusaka",
  deliveryMethod: "standard",
  createdAt: "2026-11-20T12:00:00Z",
  updatedAt: "2026-11-21T12:00:00Z",
  items: [{
    id: "line-fixture", productId: "product-fixture", quantity: 2, price: 90, lineTotal: 180,
    vendorId: "seller-fixture", vendorStatus: "CANCELLED",
    product: { id: "product-fixture", title: "Fixture lamp" },
  }],
} satisfies BackendOrder;

async function withOrderFixture(rows: readonly (Omit<BackendOrder, "status"> & { status: string })[], verify: () => Promise<void>) {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if ((init?.method ?? "GET") !== "GET") throw new Error("Fixture only allows order reads");
    if (url.pathname.endsWith("/orders") && url.searchParams.get("page") === "1" && url.searchParams.get("limit") === "20") {
      return Response.json({
        data: { orders: rows }, results: rows.length,
        pagination: { page: 1, limit: 20, total: rows.length, pages: 1 },
      });
    }
    const row = rows.find(({ id }) => url.pathname.endsWith(`/orders/${id}`));
    if (row) return Response.json({ data: { order: row } });
    throw new Error("Unexpected order fixture request");
  };
  try {
    await verify();
  } finally {
    globalThis.fetch = fetchBefore;
  }
}

test("the real list and detail adapters preserve both backend terminal states and recorded amounts", async () => {
  const cancelledOrder = { ...recordedOrder, id: "cancelled-fixture", status: "CANCELLED" };
  await withOrderFixture([recordedOrder, cancelledOrder], async () => {
    const { orders } = await getMyOrdersPage();
    expect(orders.map(({ id, status, total }) => ({ id, status, total }))).toEqual([
      { id: recordedOrder.id, status: "refunded", total: 215 },
      { id: cancelledOrder.id, status: "cancelled", total: 215 },
    ]);
    for (const { id, status } of orders) {
      await expect(getInvoiceById(id)).resolves.toMatchObject({
        id, status, subtotal: 180, shippingFee: 35, total: 215, paymentMethod: "Cash on Delivery",
      });
    }
  });
});

test("unrecognized backend statuses are rejected by both real adapters", async () => {
  for (const status of ["refunded", "toString", "REFUND_PENDING"]) {
    await withOrderFixture([{ ...recordedOrder, status }], async () => {
      await expect(getMyOrdersPage()).rejects.toBeInstanceOf(OrderListContractError);
      await expect(getInvoiceById(recordedOrder.id)).rejects.toBeInstanceOf(OrderContractError);
    });
  }
});

test("cancelled and refunded history URLs preserve independent detail return contexts", () => {
  for (const status of ["cancelled", "refunded"]) {
    const filter = parseOrderFilter(status);
    const detail = orderHistoryHref(filter, recordedOrder.id);
    expect(detail).toBe(`/account/orders/${recordedOrder.id}?status=${status}`);
    const returnFilter = parseOrderFilter(new URL(detail, "http://localhost").searchParams.get("status"));
    expect(orderHistoryHref(returnFilter)).toBe(`/account/orders?status=${status}`);
  }
  expect(parseOrderFilter(["cancelled", "refunded"])).toBe("all");
  expect(parseOrderFilter("REFUNDED")).toBe("all");
});
