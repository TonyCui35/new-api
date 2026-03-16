import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LobeIcons from '@lobehub/icons';
import { API } from '../../helpers/api';
import PublicLayout from '../../components/layout/PublicLayout';
import ModelCard from '../../components/public/ModelCard';

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function resolveLobeIcon(iconStr, size = 32) {
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

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState('');
  const [vendors, setVendors] = useState([]);
  const [pricingData, setPricingData] = useState({ models: [], pricingMap: {} });
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('all');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [pricingRes, vendorRes] = await Promise.all([
          API.get('/api/pricing'),
          API.get('/api/public/vendors'),
        ]);
        if (!alive) return;

        const pricingArr = pricingRes.data?.data || [];
        const pricingMap = {};
        pricingArr.forEach(p => { pricingMap[p.model_name] = p; });

        const pricingVendors = pricingRes.data?.vendors || [];
        const publicVendors = vendorRes.data?.data || [];
        const vendorArr = Array.isArray(pricingVendors) ? pricingVendors : Object.values(pricingVendors);
        const countMap = {};
        publicVendors.forEach(v => { countMap[v.name] = v.model_count; });

        const mergedVendors = vendorArr
          .filter(v => (v.Status || v.status) === 1)
          .map(v => ({
            id: v.Id || v.id,
            name: v.Name || v.name,
            description: v.Description || v.description,
            icon: v.Icon || v.icon,
            model_count: countMap[v.Name || v.name] || 0,
          }))
          .sort((a, b) => b.model_count - a.model_count);

        const models = pricingArr.map(p => {
          const v = vendorArr.find(vv => (vv.Id || vv.id) === p.vendor_id);
          return {
            model_name: p.model_name,
            description: p.description,
            icon: p.icon,
            tags: p.tags,
            vendor_id: p.vendor_id,
            vendor_name: v ? (v.Name || v.name) : '',
            vendor_icon: v ? (v.Icon || v.icon) : '',
          };
        });

        setVendors(mergedVendors);
        setPricingData({ models, pricingMap });
      } catch (e) {
        console.error('Home load error', e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    const q = searchQ.trim();
    navigate(q ? `/models?q=${encodeURIComponent(q)}` : '/models');
  }, [searchQ, navigate]);

  const TAGS = [
    { key: 'all', label: t('全部') },
    { key: 'chat', label: t('对话') },
    { key: 'vision', label: t('视觉') },
    { key: 'image', label: t('图像') },
    { key: 'audio', label: t('音频') },
    { key: 'video', label: t('视频') },
    { key: 'embedding', label: t('向量') },
    { key: 'code', label: t('代码') },
    { key: 'reasoning', label: t('推理') },
  ];

  const filteredModels = pricingData.models
    .filter(m => {
      if (activeTag === 'all') return true;
      const tagsStr = (m.tags || '').toLowerCase();
      return tagsStr.includes(activeTag) || (m.model_name || '').toLowerCase().includes(activeTag);
    })
    .slice(0, 12);

  return (
    <PublicLayout>
      <div className="pub-page">

        {/* Hero */}
        <section className="pub-hero">
          <h1 className="pub-hero-title">
            {t('发现与接入')}<br />
            <span>{t('顶尖 AI 模型')}</span>
          </h1>
          <p className="pub-hero-sub">
            {t('统一 API，一个密钥访问 40+ 服务商、数百个顶尖模型。')}
          </p>
          <form className="pub-search-wrap" onSubmit={handleSearch}>
            <input
              className="pub-search"
              placeholder={t('搜索模型，如 GPT-4o、Claude 3.5、Gemini...')}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer' }} className="pub-search-icon">
              <SearchIcon />
            </button>
          </form>
        </section>

        {/* Stats */}
        <div className="pub-stats">
          <div className="pub-stat">
            <div className="pub-stat-value">{loading ? '…' : `${pricingData.models.length}+`}</div>
            <div className="pub-stat-label">{t('可用模型')}</div>
          </div>
          <div className="pub-stat-divider" />
          <div className="pub-stat">
            <div className="pub-stat-value">{loading ? '…' : `${vendors.length}+`}</div>
            <div className="pub-stat-label">{t('AI 服务商')}</div>
          </div>
          <div className="pub-stat-divider" />
          <div className="pub-stat">
            <div className="pub-stat-value">99.9%</div>
            <div className="pub-stat-label">{t('服务可用率')}</div>
          </div>
          <div className="pub-stat-divider" />
          <div className="pub-stat">
            <div className="pub-stat-value">OpenAI</div>
            <div className="pub-stat-label">{t('兼容 API')}</div>
          </div>
        </div>

        {/* Featured models */}
        <section className="pub-section">
          <div className="pub-section-header">
            <h2 className="pub-section-title">{t('精选模型')}</h2>
            <Link to="/models" className="pub-section-link" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {t('查看全部')} <ArrowIcon />
            </Link>
          </div>

          <div className="pub-chips">
            {TAGS.map(tag => (
              <button
                key={tag.key}
                className={'pub-chip' + (activeTag === tag.key ? ' active' : '')}
                onClick={() => setActiveTag(tag.key)}
              >
                {tag.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="pub-model-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="pub-model-card" style={{ minHeight: 180 }}>
                  <div className="pub-skeleton" style={{ height: 40, width: '100%' }} />
                  <div className="pub-skeleton" style={{ height: 14, width: '70%', marginTop: 10 }} />
                  <div className="pub-skeleton" style={{ height: 14, width: '50%', marginTop: 6 }} />
                </div>
              ))}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="pub-empty">
              <div className="pub-empty-icon">🔍</div>
              <div className="pub-empty-title">{t('暂无模型')}</div>
            </div>
          ) : (
            <div className="pub-model-grid">
              {filteredModels.map(m => (
                <ModelCard key={m.model_name} model={m} pricing={pricingData.pricingMap[m.model_name]} />
              ))}
            </div>
          )}
        </section>

        {/* Vendor showcase */}
        {vendors.length > 0 && (
          <section className="pub-section">
            <div className="pub-section-header">
              <h2 className="pub-section-title">{t('服务商')}</h2>
            </div>
            <div className="pub-vendor-grid">
              {vendors.slice(0, 16).map(vendor => {
                const icon = resolveLobeIcon(vendor.icon, 30);
                return (
                  <Link key={vendor.name} to={`/${vendor.name}`} className="pub-vendor-card">
                    <div className="pub-vendor-icon">{icon || vendor.name[0]?.toUpperCase()}</div>
                    <div className="pub-vendor-name">{vendor.name}</div>
                    {vendor.model_count > 0 && (
                      <div className="pub-vendor-count">{vendor.model_count} {t('个模型')}</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <section style={{
          background: 'var(--pub-primary-10)',
          border: '1.5px solid var(--pub-primary-20)',
          borderRadius: 'var(--pub-radius-xl)',
          padding: '48px 40px',
          textAlign: 'center',
          margin: '48px 0 80px',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--pub-text)', marginBottom: 12, letterSpacing: -0.3 }}>
            {t('立即开始使用 ElkAPI')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--pub-text-2)', marginBottom: 28 }}>
            {t('注册即可获得免费额度，无需信用卡。')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="pub-btn pub-btn-primary">{t('免费注册')}</Link>
            <Link to="/models" className="pub-btn pub-btn-outline">{t('浏览模型')}</Link>
          </div>
        </section>

      </div>
    </PublicLayout>
  );
}
