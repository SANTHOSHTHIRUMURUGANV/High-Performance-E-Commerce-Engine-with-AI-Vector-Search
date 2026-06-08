import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, ShieldAlert, ZapOff, Info } from 'lucide-react';

export default function CacheInspector({ addApiLog }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCacheKeys = async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      const response = await fetch('/api/cache');
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);
      const cacheStatus = response.headers.get('X-Cache') || 'BYPASS';

      if (addApiLog) {
        addApiLog('GET', '/api/cache', latency, cacheStatus);
      }

      if (response.ok) {
        setKeys(data);
      }
    } catch (err) {
      console.error('Error fetching cache keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeKey = async (keyName) => {
    const startTime = performance.now();
    try {
      const response = await fetch('/api/cache/purge-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyName })
      });
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);

      if (addApiLog) {
        addApiLog('POST', '/api/cache/purge-key', latency, 'WRITE');
      }

      if (response.ok) {
        fetchCacheKeys();
      } else {
        alert(data.message || 'Error purging key');
      }
    } catch (err) {
      console.error(err);
      alert('Network error purging key');
    }
  };

  const handlePurgeAll = async () => {
    if (!confirm('Are you sure you want to clear the entire Redis cache? All product listings, details, and search indexes will be purged, causing the next load to hit the database directly.')) {
      return;
    }

    const startTime = performance.now();
    try {
      const response = await fetch('/api/cache/purge-all', {
        method: 'POST'
      });
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);

      if (addApiLog) {
        addApiLog('POST', '/api/cache/purge-all', latency, 'WRITE');
      }

      if (response.ok) {
        fetchCacheKeys();
      } else {
        alert(data.message || 'Error purging cache');
      }
    } catch (err) {
      console.error(err);
      alert('Network error purging cache');
    }
  };

  useEffect(() => {
    fetchCacheKeys();
  }, []);

  return (
    <div className="glass-card" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="catalog-header">
        <h2 className="catalog-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={24} style={{ color: 'var(--color-primary)' }} /> Redis Cache Inspector & Manager
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={fetchCacheKeys} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh Keys
          </button>
          <button className="btn btn-danger" onClick={handlePurgeAll} disabled={loading || keys.length === 0}>
            <ZapOff size={16} /> Purge All Cache
          </button>
        </div>
      </div>

      <div style={{ margin: '1rem 0', padding: '0.75rem 1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.15)', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <Info size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <span>
          Below is a real-time view of data cached inside Redis memory. The <strong>Cache-Aside Pattern</strong> ensures that when products are added or updated, their corresponding keys are automatically deleted to prevent serving stale data.
        </span>
      </div>

      <div className="table-container" style={{ marginTop: '1.5rem' }}>
        {keys.length === 0 ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ZapOff size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>{loading ? 'Scanning Redis Memory...' : 'Redis Cache is currently empty (No active "products*" keys).'}</p>
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Redis Key Name</th>
                <th>Estimated Content Type</th>
                <th>Time To Live (TTL)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(item => {
                // Infer type from key name
                let type = "Generic Cache";
                if (item.key.includes('list')) type = "Catalog List (Paged)";
                else if (item.key.includes('detail')) type = "Single Product Detail";
                else if (item.key.includes('search')) type = "Semantic Search Results";
                else if (item.key.includes('stats')) type = "Dashboard Statistics";

                return (
                  <tr key={item.key}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#fff' }}>
                      {item.key}
                    </td>
                    <td>
                      <span className="product-row-category" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
                        {type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {item.ttl === -1 ? 'Indefinite (No expiry)' : `${item.ttl} seconds`}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '6px' }}
                        title="Purge Key"
                        onClick={() => handlePurgeKey(item.key)}
                      >
                        <Trash2 size={14} /> Purge
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
  );
}
