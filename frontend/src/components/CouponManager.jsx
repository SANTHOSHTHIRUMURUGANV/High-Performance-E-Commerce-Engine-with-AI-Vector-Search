import React, { useState, useEffect } from 'react';
import { Percent, Plus, ToggleLeft, ToggleRight, Gift } from 'lucide-react';

export default function CouponManager({ addApiLog }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Coupon Form state
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      const response = await fetch('/api/discounts');
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);
      const cacheStatus = response.headers.get('X-Cache') || 'MISS';

      if (addApiLog) {
        addApiLog('GET', '/api/discounts', latency, cacheStatus);
      }

      if (response.ok) {
        setCoupons(data);
      }
    } catch (err) {
      console.error('Error fetching coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!code || !percent) return;

    setSubmitting(true);
    const startTime = performance.now();

    try {
      const response = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          discountPercent: parseFloat(percent),
          expiresAt: expiresAt || undefined
        })
      });
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);

      if (addApiLog) {
        addApiLog('POST', '/api/discounts', latency, 'WRITE');
      }

      if (response.ok) {
        setCode('');
        setPercent('');
        setExpiresAt('');
        fetchCoupons();
      } else {
        alert(data.message || 'Error creating coupon');
      }
    } catch (err) {
      console.error(err);
      alert('Network error creating coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (couponId) => {
    const startTime = performance.now();
    try {
      const response = await fetch(`/api/discounts/${couponId}/toggle`, {
        method: 'PUT'
      });
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);

      if (addApiLog) {
        addApiLog('PUT', `/api/discounts/${couponId}/toggle`, latency, 'WRITE');
      }

      if (response.ok) {
        fetchCoupons();
      } else {
        alert(data.message || 'Error toggling coupon status');
      }
    } catch (err) {
      console.error(err);
      alert('Network error toggling coupon status');
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* Creator Form */}
      <div className="glass-card">
        <h3 className="stat-title" style={{ fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Percent size={18} /> Create Discount Coupon
        </h3>
        
        <form onSubmit={handleCreateCoupon}>
          <div className="form-group">
            <label className="form-label">Coupon Code</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="e.g. EXTRA40"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Discount Percentage (%)</label>
            <input 
              type="number" 
              min="0"
              max="100"
              className="form-control"
              placeholder="e.g. 40"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Expiry Date (Optional)</label>
            <input 
              type="date" 
              className="form-control"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={submitting}
          >
            <Plus size={16} /> Create Coupon
          </button>
        </form>
      </div>

      {/* Coupons List */}
      <div className="glass-card">
        <div className="catalog-header" style={{ marginBottom: '1.25rem' }}>
          <h3 className="stat-title" style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gift size={18} /> Available Coupons & Discounts
          </h3>
        </div>

        <div className="table-container">
          {coupons.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Gift size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
              <p>{loading ? 'Loading...' : 'No coupon codes in database.'}</p>
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Expiry</th>
                  <th style={{ textAlign: 'right' }}>Active Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(coupon => {
                  const isExpired = coupon.expiresAt && new Date() > new Date(coupon.expiresAt);
                  
                  return (
                    <tr key={coupon._id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff' }}>
                        {coupon.code}
                      </td>
                      <td style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                        -{coupon.discountPercent}%
                      </td>
                      <td style={{ fontSize: '0.85rem', color: isExpired ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                        {isExpired 
                          ? 'EXPIRED' 
                          : coupon.expiresAt 
                            ? new Date(coupon.expiresAt).toLocaleDateString() 
                            : 'Never'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleToggleStatus(coupon._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: coupon.isActive && !isExpired ? 'var(--color-success)' : 'var(--text-muted)',
                            transition: 'var(--transition-fast)'
                          }}
                          disabled={isExpired}
                          title={isExpired ? 'Expired' : coupon.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {coupon.isActive && !isExpired ? (
                            <ToggleRight size={36} />
                          ) : (
                            <ToggleLeft size={36} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
