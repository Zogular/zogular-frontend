import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

const assetDirectory = path.resolve("public/images/discovery");

const expectedAssets = [
  {
    file: "home-editorial-desktop.webp",
    width: 1536,
    height: 512,
    maximumBytes: 60_000,
  },
  {
    file: "home-editorial-mobile.webp",
    width: 960,
    height: 640,
    maximumBytes: 50_000,
  },
] as const;

test("ships only the two reviewed WebP delivery crops", async () => {
  const imageFiles = (await readdir(assetDirectory))
    .filter((file) => /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file))
    .sort();

  expect(imageFiles).toEqual(expectedAssets.map(({ file }) => file).sort());
});

for (const expected of expectedAssets) {
  test(`${expected.file} has the reviewed delivery contract`, async () => {
    const assetPath = path.join(assetDirectory, expected.file);
    const [metadata, fileStats] = await Promise.all([sharp(assetPath).metadata(), stat(assetPath)]);

    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(expected.width);
    expect(metadata.height).toBe(expected.height);
    expect(metadata.pages ?? 1).toBe(1);
    expect(metadata.hasAlpha).toBe(false);
    expect(fileStats.size).toBeLessThanOrEqual(expected.maximumBytes);
  });
}

test("responsive crops are distinct derivatives rather than duplicate payloads", async () => {
  const hashes = await Promise.all(
    expectedAssets.map(async ({ file }) => {
      const contents = await readFile(path.join(assetDirectory, file));
      return createHash("sha256").update(contents).digest("hex");
    }),
  );

  expect(new Set(hashes).size).toBe(expectedAssets.length);
});

test("records generation provenance and non-product presentation boundaries", async () => {
  const provenance = await readFile(path.join(assetDirectory, "README.md"), "utf8");

  expect(provenance).toContain("No third-party or scraped image was used as an input.");
  expect(provenance).toContain("Do not present the pictured goods as real listings.");
  expect(provenance).toContain("Missing asset behavior must remain an honest non-image composition.");
});
