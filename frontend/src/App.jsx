import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Database, ArrowUpRight } from 'lucide-react';
import DashboardView from './components/DashboardView';
import ProductCatalog from './components/ProductCatalog';
import ProductModal from './components/ProductModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('keyword'); // 'keyword' or 'semantic'
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dashboard Metrics
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Cart State
  const [cart, setCart] = useState([]);

  // Modal Control
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Live Performance Logs
  const [apiLogs, setApiLogs] = useState([]);

  // Add a helper to write logs
  const addApiLog = (method, endpoint, latency, status) => {
    const newLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      method,
      endpoint,
      latency,
      status
    };
    setApiLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50 logs
  };

  // Fetch product catalog listing
  const fetchProducts = async () => {
    const startTime = performance.now();
    let url = `/api/products?page=${currentPage}&limit=10`;
    
    if (selectedCategory) {
      url += `&category=${selectedCategory}`;
    }
    
    if (searchQuery && searchMode === 'keyword') {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }

    // In semantic mode, we hit the vector search endpoint
    if (searchMode === 'semantic') {
      if (!searchQuery) {
        setProducts([]);
        setPagination(null);
        return;
      }
      url = `/api/products/search?q=${encodeURIComponent(searchQuery)}&limit=20`;
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);
      const cacheStatus = response.headers.get('X-Cache') || 'MISS';
      
      addApiLog('GET', url.length > 50 ? url.substring(0, 47) + '...' : url, latency, cacheStatus);

      if (response.ok) {
        if (searchMode === 'semantic') {
          // Semantic search returns a flat array of matches
          setProducts(data);
          setPagination(null);
        } else {
          setProducts(data.products || []);
          setPagination(data.pagination || null);
        }
      } else {
        console.error('API Error:', data.message);
      }
    } catch (err) {
      console.error('Fetch Error:', err);
    }
  };

  // Fetch Overall stats for dashboard
  const fetchStats = async () => {
    const startTime = performance.now();
    const url = '/api/products/stats';
    try {
      const response = await fetch(url);
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);
      const cacheStatus = response.headers.get('X-Cache') || 'MISS';
      
      addApiLog('GET', url, latency, cacheStatus);
      
      if (response.ok) {
        setTotalProducts(data.totalProducts);
        setLowStockCount(data.lowStockCount);
      }
    } catch (err) {
      // Fallback if stats API is not implemented yet
      console.warn('Stats API failed, falling back to manual catalog checks.', err);
    }
  };

  // Trigger catalog fetch when parameters change (debounced for search query)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, searchQuery ? 400 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedCategory, currentPage, searchMode]);

  // Fetch dashboard stats on mount and whenever catalog is modified
  useEffect(() => {
    fetchStats();
  }, []);

  // Handle saving product (Create / Update)
  const handleSaveProduct = async (productData) => {
    const isEdit = !!productData._id;
    const url = isEdit ? `/api/products/${productData._id}` : '/api/products';
    const method = isEdit ? 'PUT' : 'POST';
    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);
      
      addApiLog(method, url, latency, 'WRITE');

      if (response.ok) {
        fetchProducts();
        fetchStats();
        return true;
      } else {
        alert(data.message || 'Error saving product');
        return false;
      }
    } catch (err) {
      console.error(err);
      alert('Network error saving product');
      return false;
    }
  };

  // Handle deleting product
  const handleDeleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product? This will invalidate all corresponding caches.')) {
      return;
    }
    
    const url = `/api/products/${id}`;
    const startTime = performance.now();

    try {
      const response = await fetch(url, { method: 'DELETE' });
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);
      
      addApiLog('DELETE', url, latency, 'WRITE');

      if (response.ok) {
        fetchProducts();
        fetchStats();
      } else {
        alert(data.message || 'Error deleting product');
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting product');
    }
  };

  // Cart Functions
  const handleAddToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item._id === product._id);
      if (existing) {
        return prev.map(item => 
          item._id === product._id 
            ? { ...item, quantity: Math.min(item.quantity + 1, product.inventory) } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQty = (id, qty) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    const product = products.find(p => p._id === id) || cart.find(c => c._id === id);
    const maxQty = product ? product.inventory : 99;
    
    setCart(prev => prev.map(item => 
      item._id === id 
        ? { ...item, quantity: Math.min(qty, maxQty) } 
        : item
    ));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item._id !== id));
  };

  const clearCart = () => setCart([]);

  const handleCheckoutSuccess = (msg) => {
    // Refresh products and stats since inventories changed
    fetchProducts();
    fetchStats();
  };

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-brand">
          ⚡ HighEngine <span>REST API</span>
        </div>
        <div className="nav-links">
          <button 
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button 
            className={`nav-link ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Database size={16} /> Inventory Catalog
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="dashboard-container">
        {activeTab === 'dashboard' ? (
          <DashboardView 
            productsCount={totalProducts} 
            lowStockCount={lowStockCount} 
            apiLogs={apiLogs}
            cart={cart}
            updateCartQty={updateCartQty}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            onCheckoutSuccess={handleCheckoutSuccess}
          />
        ) : (
          <ProductCatalog
            products={products}
            pagination={pagination}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onAddProduct={() => { setEditingProduct(null); setModalOpen(true); }}
            onEditProduct={(p) => { setEditingProduct(p); setModalOpen(true); }}
            onDeleteProduct={handleDeleteProduct}
            onAddToCart={handleAddToCart}
            goToPage={(p) => setCurrentPage(p)}
          />
        )}
      </main>

      {/* Add / Edit Form Modal */}
      <ProductModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
      />
    </div>
  );
}
