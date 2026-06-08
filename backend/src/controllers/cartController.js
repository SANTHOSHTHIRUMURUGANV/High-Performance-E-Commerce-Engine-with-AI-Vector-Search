import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Discount from '../models/Discount.js';
import { invalidateCache } from '../utils/cache.js';

/**
 * POST /api/cart/calculate
 * Uses a Mongoose aggregation pipeline to fetch product pricing, calculate subtotals, 
 * validate and apply discount codes, and return the complete cart cost breakdown.
 */
export const calculateTotal = async (req, res) => {
  try {
    const { items, discountCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required and must be an array.' });
    }

    // Convert items into ObjectIds and map quantities for the aggregation
    const itemsMapped = items.map(item => {
      try {
        return {
          productId: new mongoose.Types.ObjectId(item.productId),
          quantity: parseInt(item.quantity, 10) || 0
        };
      } catch (err) {
        throw new Error(`Invalid Product ID: ${item.productId}`);
      }
    });

    // Extract product IDs for the aggregation matching stage
    const productIds = itemsMapped.map(item => item.productId);

    // Build the aggregation pipeline to calculate sub-totals
    const pipeline = [
      {
        $match: {
          _id: { $in: productIds }
        }
      },
      {
        $addFields: {
          quantity: {
            $let: {
              vars: {
                matchedItem: {
                  $filter: {
                    input: itemsMapped,
                    as: 'item',
                    cond: { $eq: ['$$item.productId', '$_id'] }
                  }
                }
              },
              in: { $arrayElemAt: ['$$matchedItem.quantity', 0] }
            }
          }
        }
      },
      {
        $project: {
          title: 1,
          price: 1,
          inventory: 1,
          imageUrl: 1,
          quantity: 1,
          subtotal: { $multiply: ['$price', '$quantity'] }
        }
      },
      {
        $group: {
          _id: null,
          cartItems: { $push: '$$ROOT' },
          subtotal: { $sum: '$subtotal' }
        }
      }
    ];

    const aggregationResult = await Product.aggregate(pipeline);

    if (aggregationResult.length === 0) {
      return res.status(200).json({
        cartItems: [],
        subtotal: 0,
        discountApplied: null,
        discountAmount: 0,
        total: 0
      });
    }

    const cartResult = aggregationResult[0];
    let subtotal = parseFloat(cartResult.subtotal.toFixed(2));
    let discountApplied = null;
    let discountAmount = 0;

    // Check and validate discount code
    if (discountCode) {
      const codeClean = discountCode.trim().toUpperCase();
      const discount = await Discount.findOne({ code: codeClean, isActive: true });
      
      if (discount) {
        // Check expiration date if it exists
        const isExpired = discount.expiresAt && new Date() > discount.expiresAt;
        if (!isExpired) {
          discountApplied = {
            code: discount.code,
            discountPercent: discount.discountPercent
          };
          discountAmount = parseFloat((subtotal * (discount.discountPercent / 100)).toFixed(2));
        }
      }
    }

    const total = parseFloat((subtotal - discountAmount).toFixed(2));

    return res.status(200).json({
      cartItems: cartResult.cartItems,
      subtotal,
      discountApplied,
      discountAmount,
      total: total < 0 ? 0 : total
    });
  } catch (error) {
    console.error('calculateTotal Error:', error);
    return res.status(500).json({ message: 'Error calculating cart total', error: error.message });
  }
};

/**
 * POST /api/cart/checkout
 * Processes order checkout. Decrements stock levels inside a MongoDB transaction.
 * Falls back to atomic updates if standalone MongoDB (no replica set) is used.
 */
export const checkout = async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Cart items are required for checkout.' });
  }

  // Attempt using Mongoose Sessions / Transactions
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const productUpdates = [];

    // Verify stock levels and prepare updates in transaction
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (product.inventory < item.quantity) {
        throw new Error(`Insufficient stock for "${product.title}". Requested: ${item.quantity}, Available: ${product.inventory}`);
      }

      product.inventory -= item.quantity;
      productUpdates.push(product);
    }

    // Save all updated inventory states
    for (const product of productUpdates) {
      await product.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Invalidate product detail caches and list caches since stock counts changed
    for (const item of items) {
      await invalidateCache(`products:detail:${item.productId}`);
    }
    await invalidateCache('products:list:*');
    await invalidateCache('products:stats');

    return res.status(200).json({ message: 'Checkout successful! Inventory updated.' });
  } catch (error) {
    // Rollback session changes
    await session.abortTransaction();
    session.endSession();

    // Check if error is due to MongoDB deployment limitations (no replica set)
    const isReplicaSetError = 
      error.message.includes('replica set') || 
      error.message.includes('transaction') || 
      error.message.includes('sessions');

    if (isReplicaSetError) {
      console.warn('[Checkout] Transactions not supported by local MongoDB. Falling back to non-transactional updates.');
      return handleCheckoutFallback(items, res);
    }

    console.error('Checkout Error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * Fallback checkout handler for standalone MongoDB installations.
 * Processes items sequentially using standard atomic updates.
 */
const handleCheckoutFallback = async (items, res) => {
  try {
    const productsToUpdate = [];

    // Step 1: Pre-verify all items before writing (simulate transaction safety)
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }
      if (product.inventory < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for "${product.title}". Requested: ${item.quantity}, Available: ${product.inventory}` 
        });
      }
      productsToUpdate.push({ product, quantity: item.quantity });
    }

    // Step 2: Atomic writes
    for (const { product, quantity } of productsToUpdate) {
      product.inventory -= quantity;
      await product.save();
      await invalidateCache(`products:detail:${product._id}`);
    }

    await invalidateCache('products:list:*');
    await invalidateCache('products:stats');

    return res.status(200).json({ message: 'Checkout successful! (Local non-transactional fallback)' });
  } catch (error) {
    console.error('Checkout Fallback Error:', error);
    return res.status(500).json({ message: 'Error processing fallback checkout', error: error.message });
  }
};
