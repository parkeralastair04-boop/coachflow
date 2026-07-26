import "server-only";

import { logger } from "@/lib/logger";

export type RateLimitIncrementResult = {
  count: number;
  /** Absolute ms timestamp when the current window ends. */
  resetAt: number;
};

export type RateLimitStoreBackend = "memory" | "upstash";

export interface RateLimitStore {
  readonly backend: RateLimitStoreBackend;
  /**
   * Increment the counter for `key` in a fixed window of `windowMs`.
   * Returns the new count and when the window resets.
   */
  increment(key: string, windowMs: number): Promise<RateLimitIncrementResult>;
}

type MemoryBucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();
const MAX_KEYS = 20_000;

function pruneMemory(now: number) {
  if (memoryBuckets.size < MAX_KEYS) return;
  for (const [key, value] of memoryBuckets) {
    if (value.resetAt <= now) memoryBuckets.delete(key);
  }
  if (memoryBuckets.size < MAX_KEYS) return;
  const entries = [...memoryBuckets.entries()].sort(
    (a, b) => a[1].resetAt - b[1].resetAt,
  );
  for (let i = 0; i < Math.ceil(entries.length / 4); i += 1) {
    memoryBuckets.delete(entries[i]![0]);
  }
}

class MemoryRateLimitStore implements RateLimitStore {
  readonly backend = "memory" as const;

  async increment(key: string, windowMs: number): Promise<RateLimitIncrementResult> {
    const now = Date.now();
    pruneMemory(now);

    const existing = memoryBuckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      memoryBuckets.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }

    existing.count += 1;
    memoryBuckets.set(key, existing);
    return { count: existing.count, resetAt: existing.resetAt };
  }
}

/**
 * Upstash Redis REST store (optional).
 * Uses fixed windows keyed by `${key}:${windowId}` so counters share across instances.
 */
class UpstashRateLimitStore implements RateLimitStore {
  readonly backend = "upstash" as const;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const response = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Upstash pipeline HTTP ${response.status}`);
    }
    const rows = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    if (!Array.isArray(rows)) {
      throw new Error("Upstash pipeline returned unexpected payload");
    }
    for (const row of rows) {
      if (row.error) throw new Error(row.error);
    }
    return rows.map((row) => row.result);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitIncrementResult> {
    const now = Date.now();
    const windowId = Math.floor(now / windowMs);
    const resetAt = (windowId + 1) * windowMs;
    const redisKey = `cf:rl:${key}:${windowId}`;
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000) + 1);

    const results = await this.pipeline([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, ttlSeconds],
    ]);
    const count = Number(results[0] ?? 0);
    if (!Number.isFinite(count) || count < 1) {
      throw new Error("Upstash INCR returned invalid count");
    }
    return { count, resetAt };
  }
}

const memoryStore = new MemoryRateLimitStore();
let cachedStore: RateLimitStore | null = null;

function createConfiguredStore(): RateLimitStore {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    return new UpstashRateLimitStore(url, token);
  }
  return memoryStore;
}

export function getRateLimitStore(): RateLimitStore {
  if (!cachedStore) {
    cachedStore = createConfiguredStore();
  }
  return cachedStore;
}

/** Test helper — reset process-local cache (memory buckets retained). */
export function resetRateLimitStoreCacheForTests() {
  cachedStore = null;
}

/**
 * Increment via configured store; on Upstash failure, fall back to memory
 * so a Redis outage does not take public APIs offline.
 */
export async function incrementRateLimit(
  key: string,
  windowMs: number,
): Promise<RateLimitIncrementResult & { backend: RateLimitStoreBackend }> {
  const store = getRateLimitStore();
  if (store.backend === "memory") {
    const result = await store.increment(key, windowMs);
    return { ...result, backend: "memory" };
  }

  try {
    const result = await store.increment(key, windowMs);
    return { ...result, backend: store.backend };
  } catch (error) {
    logger.warn("security", "Rate limit Upstash failed; using memory fallback", {
      detail: error instanceof Error ? error.message : "unknown",
    });
    const result = await memoryStore.increment(key, windowMs);
    return { ...result, backend: "memory" };
  }
}
