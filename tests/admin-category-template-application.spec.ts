import { expect, test, type Page, type Route } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import http, { type Server } from "node:http";
import path from "node:path";
import {
  applyCategoryTemplate,
  getCategoryAttributes,
  getCategoryTemplates,
} from "../src/features/admin-categories/api/admin-categories";
import { resetApiClientSecurityStateForTests } from "../src/services/api";

const originalFetch = globalThis.fetch;
const repoRoot = path.resolve(__dirname, "..");
const BROWSER_PORT = 3217;
const BACKEND_PORT = 5047;
const BROWSER_ORIGIN = `http://127.0.0.1:${BROWSER_PORT}`;
const TEMPLATE_KEYS = [
  "solar-inverters",
  "solar-batteries",
  "solar-panels",
  "phones-tablets",
  "laptops-computers",
  "fashion-apparel",
  "home-appliances",
  "tvs-entertainment",
] as const;

function attribute(slug: string, id = `attribute-${slug}`) {
  return {
    id,
    categoryId: "category-1",
    name: slug.replaceAll("-", " "),
    slug,
    type: "SELECT",
    options: { choices: ["One"], isFilterable: true },
    isRequired: true,
    sortOrder: 1,
  };
}

function template(templateKey: string) {
  const slug = `${templateKey}-model`;
  return {
    templateKey,
    title: `${templateKey} template`,
    description: `Fields for ${templateKey}.`,
    attributes: [{
      name: "Model",
      slug,
      type: "SELECT",
      isRequired: true,
      sortOrder: 1,
      options: { choices: ["One"], isVariation: true, isFilterable: true },
    }],
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function categoryAttribute(slug = "server-model") {
  return attribute(slug, `id-${slug}`);
}

function numberAttribute(slug = "screen-size") {
  return {
    ...attribute(slug, `id-${slug}`),
    type: "NUMBER" as const,
    options: { unit: "inch", isFilterable: true },
  };
}

function adminIdentityPayload() {
  return {
    status: "success",
    data: {
      user: {
        id: "admin-fixture",
        name: "Fixture Admin",
        email: "admin@example.test",
        role: "SUPER_ADMIN",
        permissions: ["access_admin_panel", "manage_categories"],
      },
    },
  };
}

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await originalFetch(url);
      if (response.status < 500) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let backendFixture: Server | null = null;
let nextServer: ChildProcess | null = null;

test.beforeAll(async () => {
  backendFixture = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${BACKEND_PORT}`);
    response.setHeader("content-type", "application/json");
    if (url.pathname === "/api/v1/user/me") {
      response.end(JSON.stringify(adminIdentityPayload()));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ status: "fail", message: "Fixture route missing" }));
  });
  await new Promise<void>((resolve, reject) => {
    backendFixture!.once("error", reject);
    backendFixture!.listen(BACKEND_PORT, "127.0.0.1", resolve);
  });

  nextServer = spawn(
    process.execPath,
    [path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(BROWSER_PORT)],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        INTERNAL_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}/api/v1`,
        ADMIN_API_URL: `http://127.0.0.1:${BACKEND_PORT}/api/v1`,
      },
      stdio: "ignore",
    },
  );
  await waitForServer(`${BROWSER_ORIGIN}/admin/login`);
});

test.afterAll(async () => {
  if (nextServer && !nextServer.killed) nextServer.kill();
  await new Promise<void>((resolve) => backendFixture?.close(() => resolve()) ?? resolve());
});

type BrowserMode = "success" | "422" | "403" | "unavailable" | "malformed";
type CategoryPatchRecord = { id: string; body: Record<string, unknown> };

