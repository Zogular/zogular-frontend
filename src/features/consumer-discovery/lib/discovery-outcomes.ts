import type {
  DiscoveryCollectionClassification,
  DiscoveryCollectionFailure,
  DiscoveryCollectionOutcome,
} from "@/features/consumer-discovery/types/discovery.types";
import type { Product } from "@/types/product";

export function getUniqueDiscoveryProducts(products: readonly Product[]): readonly Product[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    const identity = `${typeof product.id}:${String(product.id)}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function createDiscoveryFailure<TError extends Error>(
  error: TError,
  retry: () => void | Promise<void>,
): DiscoveryCollectionFailure<TError> {
  return { status: "failure", products: [], error, retry };
}

export function classifyDiscoveryCollection<TError extends Error = Error>({
  products,
  error,
  retry,
  hasActiveQuery = false,
  approvedPublicProductCount,
}: DiscoveryCollectionClassification<TError>): DiscoveryCollectionOutcome<TError> {
  if (error) {
    if (!retry) {
      throw new TypeError("A failed discovery collection requires a retry boundary.");
    }

    return createDiscoveryFailure(error, retry);
  }

  if (products.length > 0) {
    return { status: "success", products: getUniqueDiscoveryProducts(products) };
  }

  if (approvedPublicProductCount === 0) {
    return { status: "true-empty", products: [] };
  }

  if (approvedPublicProductCount !== undefined && approvedPublicProductCount > 0) {
    return { status: "filtered-zero", products: [] };
  }

  return hasActiveQuery
    ? { status: "filtered-zero", products: [] }
    : { status: "true-empty", products: [] };
}
