import { z } from "zod";
import {
  listingCategoryRemediationSchema,
  listingRevisionDecisionSchema,
  listingRevisionProjections as projections,
  listingRevisionQueueQuerySchema,
  listingRevisionReservationSchema,
  listingRevisionSubmissionSchema,
  type ListingCategoryRemediation,
  type ListingRevisionDecision,
  type ListingRevisionQueueQuery,
  type ListingRevisionReservation,
  type ListingRevisionSubmission,
} from "@/features/listing-revisions/types";
import { ApiError, apiClient } from "@/services/api";

const invalidResponse = () => new ApiError("The listing revision response could not be confirmed.", 502);
const id = z.uuid();
const successEnvelope = z.strictObject({ status: z.literal("success"), data: z.json() });

function input<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError("The listing revision request is invalid.", 400);
  return result.data;
}

function safeRequestError(error: unknown): ApiError {
  const status = error instanceof ApiError ? error.status : 503;
  switch (status) {
    case 400: return new ApiError("The listing revision request was not accepted.", status);
    case 401: return new ApiError("Sign in again to continue.", status);
    case 403: return new ApiError("You cannot perform this listing revision action.", status);
    case 404: return new ApiError("This listing revision action is not available.", status);
    case 409: return new ApiError("Refresh the listing revision before trying again.", status);
    case 408: return new ApiError("The listing revision request timed out.", status);
    default: return new ApiError("The listing revision request could not be completed.", status);
  }
}

// Both auth refresh and CSRF retry are disabled for writes. The caller owns any deliberate retry.
async function request<S extends z.ZodType>(
  path: string,
  projection: S,
  options: { signal?: AbortSignal; body?: object; method?: "PUT"; query?: ListingRevisionQueueQuery | { submissionKey: string } },
  matches?: (data: z.output<S>) => boolean,
): Promise<z.output<S>> {
  const { signal, body, query } = options;
  signal?.throwIfAborted();
  let response: unknown;
  try {
    response = await apiClient<unknown>(path, {
      signal,
      query,
      cache: "no-store",
      skipAuthRefresh: true,
      ...(body === undefined
        ? { method: "GET" }
        : { method: options.method ?? "POST", csrf: "header", noAutoReplay: true, redirect: "error", body: JSON.stringify(body) }),
    });
  } catch (error) {
    signal?.throwIfAborted();
    throw safeRequestError(error);
  }
  signal?.throwIfAborted();
  const envelope = successEnvelope.safeParse(response);
  if (!envelope.success) throw invalidResponse();
  const parsed = projection.safeParse(envelope.data.data);
  if (!parsed.success || (matches && !matches(parsed.data))) throw invalidResponse();
  return parsed.data;
}

const sellerPath = (productId: string) => `/vendor/products/${input(id, productId)}/listing-revisions`;
const adminPath = (productId: string, revisionId: string) =>
  `/admin/products/${input(id, productId)}/listing-revisions/${input(id, revisionId)}`;
const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const sellerListingRevisionsApi = {
  async outstandingAttempt(productId: string, signal?: AbortSignal) {
    const { attempt } = await request(`${sellerPath(productId)}/attempts`, projections.outstandingAttempt, { signal });
    return attempt;
  },
  async exactAttempt(productId: string, submissionKey: string, signal?: AbortSignal) {
    const key = input(id, submissionKey);
    const { attempt } = await request(`${sellerPath(productId)}/attempts`, projections.exactAttempt,
      { signal, query: { submissionKey: key } }, ({ attempt }) => sameId(attempt.submissionKey, key));
    return attempt;
  },
  async reserveAttempt(productId: string, reservation: ListingRevisionReservation, signal?: AbortSignal) {
    const body = input(listingRevisionReservationSchema, reservation);
    const { attempt } = await request(`${sellerPath(productId)}/attempts`, projections.reserveAttempt, { signal, body },
      ({ attempt }) => attempt.baseVersion === body.baseVersion);
    return attempt;
  },
  async settleAttempt(productId: string, submissionKey: string, signal?: AbortSignal) {
    const key = input(id, submissionKey);
    const { attempt } = await request(`${sellerPath(productId)}/attempts/${key}/settlement`,
      projections.settleAttempt, { signal, body: {}, method: "PUT" },
      ({ attempt }) => sameId(attempt.submissionKey, key));
    return attempt;
  },
  async history(productId: string, signal?: AbortSignal) {
    return request(sellerPath(productId), projections.sellerHistory, { signal }, ({ product, revisions }) =>
      sameId(product.id, productId) && revisions.every((revision) => sameId(revision.productId, productId)));
  },
  async submit(productId: string, submission: ListingRevisionSubmission, signal?: AbortSignal) {
    const body = input(listingRevisionSubmissionSchema, submission);
    return request(sellerPath(productId), projections.mutation, { signal, body }, ({ revision }) =>
      sameId(revision.productId, productId) && revision.baseVersion === body.baseVersion);
  },
  async withdraw(productId: string, revisionId: string, signal?: AbortSignal) {
    const path = `${sellerPath(productId)}/${input(id, revisionId)}/withdraw`;
    return request(path, projections.mutation, { signal, body: {} }, ({ revision }) =>
      sameId(revision.productId, productId) && sameId(revision.id, revisionId) && revision.status === "WITHDRAWN");
  },
  async remediateCategory(productId: string, remediation: ListingCategoryRemediation, signal?: AbortSignal) {
    const body = input(listingCategoryRemediationSchema, remediation);
    return request(`${sellerPath(productId)}/remediate-category`, projections.remediation, { signal, body },
      ({ product }) => sameId(product.id, productId));
  },
};

export const adminListingRevisionsApi = {
  async queue(query: ListingRevisionQueueQuery = {}, signal?: AbortSignal) {
    return request("/admin/products/listing-revisions", projections.adminQueue,
      { signal, query: input(listingRevisionQueueQuerySchema, query) });
  },
  async detail(productId: string, revisionId: string, signal?: AbortSignal) {
    return request(adminPath(productId, revisionId), projections.adminDetail, { signal }, ({ product, revision }) =>
      sameId(product.id, productId) && sameId(revision.productId, productId) && sameId(revision.id, revisionId));
  },
  async decide(productId: string, revisionId: string, decision: ListingRevisionDecision, signal?: AbortSignal) {
    const body = input(listingRevisionDecisionSchema, decision);
    return request(`${adminPath(productId, revisionId)}/decisions`, projections.mutation, { signal, body },
      ({ revision }) => sameId(revision.productId, productId) && sameId(revision.id, revisionId) &&
        revision.status === (body.decision === "approve" ? "APPROVED" : "NEEDS_CHANGES"));
  },
};
