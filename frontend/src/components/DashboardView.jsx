import React, { useState } from 'react';
import { Database, Zap, RefreshCw, ShoppingCart, Percent, CheckCircle, AlertTriangle } from 'lucide-react';

export default function DashboardView({ 
  productsCount, 
  lowStockCount, 
  apiLogs, 
  cart, 
  updateCartQty, 
  removeFromCart,
  clearCart,
  onCheckoutSuccess
}) {
  const [discountCode, setDiscountCode] = useState('');
  const [calculation, setCalculation] = useState(null);
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Calculate Cache Metrics from logs
  const hits = apiLogs.filter(log => log.status === 'HIT').length;
  const misses = apiLogs.filter(log => log.status === 'MISS').length;
  const writes = apiLogs.filter(log => log.status === 'WRITE').length;
  const totalQueries = hits + misses;
  const hitRate = totalQueries > 0 ? Math.round((hits / totalQueries) * 100) : 0;

  // Latency averages
  const hitLatency = apiLogs.filter(log => log.status === 'HIT');
  const avgHitLatency = hitLatency.length > 0 
    ? Math.round(hitLatency.reduce((acc, curr) => acc + curr.latency, 0) / hitLatency.length) 
    : 0;

  const missLatency = apiLogs.filter(log => log.status === 'MISS');
  const avgMissLatency = missLatency.length > 0 
    ? Math.round(missLatency.reduce((acc, curr) => acc + curr.latency, 0) / missLatency.length) 
    : 0;

  // Calculate Total (Aggregation pipeline call)
  const handleCalculateTotal = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setCheckoutStatus(null);

    const startTime = performance.now();
    try {
      const response = await fetch('/api/cart/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({ productId: item._id, quantity: item.quantity })),
          discountCode
        })
      });
      const data = await response.json();
      
      const duration = Math.round(performance.now() - startTime);
      
      if (response.ok) {
        setCalculation(data);
      } else {
        alert(data.message || 'Error calculating total');
      }
    } catch (err) {
      console.error(err);
      alert('Network error calculating total');
    } finally {
      setLoading(false);
    }
  };

  // Perform Transactional Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setCheckoutStatus(null);

    try {
      const response = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({ productId: item._id, quantity: item.quantity }))
        })
      });
      const data = await response.json();

      if (response.ok) {
        setCheckoutStatus({ success: true, message: data.message });
        clearCart();
        setCalculation(null);
        setDiscountCode('');
        if (onCheckoutSuccess) onCheckoutSuccess(data.message);
      } else {
        setCheckoutStatus({ success: false, message: data.message });
      }
    } catch (err) {
      console.error(err);
      setCheckoutStatus({ success: false, message: 'Checkout network failure.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Metrics Row */}
      <div className="stats-grid">
        <div className="glass-card">
          <div className="stat-title">Catalog Inventory</div>
          <div className="stat-value">{productsCount}</div>
          <div className="stat-desc">Total seeded items in MongoDB</div>
          <Database className="stat-icon" />
        </div>

        <div className="glass-card">
          <div className="stat-title">Low Stock Alert</div>
          <div className="stat-value" style={{ color: lowStockCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {lowStockCount}
          </div>
          <div className="stat-desc">Products with &lt; 50 units remaining</div>
          <AlertTriangle className="stat-icon" />
        </div>

        <div className="glass-card">
          <div className="stat-title">Cache Hit Rate</div>
          <div className="stat-value" style={{ color: hitRate > 50 ? 'var(--color-success)' : 'inherit' }}>
            {hitRate}%
          </div>
          <div className="stat-desc">
            {hits} Hits / {misses} Misses (Redis active <span className="pulse-dot"></span>)
          </div>
          <Zap className="stat-icon" />
        </div>

        <div className="glass-card">
          <div className="stat-title">Avg Latency</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '0.5rem' }}>
            <span className="latency-fast">{avgHitLatency}ms</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: '0 0.4rem' }}>vs</span>
            <span className="latency-slow">{avgMissLatency}ms</span>
          </div>
          <div className="stat-desc">Redis Hit vs MongoDB Miss</div>
          <RefreshCw className="stat-icon" />
        </div>
      </div>

      {/* Latency Log & Cart Simulation Grid */}
      <div className="performance-grid">
        {/* Real-time Query Log Console */}
        <div className="glass-card">
          <h3 className="stat-title" style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pulse-dot"></span> Real-Time Performance Monitor
          </h3>
          <div className="perf-log-container">
            {apiLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 0' }}>
                Console idle. Perform search or pagination queries to monitor Redis Cache-Aside latencies.
              </div>
            ) : (
              [...apiLogs].reverse().map(log => (
                <div key={log.id} className="perf-log-item">
                  <span className={`badge ${log.status === 'HIT' ? 'badge-hit' : log.status === 'MISS' ? 'badge-miss' : 'badge-write'}`}>
                    {log.status}
                  </span>
                  <span style={{ color: '#fff', wordBreak: 'break-all' }}>
                    {log.method} {log.endpoint}
                  </span>
                  <span className={log.latency < 10 ? 'latency-fast' : 'latency-slow'}>
                    {log.latency}ms
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Simulator */}
        <div className="glass-card">
          <h3 className="stat-title" style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={18} /> Cart & Transaction Simulator
          </h3>
          
          <div className="cart-simulator">
            {cart.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>
                Cart is empty.<br />Click "+ Add to Cart" on items below.
              </div>
            ) : (
              <div>
                {/* Item List */}
                <div className="cart-items-list" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                  {cart.map(item => (
                    <div key={item._id} className="cart-item-row">
                      <div style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {item.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          className="page-btn" 
                          style={{ width: '22px', height: '22px', fontSize: '0.8rem' }}
                          onClick={() => updateCartQty(item._id, item.quantity - 1)}
                        >-</button>
                        <span style={{ fontSize: '0.85rem', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                        <button 
                          className="page-btn" 
                          style={{ width: '22px', height: '22px', fontSize: '0.8rem' }}
                          onClick={() => updateCartQty(item._id, item.quantity + 1)}
                        >+</button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.75rem' }}
                          onClick={() => removeFromCart(item._id)}
                        >x</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Input */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="Coupon (e.g. SUMMER20)" 
                    value={discountCode} 
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="form-control"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  />
                  <button 
                    onClick={handleCalculateTotal} 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    disabled={loading}
                  >
                    <Percent size={14} /> Apply
                  </button>
                </div>

                {/* Calculation breakdown */}
                {calculation && (
                  <div className="checkout-summary">
                    <div className="summary-row">
                      <span>Subtotal:</span>
                      <span>${calculation.subtotal.toFixed(2)}</span>
                    </div>
                    {calculation.discountApplied && (
                      <div className="summary-row" style={{ color: 'var(--color-success)' }}>
                        <span>Discount ({calculation.discountApplied.code} -{calculation.discountApplied.discountPercent}%):</span>
                        <span>-${calculation.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="summary-row summary-total">
                      <span>Total:</span>
                      <span>${calculation.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={handleCheckout} 
                    className="btn btn-primary" 
                    style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                    disabled={loading}
                  >
                    Simulate Purchase
                  </button>
                  <button 
                    onClick={clearCart} 
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Success/Error Checkout alerts */}
            {checkoutStatus && (
              <div 
                style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  border: '1px solid',
                  backgroundColor: checkoutStatus.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderColor: checkoutStatus.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                  color: checkoutStatus.success ? 'var(--color-success)' : 'var(--color-danger)'
                }}
              >
                {checkoutStatus.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span style={{ wordBreak: 'break-all' }}>{checkoutStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
