import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const navigationPath = path.resolve("src/components/layout/MobileBottomNavigation.tsx");
const layoutPath = path.resolve("src/app/(consumer)/layout.tsx");

test("Package 6B integrates one shared five-destination mobile navigation", () => {
  const navigation = fs.readFileSync(navigationPath, "utf8");
  const layout = fs.readFileSync(layoutPath, "utf8");
  for (const label of ["Home", "Categories", "Wishlist", "Orders", "Account"]) expect(navigation).toContain(`label: "${label}"`);
  expect(layout.match(/<MobileBottomNavigation\s*\/>/g)).toHaveLength(1);
  expect(navigation).toContain('aria-label="Mobile navigation"');
  expect(navigation).toContain('aria-current={isActive ? "page" : undefined}');
  expect(navigation).toContain("min-h-11");
});

test("Package 6B keeps operational routes and PDP outside the mobile-nav surface", () => {
  const navigation = fs.readFileSync(navigationPath, "utf8");
  for (const forbidden of ["/product", "/cart", "/checkout", "/auth", "/seller", "/admin"]) {
    expect(navigation.match(new RegExp(`VISIBLE_PATHS[^;]*["']${forbidden.replace("/", "\\/")}(?:/|["'])`))).toBeNull();
  }
  expect(navigation).toContain('appendNextPath("/auth/login", "/account/orders")');
  expect(navigation).toContain('appendNextPath("/auth/login", "/account")');
});
