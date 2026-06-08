import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    inventory: {
      type: Number,
      required: [true, 'Product inventory count is required'],
      min: [0, 'Inventory cannot be negative'],
      default: 0,
    },
    imageUrl: {
      type: String,
      required: [true, 'Product image URL is required'],
    },
    embedding: {
      type: [Number],
      required: false,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Index description for text search if necessary (keyword search fallback)
productSchema.index({ title: 'text', description: 'text' });

const Product = mongoose.model('Product', productSchema);

export default Product;
