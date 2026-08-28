import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  PASSWORD_RECOVERY_INTENT_STORAGE_KEY,
  PASSWORD_RECOVERY_INTENT_TTL_MS,
  clearStoredAuthSession,
  clearPasswordRecoveryIntent,
  createPasswordRecoveryIntent,
  getPasswordRecoveryIntent,
  parsePasswordRecoveryIntent,
  storePasswordRecoveryIntent,
  storeAuthSession,
  type PasswordRecoveryIntent,
} from "../src/services/auth-session";
import { maskPasswordRecoveryEmail } from "../src/services/auth";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const now = Date.UTC(2026, 7, 21, 12, 0, 0);

function rawIntent(overrides: Partial<PasswordRecoveryIntent> = {}) {
  return JSON.stringify({
    version: 1,
    purpose: "password-reset",
    intentId: "123e4567-e89b-42d3-a456-426614174000",
    email: "buyer@example.test",
    nextPath: "/account/orders?filter=open",
    stage: "code-requested",
    createdAt: now,
    expiresAt: now + PASSWORD_RECOVERY_INTENT_TTL_MS,
    ...overrides,
  });
}

test("recovery intent is typed, tab-scoped, bounded, and contains no secret", () => {
  const intent = createPasswordRecoveryIntent(" Buyer@Example.Test ", "/account/orders", now);
  expect(intent).toMatchObject({
    version: 1,
    purpose: "password-reset",
    email: "buyer@example.test",
    nextPath: "/account/orders",
    stage: "code-requested",
    createdAt: now,
    expiresAt: now + PASSWORD_RECOVERY_INTENT_TTL_MS,
  });
  expect(intent.intentId.length).toBeGreaterThanOrEqual(16);
  const storedRecord = intent as unknown as Record<string, unknown>;
  expect(storedRecord).not.toHaveProperty("code");
  expect(storedRecord).not.toHaveProperty("otp");
  expect(storedRecord).not.toHaveProperty("password");
});

test("parser accepts exact current intent and rejects expired, future, hostile, or secret-bearing records", () => {
  expect(parsePasswordRecoveryIntent(rawIntent(), now)?.email).toBe("buyer@example.test");
  expect(parsePasswordRecoveryIntent(rawIntent(), now + PASSWORD_RECOVERY_INTENT_TTL_MS)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ createdAt: now + 1 }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ version: 2 as 1 }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ purpose: "login" as "password-reset" }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ stage: "complete" as "code-requested" }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ email: " Buyer@Example.Test " }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ intentId: "predictable-intent" }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ nextPath: "https://evil.example/steal" }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ nextPath: "/%2e%2e//evil.example" }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ expiresAt: now + 60_000 }), now)).toBeNull();
  expect(parsePasswordRecoveryIntent(rawIntent({ createdAt: Number.MAX_SAFE_INTEGER, expiresAt: Number.MAX_SAFE_INTEGER }), now)).toBeNull();
  const withOtp = JSON.parse(rawIntent()) as Record<string, unknown>;
  withOtp.otp = "123456";
  expect(parsePasswordRecoveryIntent(JSON.stringify(withOtp), now)).toBeNull();
  expect(parsePasswordRecoveryIntent("not-json", now)).toBeNull();
});

test("ordinary guest-session clearing preserves fresh recovery, while identity transition clears it", () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  });
  try {
    const intent = JSON.parse(rawIntent()) as PasswordRecoveryIntent;
    expect(storePasswordRecoveryIntent(intent)).toBe(true);

    clearStoredAuthSession();
    expect(getPasswordRecoveryIntent(now)).toEqual(intent);

    storeAuthSession({
      user: {
        id: "buyer-1",
        firstName: "Buyer",
        lastName: "One",
        email: "buyer@example.test",
      },
    });
    expect(getPasswordRecoveryIntent(now)).toBeNull();
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("recovery creation fails closed without a safe clock value", () => {
  expect(() => createPasswordRecoveryIntent("buyer@example.test", null, Number.NaN)).toThrow(TypeError);
  expect(() => createPasswordRecoveryIntent("buyer@example.test", null, -1)).toThrow(TypeError);
  expect(() => createPasswordRecoveryIntent("buyer@example.test", null, Number.MAX_SAFE_INTEGER)).toThrow(TypeError);
});

test("storage helpers remove malformed and expired context and clear valid context", () => {
  const storage = new MemoryStorage();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: storage } });
  try {
    storage.setItem(PASSWORD_RECOVERY_INTENT_STORAGE_KEY, "malformed");
    expect(getPasswordRecoveryIntent(now)).toBeNull();
    expect(storage.getItem(PASSWORD_RECOVERY_INTENT_STORAGE_KEY)).toBeNull();

    const intent = JSON.parse(rawIntent()) as PasswordRecoveryIntent;
    expect(storePasswordRecoveryIntent(intent)).toBe(true);
    expect(getPasswordRecoveryIntent(now)).toEqual(intent);
    expect(getPasswordRecoveryIntent(now + PASSWORD_RECOVERY_INTENT_TTL_MS)).toBeNull();

    expect(storePasswordRecoveryIntent(intent)).toBe(true);
    clearPasswordRecoveryIntent();
    expect(storage.getItem(PASSWORD_RECOVERY_INTENT_STORAGE_KEY)).toBeNull();
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("recovery UI never uses remembered login email and direct pages fail closed", () => {
  const authSource = readSource("src/services/auth.ts");
  const sessionSource = readSource("src/services/auth-session.ts");
  const verifySource = readSource("src/app/(consumer)/auth/verify-code/page.tsx");
  const resetSource = readSource("src/app/(consumer)/auth/reset-password/page.tsx");

  expect(authSource).not.toContain("getLastAuthEmail");
  expect(authSource).not.toContain("getDemoVerificationEmail");
  expect(sessionSource).not.toContain("export function getLastAuthEmail");
  expect(verifySource).not.toContain('searchParams.get("email")');
  expect(resetSource).not.toContain('searchParams.get("email")');
  expect(verifySource).toContain('data-testid="password-recovery-restart"');
  expect(resetSource).toContain('data-testid="password-recovery-restart"');
  expect(verifySource).toContain('intent.stage !== "code-requested"');
  expect(resetSource).toContain('intent.stage !== "code-verified"');
});

test("recovery hops use fixed routes while preserving only sanitized stored next intent", () => {
  const authSource = readSource("src/services/auth.ts");
  expect(authSource).not.toMatch(/verify-code\?email|reset-password\?email/);
  expect(authSource).toContain('nextPath: "/auth/verify-code"');
  expect(authSource).toContain('nextPath: "/auth/reset-password"');
  expect(authSource).toContain('nextPath?.startsWith("/admin")');
  expect(authSource).toContain('nextPath?.startsWith("/seller")');
  expect(authSource).toContain('"/seller/login"');
  expect(authSource).toContain('"/auth/login"');
});

test("masked recovery destination never renders the full mailbox", () => {
  expect(maskPasswordRecoveryEmail("alice@example.test")).toBe("al***@example.test");
  expect(maskPasswordRecoveryEmail("a@example.test")).toBe("a***@example.test");
  expect(maskPasswordRecoveryEmail("invalid")).toBe("your email address");
  expect(maskPasswordRecoveryEmail("alice@example.test")).not.toContain("alice@example.test");
});
