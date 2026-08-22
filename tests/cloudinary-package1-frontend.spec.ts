import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  isSupportedCloudinaryDeliveryType,
  uploadFileToCloudinary,
  type SignedCloudinaryUploadConfig,
} from "../src/services/cloudinary-direct-upload";
import {
  getSellerDocumentAccess,
  getSellerDocumentAccessMessage,
  normalizeSellerDocumentAccess,
  SellerDocumentAccessError,
  uploadSellerDocument,
} from "../src/services/seller-document-uploads";
import { getAdminSellerDocumentAccess } from "../src/services/admin/vendor-applications";
import {
  removeTemporarySellerProductImageUpload,
  uploadSellerProductImage,
} from "../src/services/seller-product-image-uploads";
import { startExclusiveImageRemoval } from "../src/app/seller/products/new/_hooks/useProductImages";

const repoRoot = path.resolve(__dirname, "..");
const backendRequire = createRequire(path.join(repoRoot, "../zogular-backend/package.json"));
const BROWSER_QA_ENABLED = process.env.CLOUDINARY_PACKAGE1_BROWSER === "1" && Boolean(process.env.TEST_BASE_URL);
const APP_BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3199";
const FIXTURE_PORT = Number(process.env.CLOUDINARY_PACKAGE1_FIXTURE_PORT ?? 5057);
const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;
const ACCESS_NOW_SECONDS = 2_000;
const ACCESS_EXPIRES_AT = ACCESS_NOW_SECONDS + 600;
const CLOUDINARY_SIGNED_URL =
  "https://api.cloudinary.com/v1_1/zogular/image/download?public_id=zogular%2Fseller-documents%2Fuser%2Fnrc-front&format=jpg&type=authenticated&attachment=false&expires_at=2600&timestamp=2000&signature=signed&api_key=api-key";
const STORED_DURABLE_URL =
  "https://res.cloudinary.com/zogular/image/authenticated/v1/zogular/seller-documents/user/stored-nrc-front.jpg";

function cloudinaryDownloadUrl({
  protocol = "https:",
  host = "api.cloudinary.com",
  cloudName = "zogular",
  resourceType = "image",
  action = "download",
  type = "authenticated",
  expiresAt = ACCESS_EXPIRES_AT,
  publicId = "zogular/seller-documents/user/nrc-front",
  format = "jpg",
}: {
  protocol?: string;
  host?: string;
  cloudName?: string;
  resourceType?: string;
  action?: string;
  type?: string;
  expiresAt?: number;
  publicId?: string;
  format?: string | null;
} = {}) {
  const url = new URL(`${protocol}//${host}/v1_1/${cloudName}/${resourceType}/${action}`);
  if (publicId !== "") url.searchParams.set("public_id", publicId);
  if (format !== null) url.searchParams.set("format", format);
  url.searchParams.set("type", type);
  url.searchParams.set("attachment", "false");
  url.searchParams.set("expires_at", String(expiresAt));
  url.searchParams.set("timestamp", "2000");
  url.searchParams.set("signature", "signed");
  url.searchParams.set("api_key", "api-key");
  return url.toString();
}

type CapturedUpload = {
  url: string;
  formData: FormData;
};

type AccessMode = "success" | "delayed-success" | "409" | "403" | "500" | "malformed" | "network";

const fixtureState = {
  accessMode: "success" as AccessMode,
  accessRequests: 0,
  delayedAccessRelease: null as (() => void) | null,
  delayedAccessPromise: null as Promise<void> | null,
};

let fixtureServer: http.Server | null = null;

