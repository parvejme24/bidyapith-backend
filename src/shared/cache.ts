import { createHash } from 'crypto';
import { getRedis } from './redis';

export const queryHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

export const cached = async <T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> => {
  const redis = getRedis();
  if (redis !== null) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) {
        return JSON.parse(hit) as T;
      }
    } catch {
      // Redis down — fall through. Never fail the request.
    }
  }

  const fresh = await fn();

  if (redis !== null) {
    redis.setex(key, ttlSeconds, JSON.stringify(fresh)).catch(() => {
      // Ignore cache write failures.
    });
  }

  return fresh;
};

export const invalidateKeys = async (...keys: string[]): Promise<void> => {
  const redis = getRedis();
  if (redis === null || keys.length === 0) {
    return;
  }
  try {
    await redis.del(...keys);
  } catch {
    // Ignore cache invalidation failures.
  }
};
