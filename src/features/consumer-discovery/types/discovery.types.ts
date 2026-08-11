import type { Product } from "@/types/product";

export type DiscoverySort = "newest" | "price_asc" | "price_desc" | "popular";

export type DiscoveryQueryState = Readonly<{
  page: number;
  sort: DiscoverySort;
  categorySlug?: string;
  subcategorySlug?: string;
  search?: string;
}>;

export type DiscoveryQueryPatch = Partial<{
  page: number | null;
  sort: DiscoverySort | null;
  categorySlug: string | null;
  subcategorySlug: string | null;
  search: string | null;
}>;

export type DiscoveryQueryInput =
  | URLSearchParams
  | { getAll(name: string): string[] }
  | Record<string, string | string[] | null | undefined>;

export type DiscoveryQueryOptions = {
  allowPopular?: boolean;
  maxPage?: number;
};

export type DiscoveryCollectionSuccess = {
  status: "success";
  products: readonly Product[];
};
export type DiscoveryCollectionTrueEmpty = {
  status: "true-empty";
  products: readonly [];
};

export type DiscoveryCollectionFilteredZero = {
  status: "filtered-zero";
  products: readonly [];
};

export type DiscoveryCollectionFailure<TError extends Error = Error> = {
  status: "failure";
  products: readonly [];
  error: TError;
  retry: () => void | Promise<void>;
};

export type DiscoveryCollectionOutcome<TError extends Error = Error> =
  | DiscoveryCollectionSuccess
  | DiscoveryCollectionTrueEmpty
  | DiscoveryCollectionFilteredZero
  | DiscoveryCollectionFailure<TError>;

export type DiscoveryCollectionUnavailable<TError extends Error = Error> = Exclude<
  DiscoveryCollectionOutcome<TError>,
  DiscoveryCollectionSuccess
>;

export type DiscoveryCollectionClassification<TError extends Error = Error> = {
  products: readonly Product[];
  error?: TError;
  retry?: () => void | Promise<void>;
  hasActiveQuery?: boolean;
  approvedPublicProductCount?: number;
};
