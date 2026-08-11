import type { Product } from "@/types/product";

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
};
