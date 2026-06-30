const DEFAULT_TTL_MS = 8_000

type CacheEntry<T> = {
  data: T
  fetchedAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export const PAGE_CACHE_KEYS = {
  home: "page:home",
  wallet: "page:wallet",
  channels: "page:channels",
  network: "page:network",
} as const

export function getPageCache<T>(
  key: string,
  ttlMs = DEFAULT_TTL_MS,
): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > ttlMs) {
    store.delete(key)
    return null
  }
  return entry.data
}

export function setPageCache<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() })
}

export function invalidatePageCaches(...keys: string[]): void {
  if (keys.length === 0) {
    store.clear()
    return
  }

  for (const key of keys) {
    store.delete(key)
  }
}
