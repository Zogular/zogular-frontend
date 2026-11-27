import { z } from "zod";
import { normalizeBackendProduct } from "@/services/products";
import type { Product } from "@/types/product";

const storeKey = z.uuidv4().transform((value) => value.toLowerCase());
export const PUBLIC_STORE_MAX_PAGE = 1000;
const pageLimit = 20;
const pageNumber = z.string().regex(/^[1-9]\d{0,3}$/).transform(Number).pipe(z.int().max(PUBLIC_STORE_MAX_PAGE));
const text = z.string().nullable();
const dimension = z.number().nullable();
const segment = z.string().min(1).regex(/^[^\s/%?#\\]+$/).refine((value) => value !== "." && value !== "..");
function isSupportedStoreImage(value: string): boolean {
  if (/^\/(?![\/\\])[^\\\s]*$/.test(value)) return true;
  try {
    const url = new URL(value);
    // ProductCard uses the host allowlist in next.config.ts.
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "res.cloudinary.com" || url.hostname === "images.unsplash.com");
  } catch {
    return false;
  }
}

// Validate the canonical public serializer shape before passing data to the shared card normalizer.
const publicProduct = z.strictObject({
  id: z.string().trim().min(1),
  slug: segment,
  title: z.string().trim().min(1),
  description: z.string(),
  price: z.number().positive(),
  salePrice: z.number().nullable(),
  images: z.array(z.strictObject({
    url: z.string(), alt: text, isPrimary: z.boolean(), sortOrder: z.number(),
    linkedVariantValue: text, width: dimension, height: dimension,
  })),
  condition: z.string(),
  category: z.string(),
  categoryRef: z.strictObject({ name: text, slug: text }).nullable(),
  categorySlug: text, subcategorySlug: text, location: text, sku: text,
  stock: z.int32().nonnegative().nullable(),
  brand: text, model: text, ram: text, storage: text, size: text, color: text,
  isSold: z.literal(false),
  user: z.strictObject({ id: z.string().min(1) }),
  reviews: z.array(z.strictObject({
    rating: z.number().nullable(), comment: text, createdAt: z.iso.datetime(),
    user: z.strictObject({ firstName: text, lastName: text }),
  })),
  attributeValues: z.array(z.strictObject({
    value: text, attribute: z.strictObject({ name: text }).nullable(),
  })),
});

const storeEnvelope = z.strictObject({
  status: z.literal("success"),
  store: z.strictObject({ slug: z.uuidv4(), name: z.string().trim().min(3) }),
  results: z.int().nonnegative().max(pageLimit),
  pagination: z.strictObject({
    page: z.int().min(1).max(PUBLIC_STORE_MAX_PAGE),
    limit: z.literal(pageLimit),
    total: z.int().nonnegative(),
    pages: z.int().nonnegative(),
  }),
  data: z.strictObject({ products: z.array(publicProduct).max(pageLimit) }),
});

export function parsePublicStoreRoute(slug: string, page: string | string[] | undefined) {
  const key = storeKey.safeParse(slug);
  const offsetPage = pageNumber.safeParse(page ?? "1");
  return key.success && offsetPage.success ? { slug: key.data, page: offsetPage.data } : null;
}

export function publicStoreHref(slug: string, page: number) {
  return `/store/${slug}${page === 1 ? "" : `?page=${page}`}`;
}

export type PublicStorePage = {
  store: { slug: string; name: string };
  products: Product[];
  pagination: z.output<typeof storeEnvelope>["pagination"];
};

type StoreOutcome = { kind: "ready"; data: PublicStorePage } | { kind: "not-found" } | { kind: "unavailable" };

export async function getPublicStorePage(slug: string, page: number): Promise<StoreOutcome> {
  try {
    const base = process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
    const url = new URL(`${base.replace(/\/$/, "")}/products/by-store/${slug}`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(pageLimit));
    // Server-side public read: do not forward identity or follow a redirect to a different endpoint.
    const response = await fetch(url, {
      cache: "no-store", credentials: "omit", redirect: "error",
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000),
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      return { kind: response.status === 404 ? "not-found" : "unavailable" };
    }
    const { store, results, pagination, data } = storeEnvelope.parse(await response.json());
    const { products } = data;
    const { total, pages, limit } = pagination;
    const expectedRows = Math.min(limit, Math.max(0, total - (page - 1) * limit));
    if (store.slug !== slug || pagination.page !== page || pages !== Math.ceil(total / limit) ||
        results !== products.length || results !== expectedRows ||
        new Set(products.map(({ id }) => id)).size !== results ||
        new Set(products.map(({ slug: productSlug }) => productSlug)).size !== results) {
      return { kind: "unavailable" };
    }
    return { kind: "ready", data: {
      store, pagination,
      products: products.map((product) => normalizeBackendProduct({
        ...product,
        // Media that the public API can serialize is not necessarily renderable by the shared card.
        images: product.images.filter(({ url }) => isSupportedStoreImage(url)),
        user: undefined, reviews: product.reviews.map(({ rating }) => ({ rating })),
      })),
    } };
  } catch {
    return { kind: "unavailable" };
  }
}
