import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ProductModal({ isOpen, onClose, onSave, product }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [price, setPrice] = useState('');
  const [inventory, setInventory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setTitle(product.title || '');
      setDescription(product.description || '');
      setCategory(product.category || 'Electronics');
      setPrice(product.price || '');
      setInventory(product.inventory || '');
      setImageUrl(product.imageUrl || '');
    } else {
      setTitle('');
      setDescription('');
      setCategory('Electronics');
      setPrice('');
      setInventory('');
      setImageUrl('');
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description || !category || price === '' || inventory === '' || !imageUrl) {
      alert('All fields are required');
      return;
    }

    setSubmitting(true);
    const success = await onSave({
      _id: product?._id,
      title,
      description,
      category,
      price: parseFloat(price),
      inventory: parseInt(inventory, 10),
      imageUrl
    });
    setSubmitting(false);

    if (success) {
      onClose();
    }
  };

  const categories = ['Electronics', 'Clothing', 'Footwear', 'Home & Kitchen', 'Sports & Outdoors'];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">
            {product ? 'Edit Catalog Product' : 'Add New Catalog Product'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Product Title</label>
            <input
              type="text"
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sony Wireless Headphones"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Description (for semantic vector indexing)</label>
            <textarea
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a detailed description of the product. This description is used by the AI model to index and find the product semantically."
              rows={4}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stock Inventory</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                placeholder="e.g. 150"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Image URL Path</label>
            <input
              type="text"
              className="form-control"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="e.g. /images/products/electronics-1.jpg"
              required
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Generating AI Embedding...' : product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
