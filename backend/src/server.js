/**
 * Express Server Entry Point
 * Initializes middleware, routes, and database connections.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import cacheRoutes from './routes/cacheRoutes.js';
import discountRoutes from './routes/discountRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for dev, customizable in production
  exposedHeaders: ['X-Cache'] // Expose the cache header so client can read it
}));
app.use(express.json());

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/discounts', discountRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date(),
    env: process.env.NODE_ENV
  });
});

// Setup server startup function
const startServer = async () => {
  // Only connect to services and bind port if we are not running unit tests
  if (process.env.NODE_ENV !== 'test') {
    try {
      await connectDB();
      await connectRedis();
      app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      });
    } catch (err) {
      console.error('Server failed to start:', err.message);
      process.exit(1);
    }
  }
};

startServer();

export default app; // Export for integration tests
