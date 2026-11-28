import { expect, test } from "@playwright/test";
import { resetApiClientSecurityStateForTests } from "../src/services/api";
import { adminListingRevisionsApi as admin, sellerListingRevisionsApi as seller } from "../src/services/listing-revisions";

const productId = "e695f846-5d60-4374-9429-b2bc46b96287";
const revisionId = "bf1a1091-b208-4f4e-97e6-a2004a261cad";
const submissionKey = "8fe1899b-c325-4146-984a-05dfe827de47";
const createdAt = "2026-11-01T09:00:00.000Z";
const fields = { title: "Fixture Desk Lamp", description: "A bright lamp for a small writing desk.", price: 120, salePrice: null };
const product = { id: productId, listingVersion: 2, ...fields };
const revision = {
  id: revisionId, productId, baseVersion: 2, createdAt, decidedAt: null, sellerVisibleReason: null,
  status: "PENDING_REVIEW", payload: { ...fields, price: 130, schemaVersion: 1 },
};
const submission = { baseVersion: 2, submissionKey, changes: { price: 130 } };
const ok = (data: unknown, status = 200) => Response.json({ status: "success", data }, { status });
const originalFetch = globalThis.fetch;

// Exercise the shared transport without a real server or authenticated session.
function mockApi(respond: (url: URL, init?: RequestInit) => Response, requests?: string[]) {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests?.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    if (url.pathname.endsWith("/auth/csrf-token")) return Response.json({ csrfToken: "fixture-csrf" });
    calls.push({ url, init });
    return respond(url, init);
  };
  return calls;
}

const attemptsPath = `/vendor/products/${productId}/listing-revisions/attempts`;
const openAttempt = { submissionKey, baseVersion: 2, status: "OPEN" };
const settledAttempt = { ...openAttempt, status: "PENDING_REVIEW", revisionId };

test.beforeEach(resetApiClientSecurityStateForTests);
test.afterEach(() => { globalThis.fetch = originalFetch; });

test("reads seller history, admin detail and the bounded admin queue", async () => {
  const calls = mockApi((url) => {
    if (url.pathname.includes("/vendor/")) return ok({ product, revisions: [revision] });
    if (url.pathname.endsWith("/products/listing-revisions")) {
      return ok({ items: [{
        id: revisionId, productId, createdAt, baseVersion: 2, status: "PENDING_REVIEW",
        product: { title: product.title, listingVersion: 2 },
      }], nextCursor: null });
    }
    return ok({ product, revision });
  });
  await expect(seller.history(productId)).resolves.toEqual({ product, revisions: [revision] });
  await expect(admin.detail(productId, revisionId)).resolves.toEqual({ product, revision });
  await expect(admin.queue({ cursor: revisionId, limit: 5 })).resolves.toMatchObject({ nextCursor: null });
  expect(calls.map(({ init }) => [init?.method, init?.cache])).toEqual(Array(3).fill(["GET", "no-store"]));
  expect(calls[2].url.searchParams.toString()).toBe(`cursor=${revisionId}&limit=5`);
});

test("uses only the four A5 POST routes, with header CSRF and explicit remediation", async () => {
  const calls = mockApi((url) => {
    if (url.pathname.endsWith("/withdraw")) return ok({ revision: { ...revision, status: "WITHDRAWN", decidedAt: createdAt } });
    if (url.pathname.endsWith("/decisions")) return ok({
      revision: { ...revision, status: "NEEDS_CHANGES", sellerVisibleReason: "Update the listing.", decidedAt: createdAt },
    });
    if (url.pathname.endsWith("/remediate-category")) return ok({ product: { ...product, status: "DRAFT" } });
    return ok({ revision }, 201);
  });
  await seller.submit(productId, submission);
  await seller.withdraw(productId, revisionId);
  await seller.remediateCategory(productId, { baseVersion: 2, confirmTakeOffline: true });
  await admin.decide(productId, revisionId, { decision: "needs_changes", reason: " Update the listing. " });
  expect(calls.map(({ url }) => url.pathname.split("/api/v1").at(-1))).toEqual([
    expect.stringMatching(new RegExp(`/vendor/products/${productId}/listing-revisions$`)),
    expect.stringMatching(new RegExp(`/vendor/products/${productId}/listing-revisions/${revisionId}/withdraw$`)),
    expect.stringMatching(new RegExp(`/vendor/products/${productId}/listing-revisions/remediate-category$`)),
    expect.stringMatching(new RegExp(`/admin/products/${productId}/listing-revisions/${revisionId}/decisions$`)),
  ]);
  expect(calls.map(({ init }) => [init?.method, new Headers(init?.headers).get("X-CSRF-Token")]))
    .toEqual(Array(4).fill(["POST", "fixture-csrf"]));
  expect(calls.map(({ init }) => JSON.parse(String(init?.body)))).toEqual([
    submission, {}, { baseVersion: 2, confirmTakeOffline: true }, { decision: "needs_changes", reason: "Update the listing." },
  ]);
});

test("accepts a previously decided submission replay but rejects drift and invalid input", async () => {
  const approved = { ...revision, status: "APPROVED", decidedAt: createdAt };
  const calls = mockApi(() => ok({ revision: approved }));
  await expect(seller.submit(productId, submission)).resolves.toEqual({ revision: approved });
  await expect(seller.withdraw(productId, revisionId)).rejects.toMatchObject({ status: 502 });
  await expect(seller.submit(productId, { ...submission, changes: {} })).rejects.toMatchObject({ status: 400 });
  await expect(admin.queue({ limit: 51 })).rejects.toMatchObject({ status: 400 });
  expect(calls).toHaveLength(2);

  for (const bad of [
    { ...revision, submittedByUserId: productId },
    { ...revision, payload: { ...revision.payload, schemaVersion: 2 } },
    { ...revision, productId: submissionKey },
  ]) {
    mockApi(() => ok({ product, revision: bad }));
    await expect(admin.detail(productId, revisionId)).rejects.toMatchObject({ status: 502, details: undefined });
  }
});

