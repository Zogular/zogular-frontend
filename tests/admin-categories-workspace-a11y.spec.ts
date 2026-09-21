import { expect, test, type Page, type Route } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import http, { type Server } from "node:http";
import path from "node:path";
import { CATEGORY_ICON_CATALOG } from "../src/features/admin-categories/components/CategoryIconPickerModal";
import { adminIdentityHasPermission, type AdminIdentity } from "../src/services/admin/session";

/**
 * @file admin-categories-workspace-a11y.spec.ts
 * @description
 * CT-F1-A category workspace coverage. The unit-level checks preserve catalogue
 * and permission invariants; the browser suite runs the rendered protected page
 * against isolated route fixtures to prove modal focus and responsive behaviour.
 */

const repoRoot = path.resolve(__dirname, "..");
const browserPort = 3221;
const backendPort = 5021;
const browserOrigin = `http://127.0.0.1:${browserPort}`;
const originalFetch = globalThis.fetch;

let nextServer: ChildProcess | null = null;
let backendFixture: Server | null = null;

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await originalFetch(url);
      if (response.status < 500) return;
    } catch {
      // The isolated Next server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function category(id: string, name: string, parentId: string | null = null) {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    description: `${name} category`,
    icon: null,
    parentId,
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    _count: { children: 0, products: 0, attributes: 0 },
  };
}

async function installCategoryRoutes(page: Page, options: { delayCategories?: boolean } = {}) {
  const electronics = category("category-1", "Electronics");
  const phones = category("category-2", "Phones", electronics.id);

  await page.route("**/api/backend/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/backend", "");

    if (pathname === "/user/me") {
      return route.fulfill({
        json: {
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
        },
      });
    }

    if (pathname === "/admin/categories") {
      if (options.delayCategories) await new Promise((resolve) => setTimeout(resolve, 350));
      return route.fulfill({
        json: {
          data: {
            categories: [electronics, phones],
            tree: [{ ...electronics, _count: { children: 1, products: 0, attributes: 0 }, children: [{ ...phones, children: [] }] }],
          },
        },
      });
    }

    if (pathname === "/admin/categories/category-1/attributes") {
      return route.fulfill({ json: { data: { directAttributes: [], inheritedAttributes: [], allAttributes: [] } } });
    }

    if (pathname === "/auth/csrf-token") {
      return route.fulfill({ json: { data: { csrfToken: "fixture-csrf" } } });
    }

    return route.fulfill({ status: 404, json: { status: "fail", message: "Fixture route missing" } });
  });
}

async function openCategoryEditor(page: Page) {
  const trigger = page.getByTitle("Edit Category Details").first();
  await trigger.click({ force: true });
  const dialog = page.getByRole("dialog", { name: "Edit Category" });
  await expect(dialog).toBeVisible();
  return { dialog, trigger };
}

test.beforeAll(async () => {
  backendFixture = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${backendPort}`);
    response.setHeader("content-type", "application/json");
    if (url.pathname === "/api/v1/user/me") {
      response.end(JSON.stringify({
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
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ status: "fail", message: "Fixture route missing" }));
  });
  await new Promise<void>((resolve, reject) => {
    backendFixture!.once("error", reject);
    backendFixture!.listen(backendPort, "127.0.0.1", resolve);
  });

  nextServer = spawn(
    process.execPath,
    [path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(browserPort)],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        INTERNAL_BACKEND_URL: `http://127.0.0.1:${backendPort}/api/v1`,
        ADMIN_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
      },
      stdio: "ignore",
    },
  );
  await waitForServer(`${browserOrigin}/admin/login`);
});

test.afterAll(async () => {
  if (nextServer && !nextServer.killed) nextServer.kill();
  await new Promise<void>((resolve) => backendFixture?.close(() => resolve()) ?? resolve());
});

