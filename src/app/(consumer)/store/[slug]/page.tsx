import { notFound, redirect } from "next/navigation";
import { PublicStoreListing } from "@/features/consumer-discovery/listing/PublicStoreListing";
import { getPublicStorePage, parsePublicStoreRoute, publicStoreHref } from "@/services/public-store";

export const dynamic = "force-dynamic";

export default async function StorePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const route = parsePublicStoreRoute(slug, query.page);
  if (!route) notFound();

  const result = await getPublicStorePage(route.slug, route.page);
  if (result.kind === "not-found") notFound();
  const basePath = publicStoreHref(route.slug, 1);
  if (result.kind === "unavailable") return <PublicStoreListing basePath={basePath} page={route.page} />;

  const lastPage = Math.max(1, result.data.pagination.pages);
  const page = Math.min(route.page, lastPage);
  if (slug !== route.slug || page !== route.page || query.page === "1") {
    redirect(publicStoreHref(route.slug, page));
  }
  return <PublicStoreListing basePath={basePath} page={page} data={result.data} />;
}
