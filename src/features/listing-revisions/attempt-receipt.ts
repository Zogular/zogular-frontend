import { z } from "zod";

const uuid = z.uuid();
const receiptSchema = z.strictObject({
  baseVersion: z.int32().nonnegative(),
  submissionKey: uuid,
});
export type AttemptReceipt = z.output<typeof receiptSchema>;

export function getAttemptReceiptKey(sellerId: string | undefined, productId: string) {
  if (!sellerId || !uuid.safeParse(sellerId).success || !uuid.safeParse(productId).success) return null;
  return `zogular:a5-attempt:v1:${sellerId.toLowerCase()}:${productId.toLowerCase()}`;
}

// A corrupt or unavailable receipt is not evidence that there is no pending attempt.
export function readAttemptReceipt(key: string | null): AttemptReceipt | null | undefined {
  if (!key) return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === null ? null : receiptSchema.safeParse(JSON.parse(raw)).data;
  } catch {
    return undefined;
  }
}

function sameAttempt(a: AttemptReceipt, b: AttemptReceipt) {
  return a.baseVersion === b.baseVersion && a.submissionKey === b.submissionKey;
}

export function reserveAttemptReceipt(key: string | null, attempt: AttemptReceipt) {
  const existing = readAttemptReceipt(key);
  if (!key || existing === undefined) return false;
  if (existing) return sameAttempt(existing, attempt);
  try {
    // Store no catalog fields, errors, or authentication data.
    window.sessionStorage.setItem(key, JSON.stringify({
      baseVersion: attempt.baseVersion, submissionKey: attempt.submissionKey,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearAttemptReceipt(key: string | null, attempt: AttemptReceipt) {
  const existing = readAttemptReceipt(key);
  if (!key || !existing || !sameAttempt(existing, attempt)) return false;
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
