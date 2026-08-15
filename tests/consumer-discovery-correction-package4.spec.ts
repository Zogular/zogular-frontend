import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const listingDirectory = path.resolve("src/features/consumer-discovery/listing");

test("Package 4 owns one bounded listing transition and truthful pending presentation", () => {
  const transition = fs.readFileSync(path.join(listingDirectory, "DiscoveryListingTransition.tsx"), "utf8");
  const page = fs.readFileSync(path.join(listingDirectory, "DiscoveryListingPage.tsx"), "utf8");
  const controls = fs.readFileSync(path.join(listingDirectory, "DiscoveryListingControls.tsx"), "utf8");
  const rail = fs.readFileSync(path.join(listingDirectory, "DesktopSubcategoryFilterRail.tsx"), "utf8");

  expect(transition).toContain("useTransition");
  expect(transition).toContain("router.push(href)");
  expect(transition).toContain('data-testid="listing-pending-state"');
  expect(transition).toContain("DiscoveryProductSkeleton");
  expect(page).toContain("DiscoveryListingTransitionProvider");
  expect(page).toContain("DiscoveryListingResultBoundary");
  expect(controls).toContain('"Updating products…"');
  expect(controls).toContain("!isPending && activeChips.length");
  expect(controls).not.toContain("useRouter");
  expect(rail).not.toContain("useRouter");
});

test("Package 4 preserves immediate Apply dismissal and ordinary cancel animation", () => {
  const controls = fs.readFileSync(path.join(listingDirectory, "DiscoveryListingControls.tsx"), "utf8");
  const dialog = fs.readFileSync(path.join(listingDirectory, "DiscoveryMobileFilterDialog.tsx"), "utf8");

  expect(controls).toContain("setCloseImmediately(true)");
  expect(controls).toContain("setCloseImmediately(false)");
  expect(dialog).toContain("if (immediateClose) finishClose()");
  expect(dialog).toContain("else beginClose()");
  expect(dialog).toContain("CLOSE_TRANSITION_MS = 200");
});
