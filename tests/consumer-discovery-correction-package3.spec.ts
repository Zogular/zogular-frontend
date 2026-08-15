import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const listingControlsSource = fs.readFileSync(
  path.resolve("src/features/consumer-discovery/listing/DiscoveryListingControls.tsx"),
  "utf8",
);
const listingPageSource = fs.readFileSync(
  path.resolve("src/features/consumer-discovery/listing/DiscoveryListingPage.tsx"),
  "utf8",
);
const desktopRailSource = fs.readFileSync(
  path.resolve("src/features/consumer-discovery/listing/DesktopSubcategoryFilterRail.tsx"),
  "utf8",
);

test("mobile listing controls keep Filter and Sort as separate modal interactions", () => {
  expect(listingControlsSource).toContain('openSheet("filter", event)');
  expect(listingControlsSource).toContain('openSheet("sort", event)');
  expect(listingControlsSource).toContain('title="Filter products"');
  expect(listingControlsSource).toContain('title="Sort products"');
  expect(listingControlsSource).not.toContain("Filter and sort");
});

test("ordinary listing sort exposes exactly the three supported choices", () => {
  const labels = [...listingControlsSource.matchAll(/\{ value: "[^"]+", label: "([^"]+)" \}/g)].map((match) => match[1]);
  expect(labels).toEqual(["Newest", "Price: low to high", "Price: high to low"]);
  expect(listingControlsSource).not.toContain('label: "Most Viewed"');
});

test("desktop category selection is draft-backed and requires Apply", () => {
  expect(desktopRailSource).toContain("setDraftKey(filter.key)");
  expect(desktopRailSource).toContain("function applyDraft()");
  expect(desktopRailSource).toContain(">Clear</Button>");
  expect(desktopRailSource).toContain(">Apply</Button>");
  expect(desktopRailSource).not.toContain("<Link");
  expect(listingPageSource).toContain("<DesktopSubcategoryFilterRail");
});

test("unsupported listing filters remain absent", () => {
  const customerVisibleSource = `${listingControlsSource}\n${desktopRailSource}`;
  for (const unsupported of [
    "Price range",
    "Condition",
    "Availability",
    "Brand",
    "Rating",
    "Location",
    "Delivery",
    "Seller verification",
  ]) {
    expect(customerVisibleSource).not.toContain(unsupported);
  }
});

test("listing failures suppress category metadata counts without changing other outcomes", () => {
  expect(listingPageSource).toContain('state === "product-failure" || state === "metadata-failure"');
  expect(listingPageSource).toContain("approvedPublicProductCount={listingFailed ? undefined : approvedPublicProductCount}");
});
