import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const requireFromRepo = createRequire(resolve("package.json"));
const productId = "e695f846-5d60-4374-9429-b2bc46b96287";
const revisionId = "bf1a1091-b208-4f4e-97e6-a2004a261cad";
const path = `/api/backend/vendor/products/${productId}/listing-revisions`;
const origin = "https://a5-fixture.invalid";
const live = {
  id: productId, listingVersion: 2, title: "Approved desk lamp",
  description: "A bright lamp for a small writing desk.", price: 120, salePrice: null,
};
const panel = "src/features/listing-revisions/components/SellerListingRevisionPanel.tsx";
let bundle: string;
let css: string;

test.use({ viewport: { width: 375, height: 812 }, channel: process.env.A5_TEST_BROWSER_CHANNEL });

// Compile the real panel in a private temporary directory; no Next server or repo config is loaded.
test.beforeAll(async () => {
  const root = process.cwd();
  const scratch = await mkdtemp(join(tmpdir(), "zogular-a5-panel-"));
  try {
    const loader = join(scratch, "typescript.cjs");
    const entry = join(scratch, "entry.tsx");
    await writeFile(loader, `const ts = require(${JSON.stringify(requireFromRepo.resolve("typescript"))});
module.exports = (source) => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020
}}).outputText;`);
    await writeFile(entry, `import { createRoot } from "react-dom/client";
import { SellerListingRevisionPanel } from "@/features/listing-revisions/components/SellerListingRevisionPanel";
createRoot(document.getElementById("app")).render(<SellerListingRevisionPanel
  product={{ id: ${JSON.stringify(productId)}, status: "published", stock: 5, images: [] }}
  backHref="/seller/products" canSubmit />);`);
    const webpack = requireFromRepo("next/dist/compiled/webpack/bundle5")().webpack;
    const compiler = webpack({
      mode: "production", context: root, entry, output: { path: scratch, filename: "panel.js" },
      optimization: { minimize: false },
      resolve: { alias: { "@": resolve("src") }, extensions: [".tsx", ".ts", ".js"], modules: [resolve("node_modules")] },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }] },
      plugins: [new webpack.DefinePlugin({
        "process.env.__NEXT_ROUTER_BASEPATH": '""',
        "process.env.INTERNAL_BACKEND_URL": "undefined",
        "process.env.NEXT_PUBLIC_API_URL": "undefined",
        "process.env.NEXT_PUBLIC_API_PROXY_URL": '"/api/backend"',
      })],
    });
    try {
      await new Promise<void>((done, reject) => compiler.run((error: Error | null, stats: {
        hasErrors: () => boolean; toString: (options: string) => string;
      } | undefined) => error ? reject(error) : stats?.hasErrors()
        ? reject(new Error(stats.toString("errors-only"))) : done()));
    } finally {
      await new Promise<void>((done, reject) => compiler.close((error: Error | null) => error ? reject(error) : done()));
    }
    bundle = await readFile(join(scratch, "panel.js"), "utf8");
    const files = [panel, ...["button", "input", "textarea"].map((name) => `src/components/ui/${name}.tsx`)];
    const scanner = new Scanner({ sources: [] });
    const { build } = await compile(await readFile("src/app/globals.css", "utf8"), { base: resolve("src/app"), onDependency() {} });
    css = build(scanner.scanFiles(await Promise.all(files.map(async (file) => ({
      content: await readFile(file, "utf8"), extension: "tsx",
    })))));
  } finally {
    await rm(scratch, { recursive: true });
  }
});

async function openPanel(page: Page, failure?: "read" | "conflict") {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const publicListing = { ...live };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const method = route.request().method();
    if (url.pathname === "/seller-edit") {
      return route.fulfill({ contentType: "text/html", body:
        '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/panel.css"><div id="app" style="padding:16px"></div><script>window.process={env:{}}</script><script src="/panel.js"></script>' });
    }
    if (url.pathname === "/panel.css") return route.fulfill({ contentType: "text/css", body: css });
    if (url.pathname === "/panel.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
    if (url.pathname === "/api/backend/auth/csrf-token") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === "/public-listing") return route.fulfill({ json: publicListing });
    if (method !== "GET") writes.push({ method, path: url.pathname, body: route.request().postDataJSON() });
    if (url.pathname !== path) return route.fulfill({ status: 404, json: {} });
    if (method === "GET") {
      return failure === "read"
        ? route.fulfill({ status: 404, json: { message: "fixture-internal-error" } })
        : route.fulfill({ json: { status: "success", data: { product: publicListing, revisions: [] } } });
    }
    if (failure === "conflict") return route.fulfill({ status: 409, json: { message: "fixture-internal-error" } });
    const { title, description, price, salePrice } = publicListing;
    return route.fulfill({ status: 201, json: { status: "success", data: { revision: {
      id: revisionId, productId, baseVersion: 2, status: "PENDING_REVIEW",
      createdAt: "2026-11-01T09:00:00.000Z", decidedAt: null, sellerVisibleReason: null,
      payload: { title, description, price, salePrice, ...(writes.at(-1)?.body as { changes: object }).changes, schemaVersion: 1 },
    } } } });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/seller-edit`);
  expect(errors).toEqual([]);
  return writes;
}

test("mobile seller stages only an explicit revision while the approved listing stays unchanged", async ({ page }, info) => {
  const writes = await openPanel(page);
  const submit = page.getByRole("button", { name: "Submit revision for review" });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Title", { exact: true }).fill("Proposed desk lamp");
  await expect(submit).toBeEnabled();
  expect(writes).toEqual([]);
  const price = await page.getByLabel("Price (K)", { exact: true }).boundingBox();
  const sale = await page.getByLabel("Sale price (K)", { exact: true }).boundingBox();
  await expect(submit).toHaveCSS("display", "inline-flex");
  expect(sale!.y).toBeGreaterThan(price!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: info.outputPath("mobile-editor.png"), fullPage: true });
  await submit.click();
  await expect(page.getByRole("region", { name: "Pending revision" })).toContainText("Proposed desk lamp");
  await expect(page.getByRole("region", { name: "Current listing" })).toContainText("Approved desk lamp");
  await page.screenshot({ path: info.outputPath("mobile-pending.png"), fullPage: true });
  expect(await page.evaluate(() => fetch("/public-listing").then((response) => response.json()))).toEqual(live);
  expect(writes).toEqual([{ method: "POST", path, body: {
    baseVersion: 2, submissionKey: expect.any(String), changes: { title: "Proposed desk lamp" },
  } }]);
});

test("conflict blocks further writes until explicit refresh; unavailable history never exposes editing", async ({ page }) => {
  const writes = await openPanel(page, "conflict");
  await page.getByLabel("Title", { exact: true }).fill("Proposed desk lamp");
  await page.getByRole("button", { name: "Submit revision for review" }).click();
  await expect(page.getByRole("alert")).toHaveText("Refresh the listing revision before trying again.");
  await expect(page.getByRole("button", { name: "Submit revision for review" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh listing" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(live.title);
  expect(writes.map(({ method, path }) => ({ method, path }))).toEqual([{ method: "POST", path }]);
  await page.unrouteAll();
  const unavailableWrites = await openPanel(page, "read");
  await expect(page.getByRole("alert")).toHaveText("This listing revision action is not available.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
  expect(unavailableWrites).toEqual([]);
});
