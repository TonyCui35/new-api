import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers/api';
import PublicLayout from '../../components/layout/PublicLayout';
import ModelCard from '../../components/public/ModelCard';

/* ── Constants ─────────────────────────────────────── */
const BASE_PRICE_PER_M = 2; // $2 / 1M tokens ≈ gpt-3.5 baseline

const CAPABILITIES = [
  { key: 'chat',             icon: '💬', label: '对话'   },
  { key: 'vision',           icon: '👁',  label: '视觉'   },
  { key: 'image-generation', icon: '🖼',  label: '图像生成' },
  { key: 'audio',            icon: '🎵', label: '音频'   },
  { key: 'video',            icon: '🎬', label: '视频'   },
  { key: 'embedding',        icon: '📊', label: '向量嵌入' },
  { key: 'rerank',           icon: '🔀', label: '重排序'  },
  { key: 'reasoning',        icon: '🧠', label: '推理'   },
];

const PRICE_TIERS = [
  { key: 'free',     label: '免费',   color: '#10b981', desc: '$0'         },
  { key: 'budget',   label: '经济',   color: '#3b82f6', desc: '< $2/1M'   },
  { key: 'standard', label: '标准',   color: '#f59e0b', desc: '$2–10/1M'  },
  { key: 'premium',  label: '高端',   color: '#ef4444', desc: '> $10/1M'  },
];

const SORT_OPTIONS = [
  { value: 'default',    label: '默认'       },
  { value: 'name_asc',   label: '名称 A→Z'   },
  { value: 'price_asc',  label: '价格最低'   },
  { value: 'price_desc', label: '价格最高'   },
];

/* ── Helpers ────────────────────────────────────────── */
function getInputPricePerM(p) {
  if (!p) return null;
  if (p.quota_type === 1) return null; // fixed-price-per-call
  return (p.model_ratio || 0) * BASE_PRICE_PER_M;
}

function getPriceTier(p) {
  if (!p) return null;
  if (p.quota_type === 1) return 'standard'; // fixed
  const usd = (p.model_ratio || 0) * BASE_PRICE_PER_M;
  if (usd === 0) return 'free';
  if (usd < 2)   return 'budget';
  if (usd <= 10) return 'standard';
  return 'premium';
}

function getEndpointSet(p) {
  if (!p) return new Set();
  const types = p.supported_endpoint_types || [];
  const s = new Set(types);
  // normalise
  if (s.has('openai') && !s.has('chat')) s.add('chat');
  return s;
}

const VENDOR_COLORS = [
  '#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f97316',
];
function vendorColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return VENDOR_COLORS[Math.abs(h) % VENDOR_COLORS.length];
}

