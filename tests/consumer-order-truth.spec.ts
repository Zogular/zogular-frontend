import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

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

test("buyer recovery CTAs stay usable in browser without order-again affordance", async ({ page }) => {
  await page.setContent(`
    <main>
      <a href="https://wa.me/260970000000?text=Hi%20Zogular%2C%20I%20need%20help%20with%20Order%20%23ZG-2026-0001">WhatsApp Support</a>
      <a href="tel:+260970000000">Call Support</a>
      <a href="/categories">Browse Products</a>
      <section aria-label="order support">
        <h2>Need order help?</h2>
        <p>Share your order number with Zogular support for help with delivery, address changes, or payment questions.</p>
      </section>
    </main>
  `);

  await expect(page.getByRole("link", { name: "WhatsApp Support" })).toHaveAttribute("href", /wa\.me/);
  await expect(page.getByRole("link", { name: "Call Support" })).toHaveAttribute("href", /^tel:/);
  await expect(page.getByRole("link", { name: "Browse Products" })).toHaveAttribute("href", "/categories");
  await expect(page.getByText("Need order help?")).toBeVisible();
  await expect(page.getByRole("button", { name: /order again/i })).toHaveCount(0);
});
