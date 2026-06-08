import Product from '../models/Product.js';
import { embeddingsService } from '../utils/embeddings.js';
import { getCachedData, setCachedData, invalidateCache } from '../utils/cache.js';

/**
 * Helper to compute cosine similarity between two vectors.
 */
const calculateCosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * GET /api/products
 * Retrieves products with support for pagination, category filter, keyword search, and Redis caching.
 */
export const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const category = req.query.category || '';
    const search = req.query.search || '';

    // Generate a unique cache key based on query parameters
    const cacheKey = `products:list:page:${page}:limit:${limit}:cat:${category || 'all'}:search:${search || 'none'}`;

    // Try reading from cache
    const cachedResult = await getCachedData(cacheKey);
    if (cachedResult) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedResult);
    }

    // Cache miss: Build database query
    const query = {};
    if (category) {
      query.category = category;
    }
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    
    // Execute query and count in parallel
    const [products, total] = await Promise.all([
      Product.find(query)
        .select('-embedding') // Exclude heavy embedding vectors from catalog lists
        .skip(skip)
        .limit(limit)
        .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 }),
      Product.countDocuments(query)
    ]);

    const result = {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Cache the result for 1 hour
    await setCachedData(cacheKey, result, 3600);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);
  } catch (error) {
    console.error('getProducts Error:', error);
    return res.status(500).json({ message: 'Server error retrieving products', error: error.message });
  }
};

/**
 * GET /api/products/:id
 * Retrieves a single product by ID (cached).
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `products:detail:${id}`;

    // Try reading from cache
    const cachedProduct = await getCachedData(cacheKey);
    if (cachedProduct) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedProduct);
    }

    // Cache miss: Fetch from MongoDB
    const product = await Product.findById(id).select('-embedding');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Cache product for 1 hour
    await setCachedData(cacheKey, product, 3600);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(product);
  } catch (error) {
    console.error('getProductById Error:', error);
    return res.status(500).json({ message: 'Server error retrieving product', error: error.message });
  }
};

/**
 * GET /api/products/stats
 * Retrieves total product count and low-stock count (cached).
 */
export const getProductStats = async (req, res) => {
  try {
    const cacheKey = 'products:stats';

    // Try reading from cache
    const cachedStats = await getCachedData(cacheKey);
    if (cachedStats) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedStats);
    }

    // Cache miss: Calculate stats from MongoDB
    const [totalProducts, lowStockCount] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ inventory: { $lt: 50 } })
    ]);

    const stats = { totalProducts, lowStockCount };

    // Cache stats for 30 minutes
    await setCachedData(cacheKey, stats, 1800);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(stats);
  } catch (error) {
    console.error('getProductStats Error:', error);
    return res.status(500).json({ message: 'Error retrieving product stats', error: error.message });
  }
};

/**
 * POST /api/products
 * Creates a new product, generates its vector embedding, saves to DB, and invalidates list caches.
 */
export const createProduct = async (req, res) => {
  try {
    const { title, description, category, price, inventory, imageUrl } = req.body;

    // Validate inputs
    if (!title || !description || !category || price === undefined || inventory === undefined || !imageUrl) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Generate vector embedding
    const textToEmbed = `${title}. ${description} Category: ${category}.`;
    const embedding = await embeddingsService.getEmbedding(textToEmbed);

    const product = new Product({
      title,
      description,
      category,
      price,
      inventory,
      imageUrl,
      embedding
    });

    await product.save();

    // Cache invalidation: Clear catalog lists and search results
    await invalidateCache('products:list:*');
    await invalidateCache('products:search:*');
    await invalidateCache('products:stats');

    // Remove embedding from response payload
    const responseData = product.toObject();
    delete responseData.embedding;

    return res.status(201).json(responseData);
  } catch (error) {
    console.error('createProduct Error:', error);
    return res.status(500).json({ message: 'Server error creating product', error: error.message });
  }
};

