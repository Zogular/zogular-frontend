import { ApiError } from "@/services/api";
import { ProductListContractError } from "@/services/products";

export function isDiscoveryListingFailure(error: unknown): error is ApiError | ProductListContractError {
  return error instanceof ApiError || error instanceof ProductListContractError;
}
