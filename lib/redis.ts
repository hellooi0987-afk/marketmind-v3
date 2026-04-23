// lib/redis.ts - Upstash Redis client for caching

import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      throw new Error('Missing Upstash Redis credentials');
    }
    
    redis = new Redis({
      url,
      token,
    });
  }
  
  return redis;
}

export async function cacheSet(key: string, value: any, ttl?: number): Promise<void> {
  const client = getRedisClient();
  const serialized = JSON.stringify(value);
  
  if (ttl) {
    await client.setex(key, ttl, serialized);
  } else {
    await client.set(key, serialized);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);
  
  if (!value) return null;
  
  try {
    return JSON.parse(value as string) as T;
  } catch {
    return value as T;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  const client = getRedisClient();
  const exists = await client.exists(key);
  return exists === 1;
}

// Cache key builders
export const CacheKeys = {
  ohlc: (asset: string, period: string) => `ohlc:${asset}:${period}`,
  indicators: (asset: string, period: string) => `indicators:${asset}:${period}`,
  macro: (asset: string) => `macro:${asset}`,
  assetSpecific: (asset: string) => `asset-specific:${asset}`,
  agentMemory: (agent: string, asset: string) => `agent:${agent}:${asset}`,
  simulation: (id: string) => `simulation:${id}`,
};
