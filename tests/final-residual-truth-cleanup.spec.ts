import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const repoRoot = path.resolve(__dirname, "..");

function readSource(filePath: string): string {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

const footerSource = readSource("src/components/layout/Footer.tsx");
const notFoundSource = readSource("src/app/not-found.tsx");

test("footer uses generic category access without hardcoded category claims", () => {
  expect(footerSource).toContain('href: "/categories"');
  expect(footerSource).toContain("Browse Categories");
  expect(footerSource).toContain("current category directory");

  for (const unsupported of [
    "Phones & Tablets",
    "Computing",
    "Fashion",
    "Supermarket",
    "/category/phones-and-tablets",
    "/category/computing",
    "/category/fashion",
    "/category/supermarket",
  ]) {
    expect(footerSource).not.toContain(unsupported);
  }
});

test("not found page uses consumer recovery copy without development-status claims", () => {
  expect(notFoundSource).toContain("Page unavailable");
  expect(notFoundSource).toContain("We could not find that page. Go home or browse categories to keep shopping.");
  expect(notFoundSource).toContain('href="/"');
  expect(notFoundSource).toContain('href="/categories"');

  for (const unsupported of [
    "still being built",
    "link you followed is broken",
    "Lost in Transit",
    "page or product",
  ]) {
    expect(notFoundSource).not.toContain(unsupported);
  }
});
