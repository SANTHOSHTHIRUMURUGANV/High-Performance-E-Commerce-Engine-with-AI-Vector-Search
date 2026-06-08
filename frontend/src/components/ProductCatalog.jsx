import React from 'react';
import { Search, BrainCircuit, Edit, Trash2, Plus, ShoppingCart, ShoppingBag } from 'lucide-react';

export default function ProductCatalog({
  products,
  pagination,
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  selectedCategory,
  setSelectedCategory,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onAddToCart,
  goToPage
}) {
  const categories = ['All', 'Electronics', 'Clothing', 'Footwear', 'Home & Kitchen', 'Sports & Outdoors'];

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const toggleSearchMode = () => {
    setSearchMode(prev => prev === 'keyword' ? 'semantic' : 'keyword');
    // Clear search query on toggle to prevent strange results
    setSearchQuery('');
  };

  return (
    <div className="glass-card" style={{ marginTop: '2rem' }}>
      <div className="catalog-header">
        <h2 className="catalog-title">Product Inventory Manager</h2>
        <button className="btn btn-primary" onClick={onAddProduct}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Control Bar - Search & Filters */}
      <div className="control-bar">
        {/* Dual Search Box */}
        <div className="search-box-container">
          <Search size={18} className="search-icon-left" />
          <input
            type="text"
            className="search-input"
            placeholder={
              searchMode === 'semantic'
                ? "Describe what you want (e.g., 'warm outfits for snow' or 'gadget for coding')..."
                : "Search products by keywords (e.g. 'headphones', 'nike')..."
            }
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <button
            className={`search-type-toggle ${searchMode === 'semantic' ? 'semantic-active' : ''}`}
            onClick={toggleSearchMode}
            title="Toggle between standard search and AI semantic vector search"
          >
            {searchMode === 'semantic' ? (
              <>
                <BrainCircuit size={16} /> AI Semantic
              </>
            ) : (
              <>
                <Search size={16} /> Keyword
              </>
            )}
          </button>
        </div>

        {/* Category Filter */}
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          disabled={searchMode === 'semantic'} // Disable category filter in semantic mode (since similarity spans all categories)
        >
          {categories.map(cat => (
            <option key={cat} value={cat === 'All' ? '' : cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="table-container">
        {products.length === 0 ? (
          <div style={{ padding: '4rem 0', textArrignment: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ShoppingBag size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>No products found matching the criteria.</p>
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Price</th>
                <th>Inventory</th>
                {searchMode === 'semantic' && <th>AI Match Score</th>}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                // Stock warning helpers
                let stockClass = "stock-ok";
                if (product.inventory === 0) stockClass = "stock-critical";
                else if (product.inventory < 50) stockClass = "stock-warning";

                return (
                  <tr key={product._id}>
                    <td>
                      <div className="product-row-title">{product.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {product.description}
                      </div>
                    </td>
                    <td>
                      <span className="product-row-category">{product.category}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      ${product.price.toFixed(2)}
                    </td>
                    <td className={stockClass}>
                      {product.inventory === 0 ? 'Out of Stock' : `${product.inventory} units`}
                    </td>
                    {searchMode === 'semantic' && (
                      <td style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                        {product.score ? (product.score * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                    )}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.6rem', borderRadius: '6px' }}
                          title="Add to Cart"
                          onClick={() => onAddToCart(product)}
                          disabled={product.inventory === 0}
                        >
                          <ShoppingCart size={14} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.6rem', borderRadius: '6px' }}
                          title="Edit Product"
                          onClick={() => onEditProduct(product)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.4rem 0.6rem', borderRadius: '6px' }}
                          title="Delete Product"
                          onClick={() => onDeleteProduct(product._id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {searchMode !== 'semantic' && pagination && pagination.pages > 1 && (
        <div className="pagination-container">
          <div>
            Showing page {pagination.page} of {pagination.pages} (Total: {pagination.total} products)
          </div>
          <div className="pagination-controls">
            <button
              className="page-btn"
              disabled={pagination.page === 1}
              onClick={() => goToPage(pagination.page - 1)}
            >
              &lt;
            </button>
            
            {Array.from({ length: pagination.pages }, (_, idx) => idx + 1)
              .filter(p => p === 1 || p === pagination.pages || Math.abs(p - pagination.page) <= 1)
              .map((p, idx, arr) => {
                const elements = [];
                // Add ellipsis
                if (idx > 0 && p - arr[idx - 1] > 1) {
                  elements.push(<span key={`ell-${p}`} style={{ alignSelf: 'center', padding: '0 0.25rem' }}>...</span>);
                }
                elements.push(
                  <button
                    key={p}
                    className={`page-btn ${pagination.page === p ? 'active' : ''}`}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                );
                return elements;
              })}

            <button
              className="page-btn"
              disabled={pagination.page === pagination.pages}
              onClick={() => goToPage(pagination.page + 1)}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
      
      {searchMode === 'semantic' && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
          * AI Semantic search displays the top {products.length} similarity matches across the catalog. Pagination is disabled.
        </div>
      )}
    </div>
  );
}
