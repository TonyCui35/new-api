import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers/api';
import PublicLayout from '../../components/layout/PublicLayout';
import ModelCard from '../../components/public/ModelCard';

const SORT_OPTIONS = [
  { value: 'default', labelKey: '默认' },
  { value: 'price_asc', labelKey: '价格从低到高' },
  { value: 'price_desc', labelKey: '价格从高到低' },
  { value: 'name_asc', labelKey: '名称 A-Z' },
];

const TAG_FILTERS = ['chat', 'vision', 'image', 'audio', 'video', 'embedding', 'code', 'reasoning'];

export default function ModelsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allModels, setAllModels] = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  const [vendorList, setVendorList] = useState([]);
  const [loading, setLoading] = useState(true);

  const qParam = searchParams.get('q') || '';
  const vendorParam = searchParams.get('vendor') || '';
  const tagParam = searchParams.get('tag') || '';
  const sortParam = searchParams.get('sort') || 'default';

  const [searchInput, setSearchInput] = useState(qParam);

  useEffect(() => { setSearchInput(qParam); }, [qParam]);

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
        const map = {};
        pricingArr.forEach(p => { map[p.model_name] = p; });

        const pricingVendors = pricingRes.data?.vendors || [];
        const vendorArr = Array.isArray(pricingVendors) ? pricingVendors : Object.values(pricingVendors);
        const publicVendors = vendorRes.data?.data || [];
        const countMap = {};
        publicVendors.forEach(v => { countMap[v.name] = v.model_count; });

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

        const vendors = vendorArr
          .filter(v => (v.Status || v.status) === 1)
          .map(v => ({ name: v.Name || v.name, model_count: countMap[v.Name || v.name] || 0 }))
          .sort((a, b) => b.model_count - a.model_count);

        setAllModels(models);
        setPricingMap(map);
        setVendorList(vendors);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const setParam = useCallback((key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set(key, val); else next.delete(key);
      if (key !== 'sort') next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setParam('q', searchInput.trim());
  };

  const filtered = useMemo(() => {
    let list = allModels;
    if (qParam) {
      const lq = qParam.toLowerCase();
      list = list.filter(m =>
        m.model_name.toLowerCase().includes(lq) ||
        (m.description || '').toLowerCase().includes(lq) ||
        (m.tags || '').toLowerCase().includes(lq)
      );
    }
    if (vendorParam) {
      list = list.filter(m => m.vendor_name === vendorParam);
    }
    if (tagParam) {
      list = list.filter(m => (m.tags || '').toLowerCase().includes(tagParam));
    }
    if (sortParam === 'name_asc') {
      list = [...list].sort((a, b) => a.model_name.localeCompare(b.model_name));
    } else if (sortParam === 'price_asc') {
      list = [...list].sort((a, b) => {
        const ap = pricingMap[a.model_name]?.model_ratio || 0;
        const bp = pricingMap[b.model_name]?.model_ratio || 0;
        return ap - bp;
      });
    } else if (sortParam === 'price_desc') {
      list = [...list].sort((a, b) => {
        const ap = pricingMap[a.model_name]?.model_ratio || 0;
        const bp = pricingMap[b.model_name]?.model_ratio || 0;
        return bp - ap;
      });
    }
    return list;
  }, [allModels, qParam, vendorParam, tagParam, sortParam, pricingMap]);

  return (
    <PublicLayout>
      <div className="pub-page">
        <div className="pub-layout-with-sidebar">

          {/* Sidebar filters */}
          <aside className="pub-sidebar">
            {/* Vendor filter */}
            <div className="pub-filter-group">
              <div className="pub-filter-label">{t('服务商')}</div>
              <div
                className={'pub-filter-item' + (!vendorParam ? ' active' : '')}
                onClick={() => setParam('vendor', '')}
              >
                {t('全部')}
                <span className="pub-filter-count">{allModels.length}</span>
              </div>
              {vendorList.map(v => (
                <div
                  key={v.name}
                  className={'pub-filter-item' + (vendorParam === v.name ? ' active' : '')}
                  onClick={() => setParam('vendor', v.name)}
                >
                  {v.name}
                  <span className="pub-filter-count">{v.model_count}</span>
                </div>
              ))}
            </div>

            {/* Tag filter */}
            <div className="pub-filter-group">
              <div className="pub-filter-label">{t('类型')}</div>
              {TAG_FILTERS.map(tag => (
                <div
                  key={tag}
                  className={'pub-filter-item' + (tagParam === tag ? ' active' : '')}
                  onClick={() => setParam('tag', tagParam === tag ? '' : tag)}
                >
                  {t(tag)}
                </div>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <div>
            {/* Sort bar */}
            <div className="pub-sort-bar">
              <form onSubmit={handleSearchSubmit} style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                <input
                  className="pub-search"
                  style={{ height: 38, fontSize: 13 }}
                  placeholder={t('搜索模型名称、描述...')}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="pub-result-count">
                  {loading ? '…' : `${filtered.length} ${t('个模型')}`}
                </span>
                <select
                  className="pub-sort-select"
                  value={sortParam}
                  onChange={e => setParam('sort', e.target.value)}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filters chips */}
            {(qParam || vendorParam || tagParam) && (
              <div className="pub-chips" style={{ marginBottom: 16 }}>
                {qParam && (
                  <button className="pub-chip active" onClick={() => setParam('q', '')}>
                    🔍 {qParam} ×
                  </button>
                )}
                {vendorParam && (
                  <button className="pub-chip active" onClick={() => setParam('vendor', '')}>
                    {vendorParam} ×
                  </button>
                )}
                {tagParam && (
                  <button className="pub-chip active" onClick={() => setParam('tag', '')}>
                    {t(tagParam)} ×
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="pub-model-grid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="pub-model-card" style={{ minHeight: 180 }}>
                    <div className="pub-skeleton" style={{ height: 40, width: '100%' }} />
                    <div className="pub-skeleton" style={{ height: 14, width: '70%', marginTop: 10 }} />
                    <div className="pub-skeleton" style={{ height: 14, width: '50%', marginTop: 6 }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="pub-empty">
                <div className="pub-empty-icon">🔍</div>
                <div className="pub-empty-title">{t('未找到匹配模型')}</div>
                <div className="pub-empty-desc">{t('请尝试调整搜索词或过滤条件')}</div>
              </div>
            ) : (
              <div className="pub-model-grid">
                {filtered.map(m => (
                  <ModelCard key={m.model_name} model={m} pricing={pricingMap[m.model_name]} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
