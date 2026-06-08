import { redisClient, connectionStatus } from '../config/redis.js';

/**
 * Fetches JSON-parsed data from Redis.
 * Returns null if cache miss, client is disconnected, or an error occurs.
 */
export const getCachedData = async (key) => {
  if (!connectionStatus.isConnected()) {
    return null;
  }
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (err) {
    console.error(`[Redis Cache-Aside] Error reading key "${key}":`, err.message);
    return null;
  }
};

/**
 * Serializes and saves data to Redis with an expiration TTL (in seconds).
 */
export const setCachedData = async (key, value, ttlSeconds = 3600) => {
  if (!connectionStatus.isConnected()) {
    return false;
  }
  try {
    const serialized = JSON.stringify(value);
    await redisClient.set(key, serialized, {
      EX: ttlSeconds,
    });
    return true;
  } catch (err) {
    console.error(`[Redis Cache-Aside] Error setting key "${key}":`, err.message);
    return false;
  }
};

/**
 * Deletes a single key or multiple keys matching a pattern.
 * Pattern must contain '*' (e.g. "products:*").
 */
export const invalidateCache = async (patternOrKey) => {
  if (!connectionStatus.isConnected()) {
    return false;
  }
  try {
    if (patternOrKey.includes('*')) {
      const keysToDelete = [];
      for await (const key of redisClient.scanIterator({ MATCH: patternOrKey })) {
        keysToDelete.push(key);
      }
      
      if (keysToDelete.length > 0) {
        await redisClient.del(keysToDelete);
        console.log(`[Redis Cache-Aside] Invalided ${keysToDelete.length} keys matching pattern: "${patternOrKey}"`);
      }
    } else {
      await redisClient.del(patternOrKey);
      console.log(`[Redis Cache-Aside] Invalidated key: "${patternOrKey}"`);
    }
    return true;
  } catch (err) {
    console.error(`[Redis Cache-Aside] Error invalidating "${patternOrKey}":`, err.message);
    return false;
  }
};
