import { fetchCategoryTree } from "@/services/categories-api";
import { getPublicSearchPage } from "@/services/products";
import { publicLandingPaths, requestOrigin, safeSlug, searchLabel } from "@/lib/seo/public-search";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function GET(request: Request) {
  const origin = await requestOrigin();
  if (!origin || new URL(request.url).search) return new Response(null, { status: 404, headers });
  const entries = new Map<string, string>();
  function add(path: string, changed?: string | null) {
    if (entries.has(path) || entries.size >= 50000) throw new Error("Sitemap capacity or duplicate");
    // Accept only an actual, canonical backend timestamp. No build-time or request-time lastmod.
    const stamp = changed && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(changed) &&
      Number.isFinite(Date.parse(changed)) && new Date(changed).toISOString() === changed ? changed : "";
    entries.set(path, stamp);
  }
  try {
    const deadline = Date.now() + 30000;
    for (const path of publicLandingPaths) add(path);
    for (const category of await fetchCategoryTree()) {
      if (category.isActive === true && category.parentId === null && safeSlug(category.slug) && searchLabel(category.name))
        add("/category/" + category.slug);
    }
    const seen = new Set<string>();
    let total: number | undefined, pageSize: number | undefined;
    for (let page = 1; ; page++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("Catalog time budget exceeded");
      const part = await getPublicSearchPage(page, 100, Math.min(remaining, 5000));
      if (part.page !== page || part.limit > 100 || part.pages > 500 || part.total > 50000 ||
          (total !== undefined && (part.total !== total || part.limit !== pageSize)) ||
          part.rows.length !== Math.min(part.limit, part.total - (page - 1) * part.limit)) throw new Error("Unstable catalog");
      total = part.total; pageSize = part.limit;
      for (const row of part.rows) {
        if (!row.id || seen.has(row.id)) throw new Error("Missing or repeated product");
        seen.add(row.id);
        if (row.eligible && safeSlug(row.slug) && row.title && searchLabel(row.title)) add("/product/" + row.slug, row.updatedAt);
      }
      if (page >= part.pages) {
        if (seen.size !== total) throw new Error("Incomplete catalog");
        break;
      }
    }
    // Origin and path segments above contain no XML markup or entities.
    const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      Array.from(entries, ([path, date]) => "<url><loc>" + origin + path + "</loc>" +
        (date ? "<lastmod>" + date + "</lastmod>" : "") + "</url>").join("") + "</urlset>";
    if (Buffer.byteLength(xml) > 50 * 1024 * 1024) throw new Error("Sitemap byte limit exceeded");
    // Five minutes bounds discovery lag. No stale-on-error; only a complete public snapshot is shareable.
    return new Response(xml, { headers: { ...headers, "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, must-revalidate", Vary: "Host" } });
  } catch {
    return new Response(null, { status: 503, headers: { ...headers, "Retry-After": "60" } });
  }
}