test.describe("Admin Categories Workspace Usability & A11y Contract (CT-F1-A)", () => {
  test("icon catalog provides vetted multi-department taxonomy with search keywords", () => {
    expect(CATEGORY_ICON_CATALOG.length).toBeGreaterThanOrEqual(25);

    const departments = new Set(CATEGORY_ICON_CATALOG.map((item) => item.department));
    expect(departments.size).toBeGreaterThanOrEqual(7);
    expect(departments).toContain("Electronics & Power");
    expect(departments).toContain("Fashion & Apparel");
    expect(departments).toContain("Home & Living");
    expect(departments).toContain("Groceries & Essentials");
    expect(departments).toContain("Health, Beauty & Fitness");
    expect(departments).toContain("Automotive & Hardware");
    expect(departments).toContain("Agriculture & Farming");

    for (const item of CATEGORY_ICON_CATALOG) {
      expect(item.value).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.department).toBeTruthy();
      expect(Array.isArray(item.keywords)).toBe(true);
      expect(item.keywords.length).toBeGreaterThan(0);
      expect(item.Icon).toBeTruthy();
      expect(["function", "object"]).toContain(typeof item.Icon);
    }
  });

  test("manage_categories permission gating strictly validates authenticated identity", () => {
    expect(adminIdentityHasPermission(null, "manage_categories")).toBe(false);
    expect(adminIdentityHasPermission(undefined, "manage_categories")).toBe(false);

    const unauthenticatedUser: AdminIdentity = {
      id: "test-admin-1",
      name: "Test Admin",
      email: "test@zogular.test",
      sessionStatus: "unauthorized",
      claims: {
        role: "ADMIN",
        permissions: ["manage_categories"],
        authStrength: "password",
        issuedAt: new Date().toISOString(),
      },
    };
    expect(adminIdentityHasPermission(unauthenticatedUser, "manage_categories")).toBe(false);

    const readOnlyUser: AdminIdentity = {
      ...unauthenticatedUser,
      sessionStatus: "authenticated",
      claims: {
        ...unauthenticatedUser.claims,
        permissions: ["access_admin_panel", "view_all_products"],
      },
    };
    expect(adminIdentityHasPermission(readOnlyUser, "manage_categories")).toBe(false);

    const categoryManager: AdminIdentity = {
      ...unauthenticatedUser,
      sessionStatus: "authenticated",
      claims: {
        ...unauthenticatedUser.claims,
        permissions: ["access_admin_panel", "manage_categories"],
      },
    };
    expect(adminIdentityHasPermission(categoryManager, "manage_categories")).toBe(true);
  });

  test("icon catalog search matches label, value, and keyword queries accurately", () => {
    const search = (query: string) => {
      const q = query.trim().toLowerCase();
      return CATEGORY_ICON_CATALOG.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.value.toLowerCase().includes(q) ||
          item.keywords.some((kw) => kw.toLowerCase().includes(q)),
      );
    };

    const phoneMatches = search("phone");
    expect(phoneMatches.some((i) => i.value === "smartphone")).toBe(true);

    const solarMatches = search("solar");
    expect(solarMatches.some((i) => i.value === "sun" || i.value === "battery")).toBe(true);

    const clothingMatches = search("clothes");
    expect(clothingMatches.some((i) => i.value === "shirt")).toBe(true);
  });

  test("shows truthful initial loading and supports nested editor and icon-picker keyboard flows", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await installCategoryRoutes(page, { delayCategories: true });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${browserOrigin}/admin/categories`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Loading hierarchy...")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Electronics" })).toBeVisible();

    const { dialog: editor } = await openCategoryEditor(page);
    expect(await editor.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    const iconTrigger = editor.getByRole("button", { name: /change icon/i });
    await iconTrigger.click();
    const picker = page.getByRole("dialog", { name: "Select Category Icon" });
    await expect(picker).toBeVisible();
    await expect(picker.getByPlaceholder(/search icons/i)).toBeFocused();

    await picker.getByPlaceholder(/search icons/i).fill("solar");
    await expect(picker.getByText("Solar Energy", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(iconTrigger).toBeFocused();

    await iconTrigger.click();
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: /Solar Energy/i }).click();
    await expect(picker).toBeHidden();
    await expect(editor.getByText("Solar Energy", { exact: true })).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });
    const cleanEditor = await openCategoryEditor(page);
    await expect(cleanEditor.dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cleanEditor.dialog).toHaveCount(0);
    await expect(cleanEditor.trigger).toBeFocused();
    await context.close();
  });

  test("category editor remains horizontally contained across approved widths", async ({ browser }) => {
    test.setTimeout(90_000);
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await installCategoryRoutes(page);
      await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);
      await page.goto(`${browserOrigin}/admin/categories`, { waitUntil: "networkidle" });
      const { dialog } = await openCategoryEditor(page);
      await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.keyboard.press("Escape");
      await context.close();
    }
  });
});
