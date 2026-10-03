/**
 * Idempotency keys make retried mutations safe: pressing "confirm" twice,
 * a flaky network retry or a double form submit all reuse one key.
 */
const STORAGE_PREFIX = 'idem:';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Return a stable key for the scope, creating one on first call. */
export function getIdempotencyKey(scope: string): string {
  const store = storage();
  const fullKey = `${STORAGE_PREFIX}${scope}`;
  const existing = store?.getItem(fullKey);
  if (existing) return existing;
  const created = newIdempotencyKey();
  store?.setItem(fullKey, created);
  return created;
}

export function clearIdempotencyKey(scope: string): void {
  storage()?.removeItem(`${STORAGE_PREFIX}${scope}`);
}

/** Run a mutation with a scope key, rotating the key after success. */
export async function withIdempotency<T>(scope: string, fn: (key: string) => Promise<T>): Promise<T> {
  const key = getIdempotencyKey(scope);
  const result = await fn(key);
  clearIdempotencyKey(scope);
  return result;
}
