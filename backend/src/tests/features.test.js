import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import Discount from '../models/Discount.js';
import { redisClient, connectionStatus } from '../config/redis.js';

// Setup Mock Redis Store
const mockRedisStore = new Map();
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  process.env.NODE_ENV = 'test';

  // Spy and mock Redis connectionStatus and client methods
  jest.spyOn(connectionStatus, 'isConnected').mockReturnValue(true);
  
  jest.spyOn(redisClient, 'get').mockImplementation(async (key) => {
    return mockRedisStore.get(key) || null;
  });

  jest.spyOn(redisClient, 'set').mockImplementation(async (key, val) => {
    mockRedisStore.set(key, val);
    return 'OK';
  });

  jest.spyOn(redisClient, 'del').mockImplementation(async (key) => {
    if (Array.isArray(key)) {
      let count = 0;
      key.forEach(k => {
        if (mockRedisStore.delete(k)) count++;
      });
      return count;
    } else {
      return mockRedisStore.delete(key) ? 1 : 0;
    }
  });

  jest.spyOn(redisClient, 'ttl').mockImplementation(async (_key) => {
    return 3600; // Mock standard 1 hour remaining TTL
  });

  // Mock scanIterator to return matching keys in our mock in-memory map
  redisClient.scanIterator = jest.fn((options) => {
    const pattern = options.MATCH.replace('*', '');
    const matchedKeys = Array.from(mockRedisStore.keys()).filter(k => k.startsWith(pattern));
    
    return {
      async *[Symbol.asyncIterator]() {
        for (const key of matchedKeys) {
          yield key;
        }
      }
    };
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Discount.deleteMany({});
  mockRedisStore.clear();
  jest.clearAllMocks();
});

describe('New Features Integration Tests', () => {

  describe('Cache Inspector API', () => {
    it('should list all active products cache keys in Redis', async () => {
      // Seed keys in mock Redis
      mockRedisStore.set('products:list:page:1', 'List Data');
      mockRedisStore.set('products:detail:123', 'Detail Data');
      mockRedisStore.set('other:key', 'Other Data'); // Should be excluded by scanning products*

      const res = await request(app).get('/api/cache');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].key).toBe('products:detail:123');
      expect(res.body[1].key).toBe('products:list:page:1');
      expect(res.body[0].ttl).toBe(3600);
    });

    it('should purge a specific key from Redis', async () => {
      mockRedisStore.set('products:list:page:1', 'List Data');

      const res = await request(app)
        .post('/api/cache/purge-key')
        .send({ key: 'products:list:page:1' });

      expect(res.status).toBe(200);
      expect(mockRedisStore.has('products:list:page:1')).toBe(false);
    });

    it('should purge all cached product keys', async () => {
      mockRedisStore.set('products:list:page:1', 'List Data');
      mockRedisStore.set('products:detail:123', 'Detail Data');

      const res = await request(app).post('/api/cache/purge-all');
      expect(res.status).toBe(200);
      expect(mockRedisStore.has('products:list:page:1')).toBe(false);
      expect(mockRedisStore.has('products:detail:123')).toBe(false);
    });
  });

  describe('Discount Coupon Management API', () => {
    it('should list all coupons from MongoDB', async () => {
      await Discount.create({
        code: 'WELCOME10',
        discountPercent: 10,
        isActive: true
      });

      const res = await request(app).get('/api/discounts');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].code).toBe('WELCOME10');
    });

    it('should create a new discount coupon', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .send({
          code: 'WINTER40',
          discountPercent: 40
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('WINTER40');
      expect(res.body.discountPercent).toBe(40);

      const dbCoupon = await Discount.findOne({ code: 'WINTER40' });
      expect(dbCoupon).toBeTruthy();
    });

    it('should toggle a coupon active status', async () => {
      const coupon = await Discount.create({
        code: 'SUMMER20',
        discountPercent: 20,
        isActive: true
      });

      const res = await request(app).put(`/api/discounts/${coupon._id}/toggle`);
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      const dbCoupon = await Discount.findById(coupon._id);
      expect(dbCoupon.isActive).toBe(false);
    });
  });
});
