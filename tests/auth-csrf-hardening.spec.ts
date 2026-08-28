import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { POST as proxyPost } from "../src/app/api/backend/[...path]/route";
import { login } from "../src/services/auth";
import {
  apiClient,
  ApiError,
  resetApiClientSecurityStateForTests,
} from "../src/services/api";

type FetchCall = {
  url: string;
  method: string;
  headers: Headers;
  body?: BodyInit | null;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function installFetchMock(handler: (url: URL, init: RequestInit) => Promise<Response> | Response) {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const rawUrl = request?.url ?? String(input);
    const url = new URL(rawUrl);
    const headers = new Headers(request?.headers);
    if (init?.headers) {
      for (const [key, value] of new Headers(init.headers)) headers.set(key, value);
    }
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    calls.push({ url: url.toString(), method, headers, body: init?.body ?? null });
    return handler(url, init ?? {});
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function authSuccess(email = "buyer@example.test") {
  return {
    status: "success",
    data: {
      user: {
        id: "buyer-1",
        firstName: "Buyer",
        lastName: "One",
        email,
        role: "CUSTOMER",
      },
    },
  };
}

test.beforeEach(() => {
  resetApiClientSecurityStateForTests();
});

test("login explicitly obtains and sends CSRF before the backend login request", async () => {
  const fetchMock = installFetchMock((url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return jsonResponse({ status: "success", data: { csrfToken: "login-csrf" } });
    }
    if (url.pathname.endsWith("/auth/login")) {
      expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("login-csrf");
      return jsonResponse(authSuccess());
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    await expect(login({ email: "buyer@example.test", password: "Password123!" })).resolves.toMatchObject({
      user: { email: "buyer@example.test" },
    });
    expect(fetchMock.calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      "GET /api/v1/auth/csrf-token",
      "POST /api/v1/auth/login",
    ]);
  } finally {
    fetchMock.restore();
  }
});

test("same-tab CSRF bootstrap dedupes concurrent state-changing requests", async () => {
  const csrf = deferred<Response>();
  let csrfRequests = 0;
  let mutationRequests = 0;
  const fetchMock = installFetchMock((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      csrfRequests += 1;
      return csrf.promise;
    }
    if (url.pathname.endsWith("/cart/items")) {
      mutationRequests += 1;
      return jsonResponse({ status: "success", data: { ok: true } });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const first = apiClient("/cart/items", { method: "POST", csrf: true, body: JSON.stringify({ productId: "p1" }) });
    const second = apiClient("/cart/items", { method: "POST", csrf: true, body: JSON.stringify({ productId: "p2" }) });
    await Promise.resolve();
    expect(csrfRequests).toBe(1);
    csrf.resolve(jsonResponse({ status: "success", data: { csrfToken: "shared-csrf" } }));
    await Promise.all([first, second]);
    expect(csrfRequests).toBe(1);
    expect(mutationRequests).toBe(2);
    expect(fetchMock.calls.filter((call) => new URL(call.url).pathname.endsWith("/cart/items")).every((call) => call.headers.get("X-CSRF-Token") === "shared-csrf")).toBe(true);
  } finally {
    fetchMock.restore();
  }
});

test("rejected CSRF bootstrap clears the cache so the next request can succeed", async () => {
  let csrfRequests = 0;
  let mutationRequests = 0;
  const fetchMock = installFetchMock((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      csrfRequests += 1;
      if (csrfRequests === 1) throw new Error("SECRET transient network failure");
      return jsonResponse({ status: "success", data: { csrfToken: "fresh-csrf" } });
    }
    if (url.pathname.endsWith("/wishlist/items")) {
      mutationRequests += 1;
      return jsonResponse({ status: "success", data: { item: { id: "w1" } } });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    await expect(apiClient("/wishlist/items", { method: "POST", csrf: true, body: JSON.stringify({ productId: "p1" }) })).rejects.toBeInstanceOf(ApiError);
    await expect(apiClient("/wishlist/items", { method: "POST", csrf: true, body: JSON.stringify({ productId: "p1" }) })).resolves.toMatchObject({ status: "success" });
    expect(csrfRequests).toBe(2);
    expect(mutationRequests).toBe(1);
  } finally {
    fetchMock.restore();
  }
});

test("malformed and non-OK CSRF bootstraps fail safely and do not poison later requests", async () => {
  let csrfRequests = 0;
  const fetchMock = installFetchMock((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      csrfRequests += 1;
      if (csrfRequests === 1) return jsonResponse({ status: "success", data: {} });
      if (csrfRequests === 2) return jsonResponse({ status: "fail", message: "SECRET csrf backend detail" }, 503);
      return jsonResponse({ status: "success", data: { csrfToken: "recovered-csrf" } });
    }
    if (url.pathname.endsWith("/auth/resend-verification")) {
      return jsonResponse({ status: "success", message: "Verification email sent." });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    await expect(apiClient("/auth/resend-verification", { method: "POST", authMode: "omit", csrf: true, body: "{}" })).rejects.not.toThrow(/SECRET/i);
    await expect(apiClient("/auth/resend-verification", { method: "POST", authMode: "omit", csrf: true, body: "{}" })).rejects.not.toThrow(/SECRET/i);
    await expect(apiClient("/auth/resend-verification", { method: "POST", authMode: "omit", csrf: true, body: "{}" })).resolves.toMatchObject({ status: "success" });
    expect(csrfRequests).toBe(3);
  } finally {
    fetchMock.restore();
  }
});

test("stale CSRF 403 performs one bounded token refresh and retry", async () => {
  const tokens = ["stale-csrf", "fresh-csrf"];
  const postedTokens: string[] = [];
  const fetchMock = installFetchMock((url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return jsonResponse({ status: "success", data: { csrfToken: tokens.shift() } });
    }
    if (url.pathname.endsWith("/cart/items")) {
      const token = new Headers(init.headers).get("X-CSRF-Token") ?? "";
      postedTokens.push(token);
      if (token === "stale-csrf") {
        return jsonResponse({ status: "fail", message: "Invalid CSRF token. Please refresh the page and try again." }, 403);
      }
      return jsonResponse({ status: "success", data: { ok: true } });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    await expect(apiClient("/cart/items", { method: "POST", csrf: true, body: "{}" })).resolves.toMatchObject({ status: "success" });
    expect(postedTokens).toEqual(["stale-csrf", "fresh-csrf"]);
  } finally {
    fetchMock.restore();
  }
});

test("proxy uses incoming CSRF pair without duplicate bootstrap and forwards the mutation", async () => {
  const fetchMock = installFetchMock((url, init) => {
    expect(url.pathname).toBe("/api/v1/cart/items");
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe("incoming-csrf");
    expect(headers.get("Cookie")).toContain("_csrf=incoming-csrf");
    return jsonResponse({ status: "success", data: { ok: true } });
  });

  try {
    const response = await proxyPost(
      new Request("http://frontend.test/api/backend/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "_csrf=incoming-csrf; refreshToken=session",
          "X-CSRF-Token": "incoming-csrf",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["cart", "items"] }) },
    );
    expect(response.status).toBe(200);
    expect(fetchMock.calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual(["POST /api/v1/cart/items"]);
  } finally {
    fetchMock.restore();
  }
});

test("proxy bootstraps anonymous CSRF and fails closed when CSRF cannot be prepared", async () => {
  for (const mode of ["success", "non-ok", "malformed", "network"] as const) {
    let forwarded = false;
    const fetchMock = installFetchMock((url, init) => {
      if (url.pathname.endsWith("/auth/csrf-token")) {
        if (mode === "non-ok") return jsonResponse({ status: "fail", message: "SECRET csrf failure" }, 503);
        if (mode === "malformed") return jsonResponse({ status: "success", data: {} });
        if (mode === "network") throw new Error("SECRET network failure");
        return jsonResponse(
          { status: "success", data: { csrfToken: "anonymous-csrf" } },
          200,
          { "Set-Cookie": "_csrf=anonymous-csrf; Path=/; HttpOnly; SameSite=Lax" },
        );
      }
      if (url.pathname.endsWith("/auth/register")) {
        forwarded = true;
        const headers = new Headers(init.headers);
        expect(headers.get("X-CSRF-Token")).toBe("anonymous-csrf");
        expect(headers.get("Cookie")).toContain("_csrf=anonymous-csrf");
        return jsonResponse({ status: "success", message: "Account created." }, 201);
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    });

    try {
      const response = await proxyPost(
        new Request("http://frontend.test/api/backend/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
        { params: Promise.resolve({ path: ["auth", "register"] }) },
      );
      if (mode === "success") {
        expect(response.status).toBe(201);
        expect(forwarded).toBe(true);
      } else {
        expect(response.status).toBe(503);
        expect(forwarded).toBe(false);
        await expect(response.json()).resolves.toEqual({
          status: "fail",
          message: "We could not prepare this secure request. Please try again.",
        });
      }
    } finally {
      fetchMock.restore();
    }
  }
});

test("auth CSRF hardening stays in the approved files and direct-backend mode is covered", () => {
  const authSource = fs.readFileSync(path.resolve("src/services/auth.ts"), "utf8");
  const apiSource = fs.readFileSync(path.resolve("src/services/api.ts"), "utf8");
  const proxySource = fs.readFileSync(path.resolve("src/app/api/backend/[...path]/route.ts"), "utf8");

  expect(authSource).toContain('csrf: true,\n    body: JSON.stringify(input)');
  expect(apiSource).toContain("csrfTokenPromise = null;");
  expect(proxySource).toContain("CSRF_PREPARE_ERROR_RESPONSE");
  expect(proxySource).toContain("hasUsableIncomingCsrf(request, requestCookie)");
  expect(proxySource).toContain("return NextResponse.json(CSRF_PREPARE_ERROR_RESPONSE, { status: 503 });");
});