function readSource(filePath: string): string {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function baseUploadConfig(overrides: Partial<SignedCloudinaryUploadConfig> = {}): SignedCloudinaryUploadConfig {
  return {
    timestamp: 1,
    signature: "signed",
    apiKey: "api-key",
    cloudName: "zogular",
    folder: "zogular/test",
    publicId: "file-1",
    resourceType: "image",
    uploadUrl: "https://cloudinary.invalid/upload",
    allowedFormats: ["jpg", "png", "pdf"],
    allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSize: 5_000_000,
    ...overrides,
  };
}

function accessPayload(overrides: Record<string, unknown> = {}) {
  const expiresAt = typeof overrides.expiresAt === "number" ? overrides.expiresAt : ACCESS_EXPIRES_AT;
  const signedUrl = typeof overrides.signedUrl === "string" ? overrides.signedUrl : cloudinaryDownloadUrl({ expiresAt });

  return {
    status: "success",
    data: {
      documentType: "NRC_FRONT",
      signedUrl,
      expiresAt,
      ttlSeconds: 600,
      resourceType: "image",
      type: "authenticated",
      ...overrides,
    },
  };
}

function vendorApplicationPayload() {
  return {
    status: "success",
    data: {
      application: {
        id: "app-1",
        userId: "seller-1",
        sellerType: "INDIVIDUAL",
        status: "DRAFT",
        ownerFullName: "Fixture Seller",
        storeName: "Fixture Shop",
        legalBusinessName: "Fixture Shop",
        businessAddress: "Lusaka",
        district: "Lusaka",
        businessPhone: "+260970000000",
        businessEmail: "seller@example.test",
        productCategories: ["Electronics"],
        nrcNumber: "123456/78/9",
        nrcFrontUrl: STORED_DURABLE_URL,
        nrcBackUrl: "",
        shopPhotoUrl: "",
        pacraNumber: "",
        pacraDocumentUrl: "",
        tpin: "",
        payoutProvider: "",
        payoutPhone: "",
        payoutAccountName: "",
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        adminNotes: null,
        needsInfoReason: null,
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z",
        user: {
          id: "seller-1",
          firstName: "Fixture",
          lastName: "Seller",
          email: "seller@example.test",
          telephone: "+260970000000",
          role: "VENDOR",
          emailVerified: true,
          phoneVerifiedAt: "2026-08-22T00:00:00.000Z",
          isActive: true,
        },
      },
    },
  };
}

function installMockXhr(captured: CapturedUpload[]) {
  const OriginalXhr = globalThis.XMLHttpRequest;

  class MockXhr {
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    status = 200;
    responseText = "";
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    onload: (() => void) | null = null;
    private url = "";

    open(_method: string, url: string) {
      this.url = url;
    }

    send(body: XMLHttpRequestBodyInit | null) {
      if (!(body instanceof FormData)) throw new Error("Expected FormData upload body.");
      captured.push({ url: this.url, formData: body });
      const publicId = String(body.get("public_id") ?? "zogular/test/file-1");
      const folder = String(body.get("folder") ?? "").replace(/\/+$/, "");
      const responsePublicId = folder && !publicId.startsWith(`${folder}/`) ? `${folder}/${publicId}` : publicId;
      const deliveryType = String(body.get("type") ?? "authenticated");
      this.responseText = JSON.stringify({
        secure_url: `https://res.cloudinary.com/zogular/image/${deliveryType}/v1/${responsePublicId}.jpg`,
        public_id: responsePublicId,
        format: "jpg",
        bytes: 1234,
        width: 640,
        height: 480,
        resource_type: "image",
        version: 1,
        signature: "cloudinary-response-signature",
        original_filename: "file-1",
      });
      this.onload?.();
    }
  }

  globalThis.XMLHttpRequest = MockXhr as unknown as typeof XMLHttpRequest;
  return () => {
    globalThis.XMLHttpRequest = OriginalXhr;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installMockFetch(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
) {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input.toString());
    requests.push(`${init?.method ?? "GET"} ${url.pathname}`);
    return handler(url, init);
  }) as typeof fetch;

  return {
    requests,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function handleFixtureRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", FIXTURE_ORIGIN);
  const route = url.pathname.replace(/^\/api\/v1/, "");
  const method = request.method ?? "GET";

  if (route === "/auth/csrf-token" && method === "GET") {
    writeJson(response, 200, { status: "success", data: { csrfToken: "csrf" } });
    return;
  }

  if (route === "/user/me" && method === "GET") {
    const isAdmin = request.headers.authorization === "Bearer admin-fixture";
    writeJson(response, 200, {
      status: "success",
      data: {
        user: isAdmin
          ? {
              id: "admin-1",
              firstName: "Fixture",
              lastName: "Admin",
              email: "admin@example.test",
              role: "SUPER_ADMIN",
              permissions: ["access_admin_panel", "review_sellers", "view_seller_sensitive_fields", "manage_seller_status"],
            }
          : {
              id: "seller-1",
              firstName: "Fixture",
              lastName: "Seller",
              email: "seller@example.test",
              role: "VENDOR",
              emailVerified: true,
              phoneVerifiedAt: "2026-08-22T00:00:00.000Z",
              isActive: true,
            },
      },
    });
    return;
  }

  if (route === "/vendor/applications/me" && method === "GET") {
    writeJson(response, 200, vendorApplicationPayload());
    return;
  }

  if (route === "/vendor/applications/me" && method === "PATCH") {
    await readRequestBody(request);
    writeJson(response, 200, vendorApplicationPayload());
    return;
  }

  if (route === "/admin/vendor-applications/app-1" && method === "GET") {
    writeJson(response, 200, vendorApplicationPayload());
    return;
  }

  if (
    (route === "/vendor/uploads/seller-documents/NRC_FRONT/access" ||
      route === "/admin/vendor-applications/app-1/documents/NRC_FRONT/access") &&
    method === "GET"
  ) {
    fixtureState.accessRequests += 1;
    if (fixtureState.accessMode === "delayed-success") {
      fixtureState.delayedAccessPromise ??= new Promise<void>((resolve) => {
        fixtureState.delayedAccessRelease = resolve;
      });
      await fixtureState.delayedAccessPromise;
    }
    if (fixtureState.accessMode === "409") return writeJson(response, 409, { status: "error", message: "legacy public url SECRET" });
    if (fixtureState.accessMode === "403") return writeJson(response, 403, { status: "error", message: "policy SECRET" });
    if (fixtureState.accessMode === "500") return writeJson(response, 500, { status: "error", message: "stack SECRET" });
    if (fixtureState.accessMode === "network") {
      response.destroy();
      return;
    }
    if (fixtureState.accessMode === "malformed") return writeJson(response, 200, { status: "success", data: { signedUrl: "http://evil.test/doc" } });
    return writeJson(response, 200, accessPayload({ expiresAt: Math.floor(Date.now() / 1000) + 600 }));
  }

  writeJson(response, 404, { status: "error", message: `Unhandled fixture route ${method} ${route}` });
}

async function startFixtureServer() {
  if (fixtureServer) return;
  fixtureServer = http.createServer((request, response) => {
    handleFixtureRequest(request, response).catch((error: unknown) => {
      writeJson(response, 500, { status: "error", message: error instanceof Error ? error.message : "Fixture failure" });
    });
  });
  await new Promise<void>((resolve) => fixtureServer?.listen(FIXTURE_PORT, "127.0.0.1", resolve));
}

async function stopFixtureServer() {
  if (!fixtureServer) return;
  fixtureState.delayedAccessRelease?.();
  fixtureServer.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    fixtureServer?.close((error) => error ? reject(error) : resolve());
  });
  fixtureServer = null;
}

