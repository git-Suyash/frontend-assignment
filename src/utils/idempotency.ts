/**
 * idempotency
 *
 * Provides a simple client-side idempotency key mechanism to prevent
 * accidental duplicate order submissions.
 *
 * How it works:
 *   1. A UUID key is generated when CartProvider initialises the cart state.
 *   2. At checkout, `consumeIdempotencyKey` is called. If the key has already
 *      been consumed (it's in localStorage), it returns `false` and the
 *      checkout is blocked with an IDEMPOTENCY_REUSE error.
 *   3. After a successful or failed submission, `RESET_IDEMPOTENCY_KEY` is
 *      dispatched to generate a fresh key for the next attempt.
 *
 * Limitations:
 *   - This is a client-side safety net only. The server must implement its
 *     own idempotency via the X-Idempotency-Key header.
 *   - The consumed-keys list is capped at 10 entries to avoid unbounded
 *     localStorage growth.
 */

const STORAGE_KEY = 'consumed_idempotency_keys';

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function consumeIdempotencyKey(key: string): boolean {
  let consumed: string[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) consumed = JSON.parse(raw) as string[];
  } catch {
    consumed = [];
  }

  if (consumed.includes(key)) {
    return false;
  }

  consumed.push(key);
  // Keep only the last 10
  if (consumed.length > 10) {
    consumed = consumed.slice(consumed.length - 10);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consumed));
  } catch {
    // Storage write failed — still return true so the attempt proceeds
  }

  return true;
}
