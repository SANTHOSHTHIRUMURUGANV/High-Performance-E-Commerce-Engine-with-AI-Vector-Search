import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = createClient({
  url: redisUrl,
});

let isRedisConnected = false;

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
  isRedisConnected = false;
});

redisClient.on('connect', () => {
  console.log('Redis Client Connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis Client Ready and Connected');
  isRedisConnected = true;
});

redisClient.on('end', () => {
  console.log('Redis Client Connection Closed');
  isRedisConnected = false;
});

const connectRedis = async () => {
  if (process.env.NODE_ENV === 'test') {
    console.log('Test environment detected. Skipping real Redis connection.');
    return;
  }

  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Could not connect to Redis. Caching will be disabled. Error:', err.message);
    isRedisConnected = false;
  }
};

/**
 * Encapsulates the connection state.
 * Using an object method allows easy spying/stubbing in ESM test suites.
 */
const connectionStatus = {
  isConnected() {
    return isRedisConnected && redisClient.isOpen;
  }
};

export { redisClient, connectRedis, connectionStatus };