/* ── Component ──────────────────────────────────────── */
export default function ModelsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allModels, setAllModels]   = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  const [loading, setLoading]       = useState(true);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorExpanded, setVendorExpanded] = useState(false);

  /* active filters from URL */
  const qParam       = searchParams.get('q')    || '';
  const vendorParam  = searchParams.get('vendor')|| '';
  const capParam     = searchParams.get('cap')   || '';    // capability
  const tierParam    = searchParams.get('tier')  || '';    // price tier
  const sortParam    = searchParams.get('sort')  || 'default';

  const [searchInput, setSearchInput] = useState(qParam);
  const searchRef = useRef(null);

  useEffect(() => { setSearchInput(qParam); }, [qParam]);

  /* ── Load data ── */
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await API.get('/api/pricing');
        if (!alive) return;
        const pricingArr = res.data?.data || [];
        const pricingVendors = res.data?.vendors || [];

        const vendorArr = Array.isArray(pricingVendors)
          ? pricingVendors
          : Object.values(pricingVendors);

        const map = {};
        pricingArr.forEach(p => { map[p.model_name] = p; });

        const models = pricingArr.map(p => {
          const v = vendorArr.find(vv => (vv.Id || vv.id) === p.vendor_id);
          return {
            model_name:  p.model_name,
            description: p.description || '',
            icon:        p.icon || '',
            tags:        p.tags || '',
            vendor_id:   p.vendor_id,
            vendor_name: v ? (v.Name || v.name || '') : '',
            vendor_icon: v ? (v.Icon || v.icon || '') : '',
            endpoint_types: p.supported_endpoint_types || [],
          };
        });

        setAllModels(models);
        setPricingMap(map);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  /* ── Derived stats ── */
  const vendorStats = useMemo(() => {
    const map = {};
    allModels.forEach(m => {
      const name = m.vendor_name || '其他';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allModels]);

  const capStats = useMemo(() => {
    const map = {};
    allModels.forEach(m => {
      const types = m.endpoint_types || [];
      const s = new Set(types);
      if (s.has('openai') && !s.has('chat')) s.add('chat');
      CAPABILITIES.forEach(c => {
        if (s.has(c.key)) map[c.key] = (map[c.key] || 0) + 1;
      });
    });
    return map;
  }, [allModels]);

  const tierStats = useMemo(() => {
    const map = { free: 0, budget: 0, standard: 0, premium: 0 };
    allModels.forEach(m => {
      const tier = getPriceTier(pricingMap[m.model_name]);
      if (tier) map[tier] = (map[tier] || 0) + 1;
    });
    return map;
  }, [allModels, pricingMap]);

  /* ── Filtered & sorted list ── */
  const filtered = useMemo(() => {
    let list = allModels;
    if (qParam) {
      const lq = qParam.toLowerCase();
      list = list.filter(m =>
        m.model_name.toLowerCase().includes(lq) ||
        m.description.toLowerCase().includes(lq) ||
        m.vendor_name.toLowerCase().includes(lq)
      );
    }
    if (vendorParam) list = list.filter(m => m.vendor_name === vendorParam);
    if (capParam) {
      list = list.filter(m => {
        const s = getEndpointSet(pricingMap[m.model_name]);
        return s.has(capParam);
      });
    }
    if (tierParam) {
      list = list.filter(m => getPriceTier(pricingMap[m.model_name]) === tierParam);
    }
    // sort
    if (sortParam === 'name_asc') {
      list = [...list].sort((a, b) => a.model_name.localeCompare(b.model_name));
    } else if (sortParam === 'price_asc') {
      list = [...list].sort((a, b) => {
        const ap = getInputPricePerM(pricingMap[a.model_name]) ?? 9999;
        const bp = getInputPricePerM(pricingMap[b.model_name]) ?? 9999;
        return ap - bp;
      });
    } else if (sortParam === 'price_desc') {
      list = [...list].sort((a, b) => {
        const ap = getInputPricePerM(pricingMap[a.model_name]) ?? -1;
        const bp = getInputPricePerM(pricingMap[b.model_name]) ?? -1;
        return bp - ap;
      });
    }
    return list;
  }, [allModels, pricingMap, qParam, vendorParam, capParam, tierParam, sortParam]);

  /* ── Param helpers ── */
  const setParam = useCallback((key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set(key, val); else next.delete(key);
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const clearAll = () => {
    setSearchParams({});
    setSearchInput('');
  };

  const activeCount = [qParam, vendorParam, capParam, tierParam].filter(Boolean).length;

  /* ── Vendor list (with search + expand) ── */
  const visibleVendors = useMemo(() => {
    const searched = vendorSearch
      ? vendorStats.filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
      : vendorStats;
    return vendorExpanded ? searched : searched.slice(0, 8);
  }, [vendorStats, vendorSearch, vendorExpanded]);

  /* ── Render ── */
  return (
    <PublicLayout>
      <div className="pub-page">
        <div className="pub-models-layout">

          {/* ════ Sidebar ════ */}
          <aside className="pub-sidebar-v2">

            {/* Clear all */}
            {activeCount > 0 && (
              <button className="pub-clear-btn" onClick={clearAll}>
                清除全部筛选 ({activeCount})
              </button>
            )}

            {/* ── Vendor ── */}
            <div className="pub-filter-section">
              <div className="pub-filter-section-title">
                <span>服务商</span>
                <span className="pub-filter-section-count">{vendorStats.length}</span>
              </div>
              <input
                className="pub-vendor-search"
                placeholder="搜索服务商..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
              />
              <div
                className={'pub-vendor-item' + (!vendorParam ? ' active' : '')}
                onClick={() => setParam('vendor', '')}
              >
                <span className="pub-vendor-all-icon">✦</span>
                <span className="pub-vendor-name">全部服务商</span>
                <span className="pub-vendor-count">{allModels.length}</span>
              </div>
              {visibleVendors.map(v => (
                <div
                  key={v.name}
                  className={'pub-vendor-item' + (vendorParam === v.name ? ' active' : '')}
                  onClick={() => setParam('vendor', vendorParam === v.name ? '' : v.name)}
                >
                  <span
                    className="pub-vendor-avatar"
                    style={{ background: vendorColor(v.name) }}
                  >
                    {v.name[0]?.toUpperCase()}
                  </span>
                  <span className="pub-vendor-name">{v.name}</span>
                  <span className="pub-vendor-count">{v.count}</span>
                </div>
              ))}
              {vendorStats.length > 8 && !vendorSearch && (
                <button
                  className="pub-expand-btn"
                  onClick={() => setVendorExpanded(x => !x)}
                >
                  {vendorExpanded
                    ? '收起'
                    : `查看更多 +${vendorStats.length - 8}`}
                </button>
              )}
            </div>

            {/* ── Capabilities ── */}
            <div className="pub-filter-section">
              <div className="pub-filter-section-title">
                <span>能力类型</span>
              </div>
              <div
                className={'pub-cap-item' + (!capParam ? ' active' : '')}
                onClick={() => setParam('cap', '')}
              >
                <span className="pub-cap-icon">🌐</span>
                <span className="pub-cap-label">全部类型</span>
                <span className="pub-vendor-count">{allModels.length}</span>
              </div>
              {CAPABILITIES.map(c => {
                const cnt = capStats[c.key] || 0;
                if (!cnt) return null;
                return (
                  <div
                    key={c.key}
                    className={'pub-cap-item' + (capParam === c.key ? ' active' : '')}
                    onClick={() => setParam('cap', capParam === c.key ? '' : c.key)}
                  >
                    <span className="pub-cap-icon">{c.icon}</span>
                    <span className="pub-cap-label">{c.label}</span>
                    <span className="pub-vendor-count">{cnt}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Price Tier ── */}
            <div className="pub-filter-section">
              <div className="pub-filter-section-title">
                <span>价格区间</span>
              </div>
              <div
                className={'pub-tier-item' + (!tierParam ? ' active' : '')}
                onClick={() => setParam('tier', '')}
              >
                <span className="pub-tier-dot" style={{ background: '#a1a1aa' }} />
                <span className="pub-tier-label">全部价格</span>
                <span className="pub-vendor-count">{allModels.length}</span>
              </div>
              {PRICE_TIERS.map(tier => (
                <div
                  key={tier.key}
                  className={'pub-tier-item' + (tierParam === tier.key ? ' active' : '')}
                  onClick={() => setParam('tier', tierParam === tier.key ? '' : tier.key)}
                >
                  <span className="pub-tier-dot" style={{ background: tier.color }} />
                  <span className="pub-tier-label">{tier.label}</span>
                  <span className="pub-tier-desc">{tier.desc}</span>
                  <span className="pub-vendor-count">{tierStats[tier.key] || 0}</span>
                </div>
              ))}
            </div>

          </aside>

          {/* ════ Main content ════ */}
          <div className="pub-models-main">

            {/* ── Top bar ── */}
            <div className="pub-models-topbar">
              <form
                style={{ position: 'relative', flex: 1, maxWidth: 480 }}
                onSubmit={e => { e.preventDefault(); setParam('q', searchInput.trim()); }}
              >
                <span className="pub-search-icon-left">🔍</span>
                <input
                  ref={searchRef}
                  className="pub-search-v2"
                  placeholder="搜索模型名称、服务商、描述..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onBlur={() => setParam('q', searchInput.trim())}
                />
              </form>
              <div className="pub-topbar-right">
                <span className="pub-result-count">
                  {loading ? '加载中…' : `${filtered.length} 个模型`}
                </span>
                <select
                  className="pub-sort-select-v2"
                  value={sortParam}
                  onChange={e => setParam('sort', e.target.value)}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Active filter chips ── */}
            {activeCount > 0 && (
              <div className="pub-active-chips">
                {qParam && (
                  <span className="pub-active-chip" onClick={() => { setParam('q', ''); setSearchInput(''); }}>
                    🔍 {qParam} <span className="pub-chip-x">×</span>
                  </span>
                )}
                {vendorParam && (
                  <span className="pub-active-chip" onClick={() => setParam('vendor', '')}>
                    📦 {vendorParam} <span className="pub-chip-x">×</span>
                  </span>
                )}
                {capParam && (
                  <span className="pub-active-chip" onClick={() => setParam('cap', '')}>
                    {CAPABILITIES.find(c => c.key === capParam)?.icon} {CAPABILITIES.find(c => c.key === capParam)?.label} <span className="pub-chip-x">×</span>
                  </span>
                )}
                {tierParam && (
                  <span className="pub-active-chip" onClick={() => setParam('tier', '')}>
                    💲 {PRICE_TIERS.find(t => t.key === tierParam)?.label} <span className="pub-chip-x">×</span>
                  </span>
                )}
                <span className="pub-active-chip pub-clear-chip" onClick={clearAll}>
                  清除全部
                </span>
              </div>
            )}

            {/* ── Grid ── */}
            {loading ? (
              <div className="pub-model-grid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="pub-model-card pub-skeleton-card">
                    <div className="pub-skeleton" style={{ height: 44, width: 44, borderRadius: 10 }} />
                    <div style={{ flex: 1 }}>
                      <div className="pub-skeleton" style={{ height: 14, width: '60%' }} />
                      <div className="pub-skeleton" style={{ height: 12, width: '40%', marginTop: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="pub-empty">
                <div className="pub-empty-icon">🔍</div>
                <div className="pub-empty-title">未找到匹配模型</div>
                <div className="pub-empty-desc">请尝试调整搜索词或过滤条件</div>
                <button className="pub-clear-btn" style={{ marginTop: 16, width: 'auto', padding: '8px 20px' }} onClick={clearAll}>
                  清除全部筛选
                </button>
              </div>
            ) : (
              <div className="pub-model-grid">
                {filtered.map(m => (
                  <ModelCard
                    key={m.model_name}
                    model={m}
                    pricing={pricingMap[m.model_name]}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