for (const status of [401, 403, 404, 409, 500]) {
  test(`sanitizes HTTP ${status} and does not refresh, retry or fall back`, async () => {
    const calls = mockApi(() => Response.json({ message: "csrf internal-only", stack: "internal-only" }, { status }));
    const failure = await seller.submit(productId, submission).catch((error: unknown) => error);
    expect(failure).toMatchObject({ status, details: undefined });
    expect(String(failure)).not.toContain("internal-only");
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toMatch(/\/vendor\/products\/[^/]+\/listing-revisions$/);
  });
}

test("reads an absent or OPEN outstanding attempt with no-store and no exact-key query", async () => {
  let attempt: typeof openAttempt | null = null;
  const requests: string[] = [];
  const calls = mockApi(() => ok({ attempt }), requests);
  await expect(seller.outstandingAttempt(productId)).resolves.toBeNull();
  attempt = openAttempt;
  await expect(seller.outstandingAttempt(productId)).resolves.toEqual(openAttempt);
  expect(requests).toEqual(Array(2).fill(`GET /api/v1${attemptsPath}`));
  for (const { init } of calls) {
    expect(init).toMatchObject({ cache: "no-store" });
    expect(init?.body).toBeUndefined();
  }
});

test("looks up the exact UUID query and rejects a mismatched returned attempt key", async () => {
  const key = submissionKey.toUpperCase();
  let attempt = settledAttempt;
  const requests: string[] = [];
  const calls = mockApi(() => ok({ attempt }), requests);
  await expect(seller.exactAttempt(productId, key)).resolves.toEqual(settledAttempt);
  attempt = { ...settledAttempt, submissionKey: revisionId };
  await expect(seller.exactAttempt(productId, key)).rejects.toMatchObject({ status: 502, details: undefined });
  await expect(seller.exactAttempt(productId, `${key}&submissionKey=${revisionId}`))
    .rejects.toMatchObject({ status: 400 });
  expect(requests).toEqual(Array(2).fill(`GET /api/v1${attemptsPath}?${new URLSearchParams({ submissionKey: key })}`));
  for (const { init } of calls) expect(init?.cache).toBe("no-store");
});

test("reserves with changes and base only and rejects malformed or mismatched reservations", async () => {
  const reservation = { changes: { price: 130 }, baseVersion: 2 };
  let attempt = openAttempt;
  const requests: string[] = [];
  const calls = mockApi(() => ok({ attempt }, 201), requests);
  await expect(seller.reserveAttempt(productId, reservation)).resolves.toEqual(openAttempt);
  attempt = { ...openAttempt, submissionKey: "invalid" };
  await expect(seller.reserveAttempt(productId, reservation)).rejects.toMatchObject({ status: 502 });
  attempt = { ...openAttempt, baseVersion: 3 };
  await expect(seller.reserveAttempt(productId, reservation)).rejects.toMatchObject({ status: 502 });
  await expect(seller.reserveAttempt(productId, submission)).rejects.toMatchObject({ status: 400 });
  expect(requests).toEqual(["GET /api/v1/auth/csrf-token", ...Array(3).fill(`POST /api/v1${attemptsPath}`)]);
  for (const { init } of calls) {
    expect(JSON.parse(String(init?.body))).toEqual(reservation);
    expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("fixture-csrf");
  }
});

test("settles the exact attempt by PUT with CSRF and validates the final receipt", async () => {
  const path = `${attemptsPath}/${submissionKey}/settlement`;
  let attempt: unknown = settledAttempt;
  const requests: string[] = [];
  const calls = mockApi(() => ok({ attempt }), requests);
  await expect(seller.settleAttempt(productId, submissionKey)).resolves.toEqual(settledAttempt);
  attempt = { ...openAttempt, status: "RETIRED" };
  await expect(seller.settleAttempt(productId, submissionKey)).resolves.toEqual(attempt);
  for (const bad of [
    openAttempt,
    { ...settledAttempt, submissionKey: revisionId },
    { ...openAttempt, status: "PENDING_REVIEW" },
  ]) {
    attempt = bad;
    await expect(seller.settleAttempt(productId, submissionKey)).rejects.toMatchObject({ status: 502, details: undefined });
  }
  expect(requests).toEqual(["GET /api/v1/auth/csrf-token", ...Array(5).fill(`PUT /api/v1${path}`)]);
  for (const { init } of calls) {
    expect(JSON.parse(String(init?.body))).toEqual({});
    expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("fixture-csrf");
  }
});

for (const status of [401, 403, 409, 500, "transport"] as const) {
  test(`settlement ${status} sanitizes the failure without refresh or retry`, async () => {
    const requests: string[] = [];
    mockApi(() => {
      if (status === "transport") throw new TypeError("internal-only transport diagnostic");
      return Response.json({ message: "csrf internal-only", stack: "internal-only" }, { status });
    }, requests);
    const failure = await seller.settleAttempt(productId, submissionKey).catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: status === "transport" ? 503 : status, details: undefined });
    expect(String(failure)).not.toContain("internal-only");
    expect(requests).toEqual(["GET /api/v1/auth/csrf-token", `PUT /api/v1${attemptsPath}/${submissionKey}/settlement`]);
  });
}
