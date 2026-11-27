import { expect, test } from "@playwright/test";
import { canonicalOrigin, safeSlug, searchLabel } from "../src/lib/seo/public-search";

test("canonical discovery requires two matching settings, a production deployment and the canonical Host", () => {
  const domain = "shop.example.com", site = "https://" + domain;
  expect(canonicalOrigin(site, domain, domain, "production", "production")).toBe(site);
  for (const bad of ["shop.workers.dev", "branch.shop.pages.dev", "branch.vercel.app", "127.0.0.1", "app.local"]) {
    expect(canonicalOrigin("https://" + bad, bad, bad, "production", undefined)).toBeNull();
  }
  for (const wrong of [undefined, "http://" + domain, site + "/private", site + "?token=x", site + "#top",
    "https://u:p@" + domain, site + ":443", "https://elsewhere.com"]) {
    expect(canonicalOrigin(wrong, domain, domain, "production", undefined)).toBeNull();
  }
  expect(canonicalOrigin(site, undefined, domain, "production", undefined)).toBeNull();
  expect(canonicalOrigin(site, domain, "preview.example.com", "production", undefined)).toBeNull();
  expect(canonicalOrigin(site, domain, domain, "production", "preview")).toBeNull();
  expect(canonicalOrigin(site, domain, domain, "development", undefined)).toBeNull();
});

test("backend collision slugs are routable; unsafe path components and contact-bearing metadata are not", () => {
  expect(safeSlug("desk-1732185220123")).toBe(true);
  for (const slug of ["../admin", "desk?phone=x", "desk%2fadmin", "//example.com", "a#b"]) expect(safeSlug(slug)).toBe(false);
  for (const title of ["Call +260 971 123 456", "seller@example.com", "<b>Offer</b>", "Visit https://example.com"]) {
    expect(searchLabel(title)).toBe("");
  }
  expect(searchLabel("Galaxy A55 (128 GB)")).toBe("Galaxy A55 (128 GB)");
});