async function installCategoryRoutes(
  page: Page,
  mode: { current: BrowserMode },
  direct: { current: ReturnType<typeof categoryAttribute>[] },
  categoryPatches: CategoryPatchRecord[] = [],
) {
  await page.route("**/api/backend/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/backend", "");
    const categories = [
      { id: "category-1", name: "Electronics", slug: "electronics", description: "Devices and accessories", icon: null, parentId: null, isActive: true, sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", _count: { children: 1, products: 0, attributes: 0 } },
      { id: "category-child", name: "Phones", slug: "phones", description: null, icon: null, parentId: "category-1", isActive: true, sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", _count: { children: 0, products: 0, attributes: 0 } },
    ];
    if (pathname === "/admin/categories") {
      return route.fulfill({ json: {
        data: {
          categories,
          tree: [{ ...categories[0], children: [{ ...categories[1], children: [] }] }],
        },
      } });
    }
    const categoryUpdateMatch = pathname.match(/^\/admin\/categories\/([^/]+)$/);
    if (categoryUpdateMatch && route.request().method() === "PATCH") {
      const id = categoryUpdateMatch[1]!;
      const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      categoryPatches.push({ id, body });
      const current = categories.find((category) => category.id === id) ?? categories[0];
      return route.fulfill({ json: { data: { category: { ...current, ...body, updatedAt: "2026-01-02T00:00:00.000Z" } } } });
    }
    if (pathname === "/admin/categories/category-1/attributes") {
      return route.fulfill({ json: { data: { directAttributes: direct.current, inheritedAttributes: [categoryAttribute("inherited-model")], allAttributes: [...direct.current, categoryAttribute("inherited-model")] } } });
    }
    if (pathname === "/admin/category-templates") {
      return route.fulfill({ json: { status: "success", data: { templates: TEMPLATE_KEYS.map(template) } } });
    }
    if (pathname === "/auth/csrf-token") return route.fulfill({ json: { data: { csrfToken: "fixture-csrf" } } });
    if (pathname === "/admin/categories/category-1/apply-template") {
      if (mode.current === "422") return route.fulfill({ status: 422, json: { message: "Invalid selection" } });
      if (mode.current === "403") return route.fulfill({ status: 403, json: { message: "Forbidden" } });
      if (mode.current === "unavailable") return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      if (mode.current === "malformed") return route.fulfill({ json: { status: "success", data: { templateKey: "phones-tablets" } } });
      const result = categoryAttribute("server-model");
      direct.current = [result];
      return route.fulfill({ json: { status: "success", data: { templateKey: "solar-inverters", requestedAttributeSlugs: ["solar-inverters-model"], createdAttributes: [result], updatedAttributes: [categoryAttribute("updated-model")], unchangedAttributes: [categoryAttribute("unchanged-model")] } } });
    }
    return route.fulfill({ status: 404, json: { status: "fail", message: "Fixture route missing" } });
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClientSecurityStateForTests();
});

test("renders only the backend-issued eight-template catalog contract", async () => {
  const catalog = TEMPLATE_KEYS.map(template);
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.pathname);
    return json({ status: "success", data: { templates: catalog } });
  }) as typeof fetch;

  const templates = await getCategoryTemplates();
  expect(requests).toEqual(["/api/v1/admin/category-templates"]);
  expect(templates.map((item) => item.templateKey)).toEqual(TEMPLATE_KEYS);
  expect(templates.every((item) => item.attributes[0]?.slug === `${item.templateKey}-model`)).toBe(true);
});

test("each backend template applies its canonical selected slugs and preserves created, updated, and unchanged outcomes", async () => {
  const requests: Array<{ path: string; body?: Record<string, unknown>; csrf?: string | null }> = [];
  let applyIndex = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith("/auth/csrf-token")) return json({ data: { csrfToken: "fixture-csrf" } });
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    requests.push({ path: url.pathname, body, csrf: new Headers(init?.headers).get("X-CSRF-Token") });
    const slug = (body?.selectedAttributeSlugs as string[])[0]!;
    const result = attribute(slug);
    const mode = applyIndex++ % 3;
    return json({
      status: "success",
      data: {
        templateKey: body?.templateKey,
        requestedAttributeSlugs: [slug],
        createdAttributes: mode === 0 ? [result] : [],
        updatedAttributes: mode === 1 ? [result] : [],
        unchangedAttributes: mode === 2 ? [result] : [],
      },
    });
  }) as typeof fetch;

  const outcomes = await Promise.all(TEMPLATE_KEYS.map((templateKey) =>
    applyCategoryTemplate("category-1", templateKey, [`${templateKey}-model`]),
  ));

  expect(requests).toHaveLength(8);
  for (const [index, request] of requests.entries()) {
    expect(request.path).toBe("/api/v1/admin/categories/category-1/apply-template");
    expect(request.body).toMatchObject({
      templateKey: TEMPLATE_KEYS[index],
      selectedAttributeSlugs: [`${TEMPLATE_KEYS[index]}-model`],
    });
    expect(request.csrf).toBe("fixture-csrf");
  }
  expect(outcomes.map((outcome) => [outcome.createdAttributes.length, outcome.updatedAttributes.length, outcome.unchangedAttributes.length])).toEqual([
    [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0],
    [0, 1, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0],
  ]);
});

