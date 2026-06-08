import { redisClient, connectionStatus } from '../config/redis.js';

/**
 * GET /api/cache
 * Scans Redis memory for active keys and returns their key names and TTLs.
 */
export const getCacheKeys = async (req, res) => {
  if (!connectionStatus.isConnected()) {
    res.setHeader('X-Cache', 'BYPASS');
    return res.status(200).json([]); // Return empty list gracefully if Redis is offline
  }

  try {
    const keysMap = [];
    // Scan all keys matching "products*" pattern
    for await (const key of redisClient.scanIterator({ MATCH: 'products*' })) {
      const ttl = await redisClient.ttl(key);
      keysMap.push({ key, ttl });
    }
    
    // Sort keys alphabetically for clean display
    keysMap.sort((a, b) => a.key.localeCompare(b.key));
    
    return res.status(200).json(keysMap);
  } catch (error) {
    console.error('getCacheKeys Error:', error);
    return res.status(500).json({ message: 'Error scanning cache keys', error: error.message });
  }
};

/**
 * DELETE /api/cache/purge-key
 * Deletes a specific cache key.
 */
export const purgeKey = async (req, res) => {
  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ message: 'Cache key name is required to purge.' });
  }

  if (!connectionStatus.isConnected()) {
    return res.status(503).json({ message: 'Redis is disconnected. Cannot purge key.' });
  }

  try {
    const deleted = await redisClient.del(key);
    if (deleted) {
      return res.status(200).json({ message: `Cache key "${key}" purged successfully.` });
    } else {
      return res.status(404).json({ message: `Cache key "${key}" not found or already expired.` });
    }
  } catch (error) {
    console.error('purgeKey Error:', error);
    return res.status(500).json({ message: 'Error purging key', error: error.message });
  }
};

/**
 * DELETE /api/cache/purge-all
 * Deletes all keys matching the "products*" pattern.
 */
export const purgeAllCache = async (req, res) => {
  if (!connectionStatus.isConnected()) {
    return res.status(503).json({ message: 'Redis is disconnected. Cannot purge cache.' });
  }

  try {
    const keys = [];
    for await (const key of redisClient.scanIterator({ MATCH: 'products*' })) {
      keys.push(key);
    }

    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`[Cache Administration] Purged all ${keys.length} keys from Redis.`);
      return res.status(200).json({ message: `Successfully cleared all ${keys.length} cached keys.` });
    }

    return res.status(200).json({ message: 'Cache was already empty.' });
  } catch (error) {
    console.error('purgeAllCache Error:', error);
    return res.status(500).json({ message: 'Error purging all cache keys', error: error.message });
  }
};
