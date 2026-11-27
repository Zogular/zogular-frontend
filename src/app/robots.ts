import type { MetadataRoute } from "next";
import { publicLandingPaths, requestOrigin } from "@/lib/seo/public-search";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await requestOrigin();
  // Crawl directives do not protect private resources or remove already indexed URLs.
  return origin ? {
    sitemap: origin + "/sitemap.xml",
    rules: { userAgent: "*", disallow: ["/", "/category/*?", "/product/*?"],
      allow: [...publicLandingPaths.map(path => path + "$"), "/category/", "/product/", "/sitemap.xml$", "/_next/",
        "/brand/", "/images/", "/file.svg$", "/icon.png$", "/apple-icon.png$", "/manifest.webmanifest$"] },
  } : { rules: { userAgent: "*", disallow: "/" } };
}
