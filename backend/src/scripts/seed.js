import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';
import Discount from '../models/Discount.js';
import { embeddingsService } from '../utils/embeddings.js';

const BRANDS = [
  'Sony', 'Apple', 'Samsung', 'Dell', 'Nike', 'Adidas', 'Puma', 'Levi\'s', 
  'Patagonia', 'Dyson', 'Cuisinart', 'Under Armour', 'Logitech', 'Bose', 'Anker'
];

const DESCRIPTORS = [
  'Ultra', 'Pro', 'Premium', 'Eco-Friendly', 'Waterproof', 'Wireless', 
  'Ergonomic', 'Smart', 'Classic', 'Vintage', 'Elite', 'Comfort', 'HD', 'Minimalist'
];

const PRODUCTS_BY_CAT = {
  Electronics: [
    { name: 'Noise-Canceling Headphones', desc: 'Over-ear headphones with active noise cancellation and high-fidelity sound.' },
    { name: 'Curved Gaming Monitor', desc: 'High-refresh-rate ultra-wide monitor for immersive gaming experience.' },
    { name: 'Mechanical Keyboard', desc: 'Tactile mechanical keyboard with RGB backlighting and custom switches.' },
    { name: 'Fast-Charging Power Bank', desc: 'High-capacity external battery pack with power delivery USB-C ports.' },
    { name: 'Bluetooth Speaker', desc: 'Portable waterproof speaker with deep bass and long-lasting battery life.' },
    { name: '4K Webcam', desc: 'Ultra-high-definition streaming camera with built-in autofocus and ring light.' },
    { name: 'Smart Fitness Band', desc: 'Activity tracker with heart rate monitor, sleep tracking, and GPS.' }
  ],
  Clothing: [
    { name: 'All-Weather Windbreaker', desc: 'Lightweight, windproof, and water-resistant jacket for outdoor adventure.' },
    { name: 'Organic Cotton Hoodie', desc: 'Super-soft, fleece-lined hooded sweatshirt made from sustainable materials.' },
    { name: 'Athletic Joggers', desc: 'Breathable, moisture-wicking sweatpants designed for training and lounge.' },
    { name: 'Thermal Base Layer', desc: 'Snug-fit undergarment providing exceptional warmth in freezing conditions.' },
    { name: 'Merino Wool Socks', desc: 'Cushioned outdoor socks that regulate temperature and prevent odor.' },
    { name: 'Stretch Denim Jeans', desc: 'Classic slim-fit blue jeans with enhanced flexibility for daily wear.' },
    { name: 'Water-Resistant Parka', desc: 'Heavyweight winter coat with synthetic down insulation and faux-fur hood.' }
  ],
  Footwear: [
    { name: 'Trail Running Shoes', desc: 'Durable running shoes with rugged grip and shock-absorbing soles.' },
    { name: 'Cushioned Sneakers', desc: 'Everyday casual sneakers with memory foam insoles for max comfort.' },
    { name: 'Waterproof Hiking Boots', desc: 'Ankle-support boots with waterproof membrane for wet and rocky trails.' },
    { name: 'Slip-Resistant Work Shoes', desc: 'Professional utility shoes with safety toe and oil-resistant outsole.' },
    { name: 'Breathable Sandals', desc: 'Adjustable strap sport sandals with contoured footbeds for summer walks.' }
  ],
  'Home & Kitchen': [
    { name: 'Programmable Coffee Maker', desc: '12-cup drip coffee machine with auto-start timer and strength control.' },
    { name: 'High-Speed Blender', desc: 'Professional countertop blender with ice-crushing blades and pre-sets.' },
    { name: 'Digital Air Fryer', desc: 'Multi-functional cooker using convection heat to fry foods with minimal oil.' },
    { name: 'Non-Stick Frying Pan', desc: 'Hard-anodized aluminum skillet with durable scratch-resistant coating.' },
    { name: 'Stainless Steel Kettle', desc: 'Rapid-boil electric water kettle with automatic shut-off safety.' }
  ],
  'Sports & Outdoors': [
    { name: 'Double-Wall Water Bottle', desc: 'Vacuum insulated stainless steel flask that keeps drinks cold for 24 hours.' },
    { name: 'Lightweight Backpack', desc: 'Compact daypack with multiple compartments and hydration bladder sleeve.' },
    { name: 'Premium Yoga Mat', desc: 'Extra thick non-slip exercise mat for yoga, pilates, and floor workouts.' },
    { name: 'Adjustable Dumbbell', desc: 'Space-saving free weight set with selector dial for customizable loading.' },
    { name: '4-Person Camping Tent', desc: 'Easy-setup dome tent with rainfly and mesh windows for ventilation.' }
  ]
};

