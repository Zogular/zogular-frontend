import type { Metadata } from "next";
import { headers } from "next/headers";
import { BRAND, BRAND_SITE_URL } from "@/config/brand";

type Query = Record<string, string | string[] | undefined>;
export type SearchProps = { searchParams: Promise<Query> };
export const unlisted = { robots: { index: false, follow: false } } satisfies Metadata;
export const publicLandingPaths = ["/", "/products", "/categories", "/sell", "/about", "/help", "/privacy",
  "/returns", "/terms", "/careers", "/new-arrivals", "/track"] as const;

// Both explicit settings and the actual Host must agree. Never derive a canonical from a proxy header.
export function canonicalOrigin(site: string | undefined, domain: string | undefined, host: string | null,
  mode: string | undefined, deployment: string | undefined): string | null {
  if (mode !== "production" || (deployment !== undefined && deployment !== "production") || !site || !domain) return null;
  const name = domain.toLowerCase();
  if (name.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(name) ||
      /(?:^|\.)(?:workers\.dev|pages\.dev|vercel\.app|localhost|local|internal|test|invalid)$/.test(name)) return null;
  const origin = "https://" + name;
  return (site === origin || site === origin + "/") && host?.toLowerCase() === name ? origin : null;
}

export async function requestOrigin() {
  return canonicalOrigin(BRAND_SITE_URL, process.env.NEXT_PUBLIC_PUBLIC_DOMAIN, (await headers()).get("host"),
    process.env.NODE_ENV, process.env.VERCEL_ENV);
}

// Do not promote contact details, URLs, markup or arbitrary seller descriptions into search previews.
const contact = /@|(?:https?:|www\.|[a-z0-9-]+\.[a-z]{2,}\b)|(?:\d[\s().+_-]*){7}|[<>\p{Cc}\p{Cf}]/iu;
export function safeSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
export function searchLabel(value: string) {
  return value.length <= 110 && /^[\p{L}\p{N} &'()+,.:/-]+$/u.test(value) && !contact.test(value) ? value.trim() : "";
}

export async function publicMetadata(path: string, label: string, description: string, query: Query = {}): Promise<Metadata> {
  const origin = await requestOrigin();
  const canonical = origin ? origin + path : undefined;
  const title = label + " | " + BRAND.name;
  return { title, description, alternates: canonical ? { canonical } : undefined,
    robots: { index: Boolean(origin) && Object.keys(query).length === 0, follow: Boolean(origin) },
    openGraph: canonical && !Object.keys(query).length ? {
      title, description, siteName: BRAND.name, url: canonical,
      ...(path === "/" && { images: [{ url: origin + BRAND.assets.wordmarkLight, width: 1341, height: 754, alt: BRAND.name }] }),
    } : null };
}
