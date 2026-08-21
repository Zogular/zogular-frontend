import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const repoRoot = path.resolve(__dirname, "..");

function readSource(filePath: string): string {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

const navbarSource = readSource("src/components/layout/Navbar.tsx");
const footerSource = readSource("src/components/layout/Footer.tsx");
const navbarSearchSource = readSource("src/components/layout/NavbarSearch.tsx");
const aboutSource = readSource("src/app/(consumer)/about/page.tsx");
const careersSource = readSource("src/app/(consumer)/careers/page.tsx");

test("desktop and mobile navbar use canonical track route", () => {
  expect(navbarSource).toContain('{ label: "Track Order", href: "/track" }');
  expect(navbarSource).toContain('{ label: "Track Order", href: "/track", icon: Package }');
  expect(navbarSource).not.toContain("/track-order");
  expect(footerSource).toContain('href: "/track"');
});

test("navbar autocomplete does not promise unavailable product suggestions", () => {
  expect(navbarSearchSource).toContain("productLimit: 0");
  expect(navbarSearchSource).toContain("Search all products for");
  expect(navbarSearchSource).toContain("router.push(nextHref)");
  expect(navbarSearchSource).not.toContain('CommandGroup heading="Products"');
  expect(navbarSearchSource).not.toContain("getProductTitle");
  expect(navbarSearchSource).not.toContain("getProductCategoryLabel");
  expect(navbarSearchSource).not.toContain("View all results");
});

test("about and careers copy avoid unsupported launch claims", () => {
  expect(aboutSource).toContain("clear marketplace categories");
  expect(aboutSource).not.toContain("verified categories");

  expect(careersSource).toContain("const careersEmail = BRAND.careersEmail");
  expect(careersSource).toContain("There are no public openings listed right now.");
  expect(careersSource).toContain('ctaLabel={careersEmail ? "Send General Interest" : undefined}');
  expect(careersSource).toContain("mailto:${careersEmail}");
  expect(careersSource).not.toContain("actively interested");
  expect(careersSource).not.toContain("How to Apply");
  expect(careersSource).not.toContain("role interest");
});