function resetFixture(mode: AccessMode = "success") {
  fixtureState.accessMode = mode;
  fixtureState.accessRequests = 0;
  fixtureState.delayedAccessRelease = null;
  fixtureState.delayedAccessPromise = null;
}

async function installBrowserDiagnostics(page: Page) {
  const diagnostics: string[] = [];
  await page.route("**/_vercel/speed-insights/script.js", async (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/_vercel/insights/script.js", async (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://api.cloudinary.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"48\"><rect width=\"64\" height=\"48\" fill=\"#eee\"/></svg>",
    });
  });
  page.on("pageerror", (error) => diagnostics.push(`pageerror ${error.message}`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) diagnostics.push(`console ${message.type()} ${message.text()}`);
  });
  page.on("requestfailed", (request) => diagnostics.push(`requestfailed ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`));
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.push(`bad-response ${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function unexpectedDiagnostics(diagnostics: string[]) {
  const expectedConsoleStatuses = diagnostics
    .filter((entry) => entry.startsWith("expected-access-console-status "))
    .map((entry) => entry.replace("expected-access-console-status ", ""));

  return diagnostics.filter((entry) => {
    if (entry.startsWith("expected-access-console-status ")) {
      return false;
    }
    if (/\/api\/backend\/(vendor\/uploads\/seller-documents|admin\/vendor-applications\/app-1\/documents)\/.+\/access/.test(entry)) {
      return false;
    }
    if (/requestfailed GET http:\/\/127\.0\.0\.1:3199\/\?_rsc=/.test(entry)) {
      return false;
    }
    if (/requestfailed GET http:\/\/127\.0\.0\.1:3199\/admin\/sellers\?_rsc=/.test(entry)) {
      return false;
    }
    if (/requestfailed GET http:\/\/127\.0\.0\.1:3199\/admin\/dashboard\?_rsc=/.test(entry)) {
      return false;
    }
    if (/requestfailed GET http:\/\/127\.0\.0\.1:3199\/_vercel\/(insights|speed-insights)\/script\.js net::ERR_ABORTED/.test(entry)) {
      return false;
    }
    const resourceStatus = entry.match(
      /^console error Failed to load resource: the server responded with a status of (403|409|500)(?: \([^)]+\))?$/,
    )?.[1];
    if (resourceStatus) {
      const expectedIndex = expectedConsoleStatuses.indexOf(resourceStatus);
      if (expectedIndex >= 0) {
        expectedConsoleStatuses.splice(expectedIndex, 1);
        return false;
      }
    }
    return true;
  });
}

test.beforeAll(async () => {
  if (BROWSER_QA_ENABLED) await startFixtureServer();
});

test.afterAll(async () => {
  await stopFixtureServer();
});

test("direct upload appends optional supported Cloudinary type and keeps old signatures compatible", async () => {
  const uploads: CapturedUpload[] = [];
  const restore = installMockXhr(uploads);

  try {
    await uploadFileToCloudinary(baseUploadConfig({ type: "authenticated" }), new File(["x"], "nrc.jpg", { type: "image/jpeg" }));
    await uploadFileToCloudinary(baseUploadConfig(), new File(["x"], "legacy.jpg", { type: "image/jpeg" }));
  } finally {
    restore();
  }

  expect(uploads).toHaveLength(2);
  expect(uploads[0].formData.get("type")).toBe("authenticated");
  expect(uploads[1].formData.has("type")).toBe(false);
  expect(isSupportedCloudinaryDeliveryType("upload")).toBe(true);
  expect(isSupportedCloudinaryDeliveryType("authenticated")).toBe(true);
  expect(isSupportedCloudinaryDeliveryType("private")).toBe(false);
});

test("seller document uploads reserve, upload with authenticated delivery, then confirm before returning", async () => {
  const uploads: CapturedUpload[] = [];
  const restoreXhr = installMockXhr(uploads);
  const fetchMock = installMockFetch((url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    if (url.pathname.endsWith("/vendor/uploads/seller-document/signature") && init?.body?.toString().includes("NRC_FRONT")) {
      return jsonResponse({ status: "success", data: baseUploadConfig({
        folder: "",
        publicId: "zogular/seller-documents/seller-1/nrc-front-1",
        reservedPublicId: "zogular/seller-documents/seller-1/nrc-front-1",
        reservationId: "11111111-1111-4111-8111-111111111111",
        type: "authenticated",
      }) });
    }
    if (url.pathname.endsWith("/vendor/uploads/seller-document/confirm")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.reservationId).toBe("11111111-1111-4111-8111-111111111111");
      expect(body.documentType).toBe("NRC_FRONT");
      expect(body.publicId).toBe("zogular/seller-documents/seller-1/nrc-front-1");
      expect(body.resourceType).toBe("image");
      expect(body.deliveryType).toBe("authenticated");
      expect(body.signature).toBe("cloudinary-response-signature");
      return jsonResponse({
        status: "success",
        data: {
          reservationId: "11111111-1111-4111-8111-111111111111",
          documentType: "NRC_FRONT",
          publicId: "zogular/seller-documents/seller-1/nrc-front-1",
          url: "https://res.cloudinary.com/zogular/image/authenticated/v1/zogular/seller-documents/seller-1/nrc-front-1.jpg",
          resourceType: "image",
          type: "authenticated",
        },
      });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const uploaded = await uploadSellerDocument(new File(["x"], "nrc.jpg", { type: "image/jpeg" }), "NRC_FRONT");
    expect(uploaded.reservationId).toBe("11111111-1111-4111-8111-111111111111");
    expect(uploaded.publicId).toBe("zogular/seller-documents/seller-1/nrc-front-1");
    expect(uploads[0].formData.get("type")).toBe("authenticated");
    expect(uploads[0].formData.has("folder")).toBe(false);
    expect(fetchMock.requests).toContain("POST /api/v1/vendor/uploads/seller-document/signature");
    expect(fetchMock.requests).toContain("POST /api/v1/vendor/uploads/seller-document/confirm");
  } finally {
    fetchMock.restore();
    restoreXhr();
  }
});

test("seller document upload rejects partial reservation contracts before Cloudinary upload", async () => {
  const uploads: CapturedUpload[] = [];
  const restoreXhr = installMockXhr(uploads);
  const fetchMock = installMockFetch((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    if (url.pathname.endsWith("/vendor/uploads/seller-document/signature")) {
      return jsonResponse({ status: "success", data: baseUploadConfig({
        type: "authenticated",
        reservedPublicId: "zogular/seller-documents/seller-1/nrc-front-1",
      }) });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    await expect(uploadSellerDocument(new File(["x"], "nrc.jpg", { type: "image/jpeg" }), "NRC_FRONT")).rejects.toThrow(
      "Document upload is not available right now. Please try again shortly.",
    );
    expect(uploads).toHaveLength(0);
  } finally {
    fetchMock.restore();
    restoreXhr();
  }
});

test("seller document upload rejects public delivery without uploading the file", async () => {
  const uploads: CapturedUpload[] = [];
  const restoreXhr = installMockXhr(uploads);
  const fetchMock = installMockFetch((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    if (url.pathname.endsWith("/vendor/uploads/seller-document/signature")) return jsonResponse({ status: "success", data: baseUploadConfig({ type: "upload" }) });
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    await expect(uploadSellerDocument(new File(["x"], "nrc.jpg", { type: "image/jpeg" }), "NRC_FRONT")).rejects.toThrow(
      "Document upload is not available right now. Please try again shortly.",
    );
    expect(uploads).toHaveLength(0);
  } finally {
    fetchMock.restore();
    restoreXhr();
  }
});

test("product image upload remains on the product signature endpoint and carries public upload type when supplied", async () => {
  const uploads: CapturedUpload[] = [];
  const restoreXhr = installMockXhr(uploads);
  const fetchMock = installMockFetch(async (url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    if (url.pathname.endsWith("/vendor/uploads/product-image/signature")) {
      return jsonResponse({ status: "success", data: baseUploadConfig({
        folder: "",
        publicId: "zogular/products/seller-1/product-image-1",
        reservedPublicId: "zogular/products/seller-1/product-image-1",
        reservationId: "11111111-1111-4111-8111-111111111111",
        type: "upload",
        maxFileSize: 3_000_000,
      }) });
    }
    if (url.pathname.endsWith("/vendor/uploads/product-image/confirm")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.reservationId).toBe("11111111-1111-4111-8111-111111111111");
      expect(body.publicId).toBe("zogular/products/seller-1/product-image-1");
      expect(body.resourceType).toBe("image");
      expect(body.deliveryType).toBe("upload");
      expect(body.signature).toBe("cloudinary-response-signature");
      return jsonResponse({
        status: "success",
        data: {
          reservationId: "11111111-1111-4111-8111-111111111111",
          publicId: "zogular/products/seller-1/product-image-1",
          url: "https://res.cloudinary.com/zogular/image/upload/v1/zogular/products/seller-1/product-image-1.jpg",
          width: 640,
          height: 480,
        },
      });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const uploaded = await uploadSellerProductImage(new File(["x"], "product.jpg", { type: "image/jpeg" }));
    expect(fetchMock.requests).toContain("POST /api/v1/vendor/uploads/product-image/signature");
    expect(fetchMock.requests).toContain("POST /api/v1/vendor/uploads/product-image/confirm");
    expect(uploaded.uploadReservationId).toBe("11111111-1111-4111-8111-111111111111");
    expect(uploads).toHaveLength(1);
    expect(uploads[0].formData.get("type")).toBe("upload");
    expect(uploads[0].formData.has("folder")).toBe(false);
  } finally {
    fetchMock.restore();
    restoreXhr();
  }
});

test("temporary product image removal uses the backend cleanup endpoint", async () => {
  const fetchMock = installMockFetch((url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    if (url.pathname.endsWith("/vendor/uploads/product-image/remove")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.reservationId).toBe("11111111-1111-4111-8111-111111111111");
      expect(body.publicId).toBe("zogular/products/seller-1/product-image-1");
      return jsonResponse({
        status: "success",
        data: { status: "queued", reservationId: "11111111-1111-4111-8111-111111111111" },
      }, 202);
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const result = await removeTemporarySellerProductImageUpload({
      uploadReservationId: "11111111-1111-4111-8111-111111111111",
      publicId: "zogular/products/seller-1/product-image-1",
    });
    expect(result.status).toBe("queued");
    expect(fetchMock.requests).toContain("POST /api/v1/vendor/uploads/product-image/remove");
  } finally {
    fetchMock.restore();
  }
});

test("product image upload keeps old backend signatures compatible before reservation rollout", async () => {
  const uploads: CapturedUpload[] = [];
  const restoreXhr = installMockXhr(uploads);
  const fetchMock = installMockFetch((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    if (url.pathname.endsWith("/vendor/uploads/product-image/signature")) {
      return jsonResponse({ status: "success", data: baseUploadConfig({ type: "upload", maxFileSize: 3_000_000 }) });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const uploaded = await uploadSellerProductImage(new File(["x"], "legacy-product.jpg", { type: "image/jpeg" }));
    expect(uploaded.uploadReservationId).toBeUndefined();
    expect(fetchMock.requests).toContain("POST /api/v1/vendor/uploads/product-image/signature");
    expect(fetchMock.requests).not.toContain("POST /api/v1/vendor/uploads/product-image/confirm");
    expect(uploads).toHaveLength(1);
  } finally {
    fetchMock.restore();
    restoreXhr();
  }
});

test("product image upload rejects partial reservation contracts before Cloudinary upload", async () => {
  for (const partialConfig of [
    baseUploadConfig({
      folder: "",
      publicId: "zogular/products/seller-1/product-image-1",
      reservationId: "11111111-1111-4111-8111-111111111111",
      reservedPublicId: undefined,
      type: "upload",
      maxFileSize: 3_000_000,
    }),
    baseUploadConfig({
      folder: "",
      publicId: "zogular/products/seller-1/product-image-1",
      reservationId: undefined,
      reservedPublicId: "zogular/products/seller-1/product-image-1",
      type: "upload",
      maxFileSize: 3_000_000,
    }),
  ]) {
    const uploads: CapturedUpload[] = [];
    const restoreXhr = installMockXhr(uploads);
    const fetchMock = installMockFetch((url) => {
      if (url.pathname.endsWith("/auth/csrf-token")) {
        return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
      }
      if (url.pathname.endsWith("/vendor/uploads/product-image/signature")) {
        return jsonResponse({ status: "success", data: partialConfig });
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    });

    try {
      await expect(uploadSellerProductImage(new File(["x"], "partial.jpg", { type: "image/jpeg" }))).rejects.toThrow(
        "Image upload reservation was incomplete. Please try again.",
      );
      expect(uploads).toHaveLength(0);
      expect(fetchMock.requests).not.toContain("POST /api/v1/vendor/uploads/product-image/confirm");
    } finally {
      fetchMock.restore();
      restoreXhr();
    }
  }
});

test("temporary product image removal can retry after a failed backend removal", async () => {
  let attempts = 0;
  const fetchMock = installMockFetch((url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    if (url.pathname.endsWith("/vendor/uploads/product-image/remove")) {
      attempts += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.reservationId).toBe("11111111-1111-4111-8111-111111111111");
      expect(body.publicId).toBe("zogular/products/seller-1/product-image-1");
      if (attempts === 1) {
        return jsonResponse({ status: "error", message: "temporary failure SECRET" }, 503);
      }
      return jsonResponse({
        status: "success",
        data: { status: "queued", reservationId: "11111111-1111-4111-8111-111111111111" },
      }, 202);
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    await expect(removeTemporarySellerProductImageUpload({
      uploadReservationId: "11111111-1111-4111-8111-111111111111",
      publicId: "zogular/products/seller-1/product-image-1",
    })).rejects.toThrow();
    const retry = await removeTemporarySellerProductImageUpload({
      uploadReservationId: "11111111-1111-4111-8111-111111111111",
      publicId: "zogular/products/seller-1/product-image-1",
    });
    expect(retry.status).toBe("queued");
    expect(attempts).toBe(2);
  } finally {
    fetchMock.restore();
  }
});

test("seller product image hook keeps reserved images until backend removal succeeds", () => {
  const hookSource = readSource("src/app/seller/products/new/_hooks/useProductImages.ts");
  const componentSource = readSource("src/app/seller/products/new/_components/ProductImagesSection.tsx");

  expect(hookSource).toContain("removalPromisesRef");
  expect(hookSource).toContain("startExclusiveImageRemoval(removalPromisesRef.current");
  expect(hookSource).toContain("existingImage?.uploadReservationId && existingImage.publicId");
  expect(hookSource).not.toContain('existingImage.uploadStatus === "uploaded"');
  expect(hookSource).toContain('removalStatus: "removing"');
  expect(hookSource).toContain('removalStatus: "failed"');
  expect(componentSource).toContain("min-h-11");
  expect(componentSource).toContain("aria-label");
  expect(componentSource).toContain("Removing");
  expect(componentSource).toContain('disabled={image.removalStatus === "removing"}');
});

test("seller product image removal guard prevents duplicate in-flight backend removal and allows retry", async () => {
  const removals = new Map<string, Promise<void>>();
  let calls = 0;
  let releaseFirst: () => void = () => {
    throw new Error("Removal release was not initialized.");
  };
  const firstTask = startExclusiveImageRemoval(removals, "image-1", async () => {
    calls += 1;
    await new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    throw new Error("temporary failure");
  });
  const duplicateTask = startExclusiveImageRemoval(removals, "image-1", async () => {
    calls += 1;
  });

  expect(duplicateTask).toBe(firstTask);
  expect(calls).toBe(0);
  await Promise.resolve();
  expect(calls).toBe(1);
  releaseFirst();
  await expect(firstTask).rejects.toThrow("temporary failure");
  expect(removals.has("image-1")).toBe(false);

  await startExclusiveImageRemoval(removals, "image-1", async () => {
    calls += 1;
  });
  expect(calls).toBe(2);
});

test("document access parser accepts the installed Cloudinary private download URL shape", () => {
  const cloudinary = backendRequire("cloudinary") as {
    v2: {
      config(options: { cloud_name: string; api_key: string; api_secret: string }): void;
      utils: {
        private_download_url(
          publicId: string,
          format: string,
          options: { resource_type: string; type: string; expires_at: number; attachment: boolean },
        ): string;
      };
    };
  };
  cloudinary.v2.config({
    cloud_name: "zogular",
    api_key: "dummy-api-key",
    api_secret: "dummy-api-secret",
  });

  const sdkUrl = cloudinary.v2.utils.private_download_url("zogular/seller-documents/user/nrc-front", "jpg", {
    resource_type: "image",
    type: "authenticated",
    expires_at: ACCESS_EXPIRES_AT,
    attachment: false,
  });
  const parsed = new URL(sdkUrl);

  expect(parsed.protocol).toBe("https:");
  expect(parsed.hostname).toBe("api.cloudinary.com");
  expect(parsed.pathname).toBe("/v1_1/zogular/image/download");
  expect(parsed.searchParams.get("type")).toBe("authenticated");
  expect(parsed.searchParams.get("expires_at")).toBe(String(ACCESS_EXPIRES_AT));
  expect(parsed.searchParams.get("public_id")).toBe("zogular/seller-documents/user/nrc-front");
  expect(normalizeSellerDocumentAccess(accessPayload({ signedUrl: sdkUrl }), "NRC_FRONT", ACCESS_NOW_SECONDS).signedUrl).toBe(sdkUrl);
});

test("document access parser requires exact success envelope and fresh authenticated Cloudinary access", () => {
  expect(normalizeSellerDocumentAccess(accessPayload(), "NRC_FRONT", ACCESS_NOW_SECONDS)).toMatchObject({
    signedUrl: CLOUDINARY_SIGNED_URL,
    resourceType: "image",
    type: "authenticated",
  });
  expect(normalizeSellerDocumentAccess(accessPayload({ extra: "ignored" }), "NRC_FRONT", ACCESS_NOW_SECONDS)).toMatchObject({
    signedUrl: CLOUDINARY_SIGNED_URL,
    type: "authenticated",
  });

  for (const payload of [
    { status: "ok", data: accessPayload().data },
    { status: "success" },
    accessPayload({ signedUrl: "" }),
    accessPayload({ signedUrl: "/relative/doc" }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ protocol: "http:" }) }),
    accessPayload({ signedUrl: "https://user:pass@api.cloudinary.com/v1_1/zogular/image/download?public_id=doc&type=authenticated&expires_at=2600" }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ host: "res.cloudinary.com" }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ host: "evil.test" }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ cloudName: "" }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ resourceType: "raw" }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ action: "upload" }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ type: "upload" }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ expiresAt: ACCESS_EXPIRES_AT + 1 }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ publicId: "" }) }),
    accessPayload({ signedUrl: cloudinaryDownloadUrl({ format: "" }) }),
    accessPayload({ signedUrl: "https://res.cloudinary.com/zogular/image/authenticated/v1/doc.jpg" }),
    accessPayload({ signedUrl: "https://res.cloudinary.com/zogular/raw/authenticated/v1/doc.pdf", resourceType: "raw" }),
    accessPayload({ expiresAt: ACCESS_NOW_SECONDS }),
    accessPayload({ expiresAt: ACCESS_NOW_SECONDS - 31 }),
    accessPayload({ expiresAt: ACCESS_NOW_SECONDS + 700 }),
    accessPayload({ expiresAt: 2_000.5 }),
    accessPayload({ ttlSeconds: 599 }),
    accessPayload({ ttlSeconds: 601 }),
    accessPayload({ ttlSeconds: 600.1 }),
    accessPayload({ type: "upload" }),
    accessPayload({ resourceType: "auto" }),
    accessPayload({ documentType: "NRC_BACK" }),
    { documentType: "NRC_FRONT", signedUrl: CLOUDINARY_SIGNED_URL, expiresAt: ACCESS_EXPIRES_AT, ttlSeconds: 600, resourceType: "image", type: "authenticated" },
  ]) {
    expect(() => normalizeSellerDocumentAccess(payload, "NRC_FRONT", ACCESS_NOW_SECONDS)).toThrow(SellerDocumentAccessError);
  }
});

test("seller and admin access map status, malformed success, and network failures to safe messages", async () => {
  const cases: Array<[number | "network" | "malformed", string]> = [
    [401, "Please sign in again to view this document."],
    [403, "You do not have access to view this document."],
    [404, "This document is not available yet."],
    [408, "Document preview took too long. Check your connection and try again."],
    [409, "This document needs to be uploaded again before it can be viewed."],
    [500, "Document preview is not available right now. Please try again."],
    ["malformed", "Document preview is not available right now. Please try again."],
    ["network", "Document preview is not available right now. Please try again."],
  ];

  for (const [failure, message] of cases) {
    const fetchMock = installMockFetch(() => {
      if (failure === "network") throw new Error("SECRET network stack");
      if (failure === "malformed") return jsonResponse({ status: "success", data: { signedUrl: "https://evil.test/SECRET" } });
      return jsonResponse({ status: "error", message: `SECRET backend ${failure}` }, failure);
    });

    try {
      await expect(getSellerDocumentAccess("NRC_FRONT")).rejects.toMatchObject({ message, status: failure === "network" ? 503 : failure === "malformed" ? 502 : failure });
      await expect(getAdminSellerDocumentAccess("app-1", "NRC_FRONT")).rejects.toMatchObject({ message, status: failure === "network" ? 503 : failure === "malformed" ? 502 : failure });
      await expect(getSellerDocumentAccess("NRC_FRONT")).rejects.not.toThrow(/SECRET|stack|backend/i);
      expect(getSellerDocumentAccessMessage(new SellerDocumentAccessError(message, 409))).toBe(message);
      expect(fetchMock.requests).toContain("GET /api/v1/vendor/uploads/seller-documents/NRC_FRONT/access");
      expect(fetchMock.requests).toContain("GET /api/v1/admin/vendor-applications/app-1/documents/NRC_FRONT/access");
    } finally {
      fetchMock.restore();
    }
  }
});

test("seller and admin document preview UI requests fresh access and keeps compact 44px targets", () => {
  const uploadTileSource = readSource("src/features/seller-onboarding/components/shared/upload-tile.tsx");
  const complianceSource = readSource("src/features/seller-onboarding/components/sections/compliance-section.tsx");
  const adminDocumentsSource = readSource("src/features/admin-sellers/sections/DocumentsSection.tsx");

  expect(complianceSource).toContain("getSellerDocumentAccess(document.documentType)");
  expect(uploadTileSource).toContain("onRequestPreviewUrl");
  expect(uploadTileSource).toContain("setPreviewUrl(nextUrl)");
  expect(uploadTileSource).toContain("min-h-11");
  expect(uploadTileSource).not.toContain("url={url}");
  expect(adminDocumentsSource).toContain("getAdminSellerDocumentAccess(applicationId, documentType)");
  expect(adminDocumentsSource).toContain("getSellerDocumentAccessMessage(caught)");
  expect(adminDocumentsSource).toContain("min-h-11");
  expect(adminDocumentsSource).toContain("mt-3 rounded-xl bg-rose-50");
  expect(adminDocumentsSource).not.toContain("<img");
  expect(adminDocumentsSource).not.toContain("src={url");
  expect(adminDocumentsSource).not.toContain("sm:col-span");
});

test.describe("browser QA for seller/admin document previews", () => {
  test.skip(!BROWSER_QA_ENABLED, "Set CLOUDINARY_PACKAGE1_BROWSER=1 and TEST_BASE_URL to run browser QA.");

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`seller document preview uses fresh access and handles failures at ${viewport.width}px`, async ({ browser }, testInfo) => {
      resetFixture("success");
      const page = await browser.newPage({ viewport });
      const diagnostics = await installBrowserDiagnostics(page);
      await page.goto(`${APP_BASE_URL}/seller/onboarding`);
      await expect(page.getByRole("heading", { name: /Seller application/i })).toBeVisible();

      const viewButton = page.getByRole("button", { name: /^View$/ }).first();
      await expect(viewButton).toBeVisible();
      const box = await viewButton.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);

      await viewButton.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText("NRC front");
      expect(fixtureState.accessRequests).toBe(1);
      expect(page.url()).not.toContain(STORED_DURABLE_URL);
      await page.getByRole("button", { name: /Close preview/i }).click();

      resetFixture("409");
      diagnostics.push("expected-access-console-status 409");
      await viewButton.click();
      await expect(page.getByText("This document needs to be uploaded again before it can be viewed.")).toBeVisible();

      resetFixture("network");
      diagnostics.push("expected-access-console-status 500");
      await viewButton.click();
      await expect(page.getByText("Document preview is not available right now. Please try again.")).toBeVisible();

      await page.screenshot({ path: testInfo.outputPath(`seller-${viewport.width}.png`), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      expect(unexpectedDiagnostics(diagnostics)).toEqual([]);
      await page.close();
    });

    test(`admin document preview uses fresh access, suppresses duplicates, and handles permission states at ${viewport.width}px`, async ({ browser }, testInfo) => {
      resetFixture("delayed-success");
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const diagnostics = await installBrowserDiagnostics(page);
      await page.goto(`${APP_BASE_URL}/admin/login`);
      await page.evaluate(() => {
        document.cookie = "zogular_admin_session=admin-fixture; path=/; SameSite=Lax";
      });
      await page.goto(`${APP_BASE_URL}/admin/sellers/app-1`);
      await expect(page.getByRole("heading", { name: /Fixture Shop/i })).toBeVisible();

      const viewFull = page.getByRole("button", { name: /View full/i }).first();
      await expect(viewFull).toBeVisible();
      const box = await viewFull.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);

      try {
        await viewFull.click();
        const openingButton = page.getByRole("button", { name: /Opening/i }).first();
        await expect(openingButton).toBeVisible();
        await openingButton.click({ force: true });
        expect(fixtureState.accessRequests).toBe(1);
      } finally {
        fixtureState.delayedAccessRelease?.();
      }
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText("NRC front");
      await page.getByRole("button", { name: /Close preview/i }).click();

      resetFixture("403");
      diagnostics.push("expected-access-console-status 403");
      await viewFull.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("You do not have access to view this document.")).toBeVisible();

      resetFixture("500");
      diagnostics.push("expected-access-console-status 500");
      await viewFull.click();
      await expect(page.getByText("Document preview is not available right now. Please try again.")).toBeVisible();
      await expect(page.getByText(/SECRET|stack|policy/i)).toHaveCount(0);

      await page.screenshot({ path: testInfo.outputPath(`admin-${viewport.width}.png`), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      expect(unexpectedDiagnostics(diagnostics)).toEqual([]);
      await context.close();
    });
  }
});
