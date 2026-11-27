import { createServer, type Server } from "node:http";
import { basename } from "node:path";
import next from "next";
import { expect, test } from "@playwright/test";

// Opt-in: a private production build with synthetic origins. Never attach to an existing app.
const enabled = process.env.ZG_SEO_ISOLATED === "1";
const web = "http://127.0.0.1:44791", api = "http://127.0.0.1:44792/api/v1", site = "https://shop.example.com";
test.skip(!enabled, "Requires a fresh isolated production build and local Chrome.");
test.use({ channel: "chrome", serviceWorkers: "block", launchOptions: { args: ["--disable-background-networking",
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] } });
const item = { id: "desk", slug: "desk-1732185220123", title: "Oak desk", price: 200, stock: 2, status: "APPROVED",
  updatedAt: "2026-06-01T12:00:00.000Z", description: "Private contact: seller@example.com", images: [] };
const products = [item, { ...item, id: "draft", slug: "draft", status: "DRAFT" },
  { ...item, id: "chair", title: "Office chair", slug: "office-chair", updatedAt: "" }];
const category = { id: "office", name: "Office", slug: "office", parentId: null, isActive: true, sortOrder: 1, children: [] };
const publicInfo = [["/about", "About Zogular"], ["/help", "Help Center"], ["/privacy", "Privacy Policy"],
  ["/returns", "Returns Policy"], ["/terms", "Terms and Conditions"], ["/careers", "Careers at Zogular"],
  ["/new-arrivals", "New Arrivals in Zambia"], ["/track", "Order and Delivery Help"]] as const;
let fault = "", pageReads: number[] = [];
const listen = (s: Server, port: number) => new Promise<void>((ok, fail) => s.once("error", fail).listen(port, "127.0.0.1", ok));
const close = (s?: Server) => new Promise<void>((ok, fail) => {
  if (!s?.listening) return ok();
  s.close(e => e ? fail(e) : ok()); s.closeAllConnections();
});
let server: Server | undefined, upstream: Server | undefined, app: ReturnType<typeof next> | undefined;
test.beforeAll(async () => {
  if (!enabled) return;
  if (!basename(process.cwd()).startsWith("zg-seo-") || process.env.INTERNAL_BACKEND_URL !== api ||
      process.env.NEXT_PUBLIC_API_URL !== api || process.env.NEXT_PUBLIC_SITE_URL !== site ||
      process.env.NODE_ENV !== "production") throw Error("Not an isolated SEO fixture configuration");
  upstream = createServer((req, res) => {
    const url = new URL(req.url!, api);
    const reply = (data: unknown, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.method !== "GET") return reply({}, 405);
    if (url.pathname.endsWith("/categories")) return reply({ data: { categories: [category] } });
    if (url.pathname.endsWith("/products")) {
      const page = Number(url.searchParams.get("page") || 1), limit = Math.min(Number(url.searchParams.get("limit")), 2);
      pageReads.push(page);
      if (page === 2 && fault === "outage") return reply({}, 503);
      const effective = page === 2 && fault === "repeat" ? 1 : page;
      const rows = page === 2 && fault === "duplicate" ? [item] : page === 2 && fault === "short" ? [] :
        products.slice((effective - 1) * limit, effective * limit);
      return reply({ data: { products: rows },
        pagination: { page: effective, limit, total: products.length, pages: Math.ceil(products.length / limit) } });
    }
    if (url.pathname.endsWith("/" + item.slug)) return reply({ data: { product: item } });
    if (url.pathname.endsWith("/related") || url.pathname.endsWith("/new-arrivals")) return reply({ data: { products: [] } });
    return reply({}, 404);
  });
  await listen(upstream, 44792);
  app = next({ dev: false, dir: process.cwd(), hostname: "127.0.0.1", port: 44791 });
  await app.prepare();
  const handle = app.getRequestHandler();
  server = createServer((req, res) => {
    req.headers.host = req.headers["x-fixture-preview"] ? "preview.pages.dev" : "shop.example.com";
    void handle(req, res);
  });
  await listen(server, 44791);
});
test.afterAll(async () => {
  try { await close(server); } finally { try { await app?.close(); } finally { await close(upstream); } }
});

