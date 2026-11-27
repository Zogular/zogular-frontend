import { expect, test } from "@playwright/test";
import { getSellerProductStockLabel, getSellerProductStockState } from "../src/features/seller-products/product-presentation";

// These are normalized seller catalog values: legacy null stock arrives as zero plus a flag.
const cases = [
  ["available single item", 0, false, true, 5, "in-stock", "1 in stock"],
  ["single item without a threshold", 0, false, true, 0, "in-stock", "1 in stock"],
  ["sold legacy item as normalized", 0, true, false, 5, "out-of-stock", "Out of stock"],
  ["sold overrides the single-item flag", 0, true, true, 5, "out-of-stock", "Out of stock"],
  ["sold overrides a positive count", 8, true, false, 5, "out-of-stock", "Out of stock"],
  ["empty counted listing", 0, false, false, 0, "out-of-stock", "Out of stock"],
  ["below threshold", 1, false, false, 5, "low-stock", "1 low"],
  ["at threshold", 5, false, false, 5, "low-stock", "5 low"],
  ["above threshold", 6, false, false, 5, "in-stock", "6 in stock"],
] as const;

for (const [name, stock, isSold, isLegacySingleItem, lowStockThreshold, state, label] of cases) {
  test(name, () => {
    const product = { stock, isSold, isLegacySingleItem, lowStockThreshold };
    expect(getSellerProductStockState(product)).toBe(state);
    expect(getSellerProductStockLabel(product)).toBe(label);
  });
}
