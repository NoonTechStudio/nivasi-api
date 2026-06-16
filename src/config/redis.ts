import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (err) => console.error(`[Redis] Error: ${err.message}`));
redis.on('connect', () => console.log(`[Redis] Connected to ${env.REDIS_URL}`));
redis.on('reconnecting', () => console.warn('[Redis] Reconnecting...'));
