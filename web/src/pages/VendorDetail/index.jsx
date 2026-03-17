import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LobeIcons from '@lobehub/icons';
import { API } from '../../helpers/api';
import PublicLayout from '../../components/layout/PublicLayout';
import ModelCard from '../../components/public/ModelCard';

function resolveLobeIcon(iconStr, size = 40) {
  if (!iconStr) return null;
  try {
    const parts = iconStr.split('.');
    let target = LobeIcons[parts[0]];
    if (!target) return null;
    for (let i = 1; i < parts.length; i++) { target = target[parts[i]]; if (!target) return null; }
    if (typeof target === 'function' || (target && target.$$typeof)) return React.createElement(target, { size });
  } catch (_) {}
  return null;
}

export default function VendorDetail() {
  const { vendor } = useParams();
  const { t } = useTranslation();

  const [data, setData] = useState(null);      // { vendor, models }
  const [pricingMap, setPricingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [vendorRes, pricingRes] = await Promise.all([
          API.get(`/api/public/vendors/${encodeURIComponent(vendor)}`),
          API.get('/api/pricing'),
        ]);
        if (!alive) return;

        const map = {};
        (pricingRes.data?.data || []).forEach(p => { map[p.model_name] = p; });

        if (vendorRes.data?.success) {
          setData({ vendor: vendorRes.data.vendor, models: vendorRes.data.models || [] });
        }
        setPricingMap(map);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [vendor]);

  const filteredModels = (data?.models || []).filter(m => {
    if (!searchQ) return true;
    const lq = searchQ.toLowerCase();
    return m.model_name.toLowerCase().includes(lq) || (m.description || '').toLowerCase().includes(lq);
  });

  if (!loading && !data?.vendor) {
    return (
      <PublicLayout>
        <div className="pub-page">
          <div className="pub-empty" style={{ paddingTop: 120 }}>
            <div className="pub-empty-icon">🏭</div>
            <div className="pub-empty-title">{t('服务商不存在')}</div>
            <div className="pub-empty-desc">
              <Link to="/models" style={{ color: 'var(--pub-primary)' }}>{t('浏览所有模型')}</Link>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const v = data?.vendor;
  const icon = v ? resolveLobeIcon(v.icon, 40) : null;

  return (
    <PublicLayout>
      <div className="pub-page">

        {/* Vendor hero */}
        <div className="pub-vendor-hero">
          <div className="pub-vendor-hero-icon">
            {loading
              ? <div className="pub-skeleton" style={{ width: 40, height: 40 }} />
              : (icon || v?.name?.[0]?.toUpperCase())}
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--pub-text-3)', marginBottom: 6 }}>
              <Link to="/" style={{ color: 'var(--pub-primary)', textDecoration: 'none' }}>{t('首页')}</Link>
              {' / '}
              <Link to="/models" style={{ color: 'var(--pub-primary)', textDecoration: 'none' }}>{t('模型')}</Link>
              {' / '}
              {loading ? '…' : v?.name}
            </div>
            {loading ? (
              <>
                <div className="pub-skeleton" style={{ height: 30, width: 200, marginBottom: 8 }} />
                <div className="pub-skeleton" style={{ height: 16, width: 400 }} />
              </>
            ) : (
              <>
                <h1 className="pub-vendor-hero-title">{v?.name}</h1>
                {v?.description && (
                  <p className="pub-vendor-hero-desc">{v.description}</p>
                )}
                <div style={{ marginTop: 10 }}>
                  <span className="pub-badge pub-badge-purple">
                    {v?.model_count} {t('个模型')}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search + model grid */}
        <div style={{ paddingTop: 32 }}>
          <div className="pub-sort-bar">
            <input
              className="pub-search"
              style={{ height: 38, maxWidth: 360, fontSize: 13 }}
              placeholder={t('在此服务商中搜索...')}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <span className="pub-result-count">
              {loading ? '…' : `${filteredModels.length} ${t('个模型')}`}
            </span>
          </div>

          {loading ? (
            <div className="pub-model-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="pub-model-card" style={{ minHeight: 180 }}>
                  <div className="pub-skeleton" style={{ height: 40, width: '100%' }} />
                  <div className="pub-skeleton" style={{ height: 14, width: '60%', marginTop: 10 }} />
                </div>
              ))}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="pub-empty">
              <div className="pub-empty-icon">🔍</div>
              <div className="pub-empty-title">{t('未找到模型')}</div>
            </div>
          ) : (
            <div className="pub-model-grid">
              {filteredModels.map(m => (
                <ModelCard key={m.model_name} model={m} pricing={pricingMap[m.model_name]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
