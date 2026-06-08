import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import Product from '../models/Product.js';
import Discount from '../models/Discount.js';
import { redisClient, connectionStatus } from '../config/redis.js';

// Setup Mock Redis Store
const mockRedisStore = new Map();
let mongoServer;

beforeAll(async () => {
  // Setup in-memory MongoDB
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
  // Clear databases and cache mock
  await Product.deleteMany({});
  await Discount.deleteMany({});
  mockRedisStore.clear();
  jest.clearAllMocks();
});

describe('High Performance E-Commerce API Tests', () => {
  
  describe('Product API with Redis Cache-Aside Pattern', () => {
    
    it('should fetch products from DB on cache miss and save to Redis', async () => {
      // Seed a product
      await Product.create({
        title: 'Sony Premium Headphone',
        description: 'Noise canceling high quality headphone.',
        category: 'Electronics',
        price: 199.99,
        inventory: 100,
        imageUrl: '/images/sony.jpg'
      });

      // 1. First Call: Cache Miss
      const res1 = await request(app).get('/api/products');
      expect(res1.status).toBe(200);
      expect(res1.headers['x-cache']).toBe('MISS');
      expect(res1.body.products).toHaveLength(1);
      expect(res1.body.products[0].title).toBe('Sony Premium Headphone');

      // Check if saved to Redis
      const expectedKey = 'products:list:page:1:limit:12:cat:all:search:none';
      expect(mockRedisStore.has(expectedKey)).toBe(true);

      // 2. Second Call: Cache Hit
      const res2 = await request(app).get('/api/products');
      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('HIT');
      expect(res2.body.products).toHaveLength(1);
    });

    it('should fetch a single product and cache it', async () => {
      const product = await Product.create({
        title: 'Apple Watch',
        description: 'Smartwatch with heart rate monitor.',
        category: 'Electronics',
        price: 399.99,
        inventory: 50,
        imageUrl: '/images/apple.jpg'
      });

      const detailKey = `products:detail:${product._id}`;

      // First call -> MISS
      const res1 = await request(app).get(`/api/products/${product._id}`);
      expect(res1.status).toBe(200);
      expect(res1.headers['x-cache']).toBe('MISS');
      expect(mockRedisStore.has(detailKey)).toBe(true);

      // Second call -> HIT
      const res2 = await request(app).get(`/api/products/${product._id}`);
      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('HIT');
    });

    it('should invalidate list cache when a new product is created', async () => {
      // Set some dummy list data in cache
      const listKey = 'products:list:page:1:limit:12:cat:all:search:none';
      mockRedisStore.set(listKey, JSON.stringify({ products: [] }));

      // Create product
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Nike Running Shoes',
          description: 'Comfortable sports shoes.',
          category: 'Footwear',
          price: 89.99,
          inventory: 120,
          imageUrl: '/images/nike.jpg'
        });

      expect(res.status).toBe(201);
      // Cache list should be invalidated
      expect(mockRedisStore.has(listKey)).toBe(false);
    });

    it('should invalidate specific product cache and lists when product is updated', async () => {
      const product = await Product.create({
        title: 'Dyson Vacuum',
        description: 'Powerful bagless vacuum cleaner.',
        category: 'Home',
        price: 499.99,
        inventory: 30,
        imageUrl: '/images/dyson.jpg'
      });

      const listKey = 'products:list:page:1:limit:12:cat:all:search:none';
      const detailKey = `products:detail:${product._id}`;

      mockRedisStore.set(listKey, JSON.stringify({ products: [product] }));
      mockRedisStore.set(detailKey, JSON.stringify(product));

      const res = await request(app)
        .put(`/api/products/${product._id}`)
        .send({
          price: 449.99
        });

      expect(res.status).toBe(200);
      // Both keys should be invalidated
      expect(mockRedisStore.has(listKey)).toBe(false);
      expect(mockRedisStore.has(detailKey)).toBe(false);
    });
  });

  describe('Vector Search (Semantic Product Discovery)', () => {
    it('should perform vector similarity search on mock embeddings', async () => {
      const p1 = new Product({
        title: 'Winter Parka Coat',
        description: 'Thick heavy winter jacket for snowy weather.',
        category: 'Clothing',
        price: 150.00,
        inventory: 10,
        imageUrl: '/images/parka.jpg'
      });
      p1.embedding = new Array(384).fill(0);
      p1.embedding[0] = 1.0;
      await p1.save();

      const p2 = new Product({
        title: 'Summer Swim Shorts',
        description: 'Lightweight shorts for beach and pool swimming.',
        category: 'Clothing',
        price: 30.00,
        inventory: 25,
        imageUrl: '/images/shorts.jpg'
      });
      p2.embedding = new Array(384).fill(0);
      p2.embedding[1] = 1.0;
      await p2.save();

      // Mock the getEmbedding helper directly
      const { embeddingsService } = await import('../utils/embeddings.js');
      jest.spyOn(embeddingsService, 'getEmbedding').mockImplementation(async (text) => {
        const vec = new Array(384).fill(0);
        if (text.includes('winter') || text.includes('snow')) {
          vec[0] = 1.0; // Close to p1
        } else {
          vec[1] = 1.0; // Close to p2
        }
        return vec;
      });

      const res = await request(app).get('/api/products/search?q=winter snow coat');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].title).toBe('Winter Parka Coat');
      expect(res.body[0].score).toBeCloseTo(1.0, 2);
    });
  });

  describe('Cart Aggregation Pipeline & Transactions', () => {
    
    it('should calculate cart total and apply discounts using aggregation', async () => {
      // Seed products
      const p1 = await Product.create({
        title: 'Product A',
        description: 'Description A',
        category: 'Test',
        price: 10.00,
        inventory: 10,
        imageUrl: '/a.jpg'
      });
      const p2 = await Product.create({
        title: 'Product B',
        description: 'Description B',
        category: 'Test',
        price: 25.00,
        inventory: 5,
        imageUrl: '/b.jpg'
      });

      // Seed discount
      await Discount.create({
        code: 'SALE20',
        discountPercent: 20,
        isActive: true
      });

      const cartPayload = {
        items: [
          { productId: p1._id.toString(), quantity: 2 }, // 2 * 10 = 20
          { productId: p2._id.toString(), quantity: 1 }  // 1 * 25 = 25
        ],
        discountCode: 'SALE20'
      };

      const res = await request(app)
        .post('/api/cart/calculate')
        .send(cartPayload);

      expect(res.status).toBe(200);
      expect(res.body.subtotal).toBe(45.00); // 20 + 25
      expect(res.body.discountAmount).toBe(9.00); // 45 * 0.20
      expect(res.body.total).toBe(36.00); // 45 - 9
      expect(res.body.discountApplied.code).toBe('SALE20');
      expect(res.body.cartItems).toHaveLength(2);
    });

    it('should successfully checkout and decrement inventory', async () => {
      const product = await Product.create({
        title: 'Laptop Computer',
        description: 'Workstation laptop.',
        category: 'Electronics',
        price: 999.00,
        inventory: 5,
        imageUrl: '/laptop.jpg'
      });

      const listKey = 'products:list:page:1:limit:12:cat:all:search:none';
      const detailKey = `products:detail:${product._id}`;
      mockRedisStore.set(listKey, 'Cached List');
      mockRedisStore.set(detailKey, 'Cached Detail');

      const checkoutPayload = {
        items: [
          { productId: product._id.toString(), quantity: 2 }
        ]
      };

      const res = await request(app)
        .post('/api/cart/checkout')
        .send(checkoutPayload);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successful');

      // Verify DB stock is decremented
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.inventory).toBe(3);

      // Verify caches were invalidated
      expect(mockRedisStore.has(listKey)).toBe(false);
      expect(mockRedisStore.has(detailKey)).toBe(false);
    });

    it('should fail checkout if inventory is insufficient', async () => {
      const product = await Product.create({
        title: 'Only One Item Left',
        description: 'Rare item.',
        category: 'Collectibles',
        price: 15.00,
        inventory: 1,
        imageUrl: '/rare.jpg'
      });

      const checkoutPayload = {
        items: [
          { productId: product._id.toString(), quantity: 2 }
        ]
      };

      const res = await request(app)
        .post('/api/cart/checkout')
        .send(checkoutPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');

      // Verify stock was not decremented
      const sameProduct = await Product.findById(product._id);
      expect(sameProduct.inventory).toBe(1);
    });
  });
});
