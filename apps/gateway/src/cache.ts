export interface CacheEntry {
  tenantId: string;
  tenantSlug: string;
  plan: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 1000;
const TTL_MS = 5 * 60 * 1000;

export function getCached(keyPrefix: string): CacheEntry | null {
  const entry = cache.get(keyPrefix);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(keyPrefix);
    return null;
  }

  cache.delete(keyPrefix);
  cache.set(keyPrefix, entry);
  return entry;
}

export function setCached(keyPrefix: string, entry: Omit<CacheEntry, 'expiresAt'>): void {
  const now = Date.now();

  for (const [key, value] of cache.entries()) {
    if (value.expiresAt <= now) {
      cache.delete(key);
    }
  }

  cache.delete(keyPrefix);
  cache.set(keyPrefix, {
    ...entry,
    expiresAt: now + TTL_MS,
  });

  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
}

export function invalidate(keyPrefix: string): void {
  cache.delete(keyPrefix);
}