test("canonical discovery: real XML, complete pagination, rendered metadata, exclusions and failure responses", async ({ page, request, context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== web) return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: url.pathname.endsWith("/categories") ? { data: { categories: [category] } } : {} });
    return route.continue();
  });
  pageReads = [];
  const sitemap = await request.get(web + "/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("application/xml");
  expect(sitemap.headers()["cache-control"]).toContain("s-maxage=300");
  expect(pageReads).toEqual([1, 2]);
  const parsed = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return { root: doc.documentElement.namespaceURI, errors: doc.querySelectorAll("parsererror").length,
      urls: [...doc.querySelectorAll("loc")].map(n => n.textContent), dates: [...doc.querySelectorAll("lastmod")].map(n => n.textContent) };
  }, await sitemap.text());
  expect(parsed).toEqual({ root: "http://www.sitemaps.org/schemas/sitemap/0.9", errors: 0,
    urls: ["/", "/products", "/categories", "/sell", ...publicInfo.map(([p]) => p),
      "/category/office", "/product/" + item.slug, "/product/office-chair"].map(p => site + p),
    dates: [item.updatedAt] });
  for (fault of ["outage", "repeat", "duplicate", "short"]) {
    const unavailable = await request.get(web + "/sitemap.xml");
    expect(unavailable.status()).toBe(503); expect(await unavailable.text()).toBe("");
    expect(unavailable.headers()["cache-control"]).toContain("no-store");
  }
  fault = "";
  const preview = { headers: { "x-fixture-preview": "1" } };
  const blocked = await request.get(web + "/sitemap.xml", preview);
  expect(blocked.status()).toBe(404); expect(blocked.headers()["cache-control"]).toContain("no-store");
  expect(await (await request.get(web + "/robots.txt", preview)).text()).not.toContain("Sitemap:");
  const robots = await (await request.get(web + "/robots.txt")).text();
  expect(robots).toContain("Sitemap: " + site + "/sitemap.xml");
  // Evaluate this single wildcard-agent policy's prefix, wildcard and end-anchor directives.
  const rules = [...robots.matchAll(/^(Allow|Disallow): (\S+)/gm)].map(([, action, path]) => {
    const exact = path.endsWith("$");
    const pattern = (exact ? path.slice(0, -1) : path).split("*").map(s => s.replace(/[.?]/g, "\\$&")).join(".*");
    return { allow: action === "Allow", length: path.length, match: new RegExp("^" + pattern + (exact ? "$" : "")) };
  }).sort((a, b) => b.length - a.length || Number(b.allow) - Number(a.allow));
  for (const url of [...parsed.urls, site + "/images/discovery/home-editorial-mobile.webp", site + "/_next/image?url=x"]) {
    expect(rules.find(r => r.match.test(url!.slice(site.length)))?.allow).toBe(true);
  }
  for (const path of ["/products?page=2", "/category/office?sort=price", "/product/desk?ref=x", "/admin", "/auth/login", "/seller/orders", "/checkout", "/account", "/cart"]) {
    expect(rules.find(r => r.match.test(path))?.allow).toBe(false);
  }
  for (const [path, wrongHost] of [["/cart", false], ["/", true], ["/sell", true], ["/help", true]] as const) {
    const response = await request.get(web + path, { headers: {
      "User-Agent": "Twitterbot", ...(wrongHost ? { "x-fixture-preview": "1" } : {}) } });
    const excluded = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return [doc.head.querySelector("meta[name=robots]")?.getAttribute("content"), !!doc.head.querySelector("link[rel=canonical]"),
        !!doc.head.querySelector('meta[property^="og:"]')];
    }, await response.text());
    expect(excluded).toEqual(["noindex, nofollow", false, false]);
  }
  for (const [path, label] of [...publicInfo, ["/", "Online Shopping in Zambia"], ["/sell", "Sell Online in Zambia"],
    ["/products", "All Products in Zambia"], ["/categories", "All Shopping Categories in Zambia"], ["/category/office", "Office in Zambia"], ["/product/" + item.slug, "Oak desk"]]) {
    const response = await request.get(web + path, { headers: { "User-Agent": "Twitterbot" } });
    expect(response.status()).toBe(200);
    const metadata = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return { title: doc.title, canonical: doc.head.querySelector("link[rel=canonical]")?.getAttribute("href"),
        desc: doc.head.querySelector("meta[name=description]")?.getAttribute("content"),
        ogUrl: doc.head.querySelector('meta[property="og:url"]')?.getAttribute("content"),
        ogImage: doc.head.querySelector('meta[property="og:image"]')?.getAttribute("content"),
        robots: doc.head.querySelector("meta[name=robots]")?.getAttribute("content") };
    }, await response.text());
    expect(metadata.title).toBe(label + " | Zogular"); expect(metadata.canonical).toBe(site + path);
    expect(metadata.ogUrl).toBe(site + path);
    if (path === "/") {
      expect(metadata.ogImage).toBe(site + "/brand/zogular-wordmark-light.png");
      expect((await request.get(web + "/brand/zogular-wordmark-light.png")).headers()["content-type"]).toContain("image/png");
    }
    expect(metadata.desc).toBeTruthy(); expect(metadata.desc).not.toContain("@"); expect(metadata.robots).toBe("index, follow");
  }
  for (const path of ["/help?ref=private", "/products?sort=popular", "/categories?search=private", "/product/" + item.slug + "?ref=private", "/category/office?page=2"]) {
    await page.goto(web + path);
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", site + path.split("?")[0]);
  }
  await page.goto(web + "/categories"); await expect(page.getByRole("heading", { level: 1 })).toHaveText("All Categories");
  await page.getByRole("textbox").last().fill("not-an-office"); await expect(page.getByText("No matching categories")).toBeVisible();
});