test("unprocessable, forbidden, unavailable, and malformed outcomes remain failures that callers can retain and retry", async () => {
  const scenarios = [
    { status: 422, payload: { message: "No selected attributes" }, expected: 422 },
    { status: 403, payload: { message: "Forbidden" }, expected: 403 },
    { status: 503, payload: { message: "Unavailable" }, expected: 503 },
    { status: 200, payload: { status: "success", data: { templateKey: "phones-tablets" } }, expected: null },
  ];

  for (const scenario of scenarios) {
    resetApiClientSecurityStateForTests();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.endsWith("/auth/csrf-token")) return json({ data: { csrfToken: "fixture-csrf" } });
      return json(scenario.payload, scenario.status);
    }) as typeof fetch;

    const attempt = applyCategoryTemplate("category-1", "phones-tablets", ["phones-tablets-model"]);
    if (scenario.expected) {
      await expect(attempt).rejects.toMatchObject({ name: "ApiError", status: scenario.expected });
    } else {
      await expect(attempt).rejects.toThrow("could not be confirmed");
    }
  }
});

test("invalid catalog envelopes are rejected instead of creating a local or empty template success", async () => {
  for (const payload of [
    { status: "success", data: {} },
    { status: "success", data: { templates: [{ templateKey: "phones-tablets" }] } },
    { status: "fail", data: { templates: [] } },
  ]) {
    globalThis.fetch = (async () => json(payload)) as typeof fetch;
    await expect(getCategoryTemplates()).rejects.toThrow("Category templates are unavailable");
  }
});

test("category attribute loading preserves backend failures instead of converting 404 to empty success", async () => {
  globalThis.fetch = (async () => json({ status: "fail", message: "Missing category" }, 404)) as typeof fetch;
  await expect(getCategoryAttributes("missing-category")).rejects.toMatchObject({
    name: "ApiError",
    status: 404,
  });
});