/**
 * PUT /api/products/:id
 * Updates an existing product, updates embedding if descriptive fields changed, invalidates cache keys.
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, price, inventory, imageUrl } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if fields that affect the vector embedding were updated
    const needsNewEmbedding = 
      (title && title !== product.title) || 
      (description && description !== product.description) || 
      (category && category !== product.category);

    if (title) product.title = title;
    if (description) product.description = description;
    if (category) product.category = category;
    if (price !== undefined) product.price = price;
    if (inventory !== undefined) product.inventory = inventory;
    if (imageUrl) product.imageUrl = imageUrl;

    if (needsNewEmbedding) {
      const textToEmbed = `${product.title}. ${product.description} Category: ${product.category}.`;
      product.embedding = await embeddingsService.getEmbedding(textToEmbed);
    }

    await product.save();

    // Cache Invalidation
    await invalidateCache(`products:detail:${id}`);
    await invalidateCache('products:list:*');
    await invalidateCache('products:search:*');
    await invalidateCache('products:stats');

    const responseData = product.toObject();
    delete responseData.embedding;

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('updateProduct Error:', error);
    return res.status(500).json({ message: 'Server error updating product', error: error.message });
  }
};

/**
 * DELETE /api/products/:id
 * Removes a product and invalidates cache keys.
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Cache Invalidation
    await invalidateCache(`products:detail:${id}`);
    await invalidateCache('products:list:*');
    await invalidateCache('products:search:*');
    await invalidateCache('products:stats');

    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('deleteProduct Error:', error);
    return res.status(500).json({ message: 'Server error deleting product', error: error.message });
  }
};

/**
 * GET /api/products/search
 * Handles semantic / vector search.
 */
export const semanticSearch = async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit, 10) || 10;

    if (!query) {
      return res.status(400).json({ message: 'Search query parameter "q" is required' });
    }

    // Check Redis cache first
    const cacheKey = `products:search:q:${query.replace(/\s+/g, '_')}:limit:${limit}`;
    const cachedResults = await getCachedData(cacheKey);
    if (cachedResults) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedResults);
    }

    // Generate embedding for search query
    const queryEmbedding = await embeddingsService.getEmbedding(query);

    let results = [];
    const searchMode = process.env.VECTOR_SEARCH_MODE || 'local';

    if (searchMode === 'atlas') {
      try {
        // Run native MongoDB Atlas Vector Search
        results = await Product.aggregate([
          {
            $vectorSearch: {
              index: 'vector_index',
              path: 'embedding',
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: limit
            }
          },
          {
            // Project fields and exclude raw embedding vector
            $project: {
              title: 1,
              description: 1,
              category: 1,
              price: 1,
              inventory: 1,
              imageUrl: 1,
              score: { $meta: 'searchScore' }
            }
          }
        ]);
        console.log(`[Vector Search] Executed MongoDB Atlas Vector Search for: "${query}"`);
      } catch (atlasError) {
        console.warn('[Vector Search] Atlas Vector Search failed or not supported. Falling back to local search. Error:', atlasError.message);
        results = []; // Trigger local fallback below
      }
    }

    // Local similarity fallback if mode is local OR Atlas search failed/was skipped
    if (results.length === 0) {
      console.log(`[Vector Search] Executed local vector similarity search for: "${query}"`);
      // Retrieve products with embeddings from the database
      // Limit to 500 documents for local performance bounds in dev
      const products = await Product.find({ embedding: { $exists: true } }).limit(500);

      // Map similarity score
      results = products
        .map(product => {
          const score = calculateCosineSimilarity(queryEmbedding, product.embedding);
          const obj = product.toObject();
          delete obj.embedding; // Remove embedding from payload
          return {
            ...obj,
            score
          };
        })
        // Filter out poor matches (e.g. similarity less than 0.1) and sort descending by score
        .filter(item => item.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    // Cache search results for 30 minutes (1800s)
    await setCachedData(cacheKey, results, 1800);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(results);
  } catch (error) {
    console.error('semanticSearch Error:', error);
    return res.status(500).json({ message: 'Server error performing semantic search', error: error.message });
  }
};