const COLORS = ['Black', 'White', 'Space Gray', 'Forest Green', 'Navy Blue', 'Crimson Red', 'Silver', 'Charcoal'];

const generateMockProducts = () => {
  const products = [];
  const categories = Object.keys(PRODUCTS_BY_CAT);

  // Generate 1000 products by combining templates
  let count = 0;
  const targetCount = 1050;

  while (count < targetCount) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const items = PRODUCTS_BY_CAT[category];
    const template = items[Math.floor(Math.random() * items.length)];
    
    const brand = BRANDS[Math.floor(Math.random() * BRANDS.length)];
    const descriptor = DESCRIPTORS[Math.floor(Math.random() * DESCRIPTORS.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    const title = `${brand} ${descriptor} ${template.name} (${color})`;
    
    // Check for uniqueness
    if (products.some(p => p.title === title)) {
      continue;
    }

    const price = parseFloat((Math.random() * 250 + 10).toFixed(2));
    const inventory = Math.floor(Math.random() * 500) + 10;
    
    // Create custom description
    const description = `This is the premium ${brand} ${descriptor} ${template.name} in ${color}. ${template.desc} Engineered for maximum efficiency and durability.`;
    
    // Custom placeholder image paths based on category
    const categorySlug = category.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const imageUrl = `/images/products/${categorySlug}-${count % 10 + 1}.jpg`;

    products.push({
      title,
      description,
      category,
      price,
      inventory,
      imageUrl
    });

    count++;
  }

  return products;
};

const seedDB = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Clearing database collection (Products & Discounts)...');
    await Product.deleteMany({});
    await Discount.deleteMany({});

    console.log('Seeding discount codes...');
    const discounts = [
      { code: 'WELCOME10', discountPercent: 10, isActive: true },
      { code: 'SUMMER20', discountPercent: 20, isActive: true },
      { code: 'MEGA30', discountPercent: 30, isActive: true },
      { code: 'EXP100', discountPercent: 100, isActive: true },
      { code: 'EXPIRED50', discountPercent: 50, isActive: false, expiresAt: new Date(2025, 0, 1) }
    ];
    await Discount.insertMany(discounts);
    console.log(`Successfully seeded ${discounts.length} discount codes.`);

    console.log('Generating 1000+ mock products...');
    const productsData = generateMockProducts();
    console.log(`Generated ${productsData.length} products structure. Computing vector embeddings...`);

    // Let's seed in batches of 50 to print progress and avoid overloading
    const batchSize = 50;
    const totalProducts = productsData.length;
    const seededProducts = [];

    // Pre-initialize embeddings model if needed
    console.log('Warm up embedding generator model...');
    await embeddingsService.getEmbedding('Warm up text');

    for (let i = 0; i < totalProducts; i += batchSize) {
      const batch = productsData.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (p) => {
        // Embed the title and description combined for rich semantics
        const textToEmbed = `${p.title}. ${p.description} Category: ${p.category}.`;
        const embedding = await embeddingsService.getEmbedding(textToEmbed);
        return {
          ...p,
          embedding
        };
      });

      const batchSeeded = await Promise.all(batchPromises);
      await Product.insertMany(batchSeeded);
      
      seededProducts.push(...batchSeeded);
      console.log(`Progress: Seeding and embedding computation [${Math.min(i + batchSize, totalProducts)}/${totalProducts}] completed.`);
    }

    console.log(`Database seeding completed! Successfully loaded ${seededProducts.length} products with embeddings.`);
    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
};

// Run the script
seedDB();
