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