test("real category workspace renders backend templates, refreshes both previews, and retains the dialog on failures", async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  const mode = { current: "success" as BrowserMode };
  const direct = { current: [] as ReturnType<typeof categoryAttribute>[] };
  const categoryPatches: CategoryPatchRecord[] = [];
  const diagnostics: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => diagnostics.push(error.message));
  await installCategoryRoutes(page, mode, direct, categoryPatches);
  await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);
  await page.goto(`${BROWSER_ORIGIN}/admin/categories`, { waitUntil: "networkidle" });

  await page.getByTitle("Edit Category Details").first().click({ force: true });
  await expect(page.getByRole("dialog", { name: "Edit Category" })).toBeVisible();
  await page.getByLabel("Description").fill("Updated category note");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Category" })).toHaveCount(0);
  expect(categoryPatches.at(-1)).toEqual({ id: "category-1", body: { description: "Updated category note" } });

  await page.getByTitle("Edit Category Details").first().click({ force: true });
  await page.getByRole("button", { name: "Advanced details" }).click();
  await page.getByLabel("Category URL").fill("electronics-main");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Add a reason with at least 3 characters.")).toBeVisible();
  await page.getByLabel("Reason for structure change *").fill("ok");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Add a reason with at least 3 characters.")).toBeVisible();
  await page.getByLabel("Reason for structure change *").fill("SEO");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Category" })).toHaveCount(0);
  expect(categoryPatches.at(-1)).toEqual({ id: "category-1", body: { slug: "electronics-main", reason: "SEO" } });

  const applyTemplate = page.getByRole("button", { name: "Apply Template" }).first();
  await expect(applyTemplate).toBeVisible();
  await applyTemplate.click();
  const dialog = page.getByRole("dialog", { name: "Category template library" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close category template library" })).toBeFocused();
  await expect(dialog.getByText("Pick one template to review. Nothing is selected by default.")).toBeVisible();
  await expect(dialog.getByText("Select a template to review its attributes.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Apply selected" })).toHaveCount(0);
  for (const key of TEMPLATE_KEYS) await expect(dialog.getByRole("button", { name: `${key} template` })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await applyTemplate.click();
  await dialog.getByRole("button", { name: "solar-inverters template" }).click();
  await dialog.getByRole("button", { name: "Apply selected" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("1 attribute created; 1 attribute updated; 1 unchanged")).toBeVisible();
  await expect(page.getByText("server model", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Seller Preview" }).click();
  await expect(page.getByRole("heading", { name: "Seller field preview" })).toBeVisible();
  await expect(page.getByText("server model", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Live Seller Form Simulator")).toHaveCount(0);
  await expect(page.getByText("Generated SKU")).toHaveCount(0);
  await expect(page.getByText("Mock Price")).toHaveCount(0);
  await page.getByRole("button", { name: "Buyer Filters" }).click();
  await expect(page.getByRole("heading", { name: "Buyer filter preview" })).toBeVisible();
  await expect(page.getByText("server model", { exact: true })).toBeVisible();
  await expect(page.getByText("Live Index Preview")).toHaveCount(0);
  await expect(page.getByText("Storefront Simulation")).toHaveCount(0);
  await page.getByRole("button", { name: "Product Fields" }).click();
  await expect(applyTemplate).toBeVisible();

  for (const failure of ["422", "403", "unavailable", "malformed"] as const) {
    mode.current = failure;
    await applyTemplate.click();
    await dialog.getByRole("button", { name: "solar-inverters template" }).click();
    await dialog.getByRole("button", { name: "Apply selected" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Apply selected" })).toBeEnabled();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(page.getByText("1 attribute created; 1 attribute updated; 1 unchanged")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close category template library" }).click();
  }

  await page.evaluate(() => window.sessionStorage.setItem("zogular:admin:selected-category-id", "category-child"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Phones" })).toBeVisible();
  await page.getByTitle("Edit Category Details").last().click({ force: true });
  await page.getByLabel("Parent category").selectOption("");
  await page.getByLabel("Reason for structure change *").fill("Root level");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Category" })).toHaveCount(0);
  expect(categoryPatches.at(-1)).toEqual({ id: "category-child", body: { parentId: null, reason: "Root level" } });

  await page.screenshot({ path: testInfo.outputPath("category-templates-1440.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(diagnostics).toEqual([]);
  await context.close();
});

test("category template modal remains contained across approved viewport widths", async ({ browser }, testInfo) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    const mode = { current: "success" as BrowserMode };
    const direct = { current: [categoryAttribute("filter-choice"), numberAttribute("filter-number")] as ReturnType<typeof categoryAttribute>[] };
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await installCategoryRoutes(page, mode, direct);
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);
    await page.goto(`${BROWSER_ORIGIN}/admin/categories`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Apply Template" }).first().click();
    await expect(page.getByRole("dialog", { name: "Category template library" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "Close category template library" }).click();
    await page.getByRole("button", { name: "Buyer Filters" }).click();
    await expect(page.getByRole("heading", { name: "Buyer filter preview" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "One" }).first()).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Min (inch)" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Max (inch)" })).toBeVisible();
    for (const prohibited of [
      "Live Index Preview",
      "Storefront Simulation",
      "Facets Indexed",
      "Simulated Results",
      "Mock",
      "KMW",
      "Trendyol",
      "Amazon",
    ]) {
      await expect(page.getByText(prohibited)).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`category-templates-${width}.png`), fullPage: true });
    await context.close();
  }
});
