import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const listingStatePath = path.resolve("src/features/consumer-discovery/listing/DiscoveryListingState.tsx");
const homeIntroPath = path.resolve("src/features/consumer-discovery/home/EditorialDiscoveryIntro.tsx");
const listingControlsPath = path.resolve("src/features/consumer-discovery/listing/DiscoveryListingControls.tsx");
const listingHeaderPath = path.resolve("src/features/consumer-discovery/listing/DiscoveryListingHeader.tsx");
const buyerDiscoveryPaths = [
  path.resolve("src/app/(consumer)/products/page.tsx"),
  path.resolve("src/app/(consumer)/search/page.tsx"),
  path.resolve("src/app/(consumer)/categories/page.tsx"),
  path.resolve("src/features/consumer-discovery/home/HomeCategoryRail.tsx"),
  path.resolve("src/features/consumer-discovery/components/DiscoveryCollectionState.tsx"),
  path.resolve("src/components/layout/Footer.tsx"),
];

test("Package 6 uses the approved plain discovery-state copy", () => {
  const listing = fs.readFileSync(listingStatePath, "utf8");
  const home = fs.readFileSync(homeIntroPath, "utf8");

  for (const text of [
    "No products in this category yet",
    "Try another category or search all products.",
    "No matches for these filters",
    "Change a filter to see more products.",
    "Products could not load",
    "Check your connection and try again.",
  ]) expect(listing).toContain(text);
  for (const text of ["Explore Zogular.", "No products are available yet.", "Browse products", "Search"]) expect(home).toContain(text);
});

test("Package 6 state surfaces exclude technical copy and retain truthful actions", () => {
  const listing = fs.readFileSync(listingStatePath, "utf8");
  const home = fs.readFileSync(homeIntroPath, "utf8");
  const controls = fs.readFileSync(listingControlsPath, "utf8");
  const header = fs.readFileSync(listingHeaderPath, "utf8");
  const combined = `${listing}\n${home}\n${header}`;

  for (const forbidden of ["approved public", "typed failure", "buyer-visible", "contract"]) {
    expect(combined.toLowerCase()).not.toContain(forbidden);
  }
  expect(header).not.toMatch(/approved products?/i);
  for (const action of ["Browse all products", "Clear filters", "Edit filters", "Retry"]) expect(listing).toContain(action);
  expect(controls).toContain('data-testid="mobile-filter-trigger"');
});

test("buyer-facing discovery copy excludes internal implementation language", () => {
  const renderedCopy = buyerDiscoveryPaths.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const forbidden of ["approved products", "approved public", "buyer-visible", "public categories", "typed failure", "metadata failure", "contract failure"]) {
    expect(renderedCopy.toLowerCase()).not.toContain(forbidden);
  }
  expect(renderedCopy).toContain("Browse products available on Zogular.");
  expect(renderedCopy).toContain("Products matching your search.");
});
