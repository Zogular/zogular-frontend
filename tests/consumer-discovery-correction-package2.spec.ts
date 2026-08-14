import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const introSource = fs.readFileSync(
  path.resolve("src/features/consumer-discovery/home/EditorialDiscoveryIntro.tsx"),
  "utf8",
);
const homeSource = fs.readFileSync(
  path.resolve("src/features/consumer-discovery/home/HomeDiscovery.tsx"),
  "utf8",
);
const categoriesSource = fs.readFileSync(
  path.resolve("src/features/consumer-discovery/home/HomeCategoryRail.tsx"),
  "utf8",
);

test("wires the reviewed responsive editorial assets through the Next.js image pipeline", () => {
  expect(introSource).toContain('getImageProps({');
  expect(introSource).toContain('/images/discovery/home-editorial-mobile.webp');
  expect(introSource).toContain('/images/discovery/home-editorial-desktop.webp');
  expect(introSource).toContain('media="(min-width: 768px)"');
  expect(introSource).toContain('alt=""');
  expect(introSource).toContain('data-testid="home-editorial-image"');
  expect(introSource).not.toMatch(/unoptimized|carousel|autoplay|slider/i);
});

test("uses only the approved plain hero and no-product words", () => {
  for (const copy of [
    "Find what you need.",
    "Shop everyday products in Zambia.",
    "Shop now",
    "Explore Zogular.",
    "No products are available yet.",
    "Browse products",
    "Search",
  ]) {
    expect(introSource).toContain(copy);
  }

  expect(introSource).toContain('href: "/products"');
  expect(introSource).toContain('href: "/search"');
  expect(introSource).not.toMatch(/deal|popular|delivery|seller|trust|campaign/i);
});

test("keeps optional product sections conditional and removes stale empty-success chrome", () => {
  expect(homeSource).toContain("const hasProducts =");
  expect(homeSource).toContain("<EditorialDiscoveryIntro hasProducts={hasProducts} />");
  expect(homeSource).toContain("exploreMore.length > 0 ?");
  expect(homeSource).not.toContain("home-explore-empty");
  expect(homeSource).not.toContain("public catalog currently");
});

test("uses Lucide category icons without emoji or a duplicate category surface", () => {
  expect(categoriesSource).toContain('from "lucide-react"');
  expect(categoriesSource).toContain("categoryIcons");
  expect(categoriesSource).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  expect((homeSource.match(/<HomeCategoryRail/g) ?? []).length).toBe(1);
});

test("reserves a keyboard-accessible 44px hero action and reduced-motion-safe transitions", () => {
  expect(introSource).toContain("min-h-11");
  expect(introSource).toContain("focus-visible:ring-2");
  expect(introSource).toContain("motion-reduce:duration-0");
  expect(introSource).toContain("motion-reduce:transition-none");
});
