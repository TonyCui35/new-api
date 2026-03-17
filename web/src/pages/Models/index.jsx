import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LobeIcons from '@lobehub/icons';
import { API } from '../../helpers/api';
import PublicLayout from '../../components/layout/PublicLayout';
import ModelCard from '../../components/public/ModelCard';

/* ── Lobe icon resolver ─────────────────────────────── */
function resolveLobeIcon(iconStr, size = 20) {
  if (!iconStr) return null;
  try {
    const parts = iconStr.split('.');
    let t = LobeIcons[parts[0]];
    if (!t) return null;
    for (let i = 1; i < parts.length; i++) { t = t[parts[i]]; if (!t) return null; }
    if (typeof t === 'function' || t?.$$typeof) return React.createElement(t, { size });
  } catch (_) {}
  return null;
}

/* ── Pricing helpers ────────────────────────────────── */
const BASE = 0.002; // $0.002 / 1K tokens

function inputUsd(p) {
  if (!p) return null;
  if (p.quota_type === 1) return p.model_price ?? null; // per-call
  return p.model_ratio != null ? p.model_ratio * BASE * 1000 : null;
}
function outputUsd(p) {
  if (!p || p.quota_type === 1) return null;
  return p.model_ratio != null && p.completion_ratio != null
    ? p.completion_ratio * p.model_ratio * BASE * 1000 : null;
}
function fmtUsd(v, perCall = false) {
  if (v == null) return null;
  const n = Number(v);
  if (isNaN(n)) return null;
  const s = n < 0.001 ? n.toFixed(6) : n < 1 ? n.toFixed(4) : n.toFixed(2);
  return perCall ? `$${s}/次` : `$${s}/M`;
}
function priceTier(p) {
  const u = inputUsd(p);
  if (u === null) return null;
  if (u === 0) return 'free';
  if (u < 2) return 'budget';
  if (u <= 10) return 'standard';
  return 'premium';
}

/* ── Colour helper ───────────────────────────────────── */
const PALETTE = ['#7C3AED','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#EC4899','#14B8A6'];
function strColor(s) { let h=0; for (let i=0;i<(s||'').length;i++) h=(h*31+s.charCodeAt(i))>>>0; return PALETTE[h%PALETTE.length]; }

/* ── Sidebar accordion data ──────────────────────────── */
const MODALITY_IN = [
  { key:'text',  label:'Text',  icon:'📝' },
  { key:'image', label:'Image', icon:'🖼' },
  { key:'audio', label:'Audio', icon:'🎵' },
  { key:'video', label:'Video', icon:'🎬' },
];
const MODALITY_OUT = [
  { key:'text-out',  label:'Text',  icon:'📝', match:'chat' },
  { key:'image-out', label:'Image', icon:'🖼', match:'image-generation' },
  { key:'audio-out', label:'Audio', icon:'🎵', match:'audio' },
  { key:'video-out', label:'Video', icon:'🎬', match:'video' },
  { key:'embed-out', label:'Embedding', icon:'📊', match:'embedding' },
];
const PRICE_TIERS = [
  { key:'free',     label:'免费',    dot:'#10b981', desc:'$0' },
  { key:'budget',   label:'经济',    dot:'#3b82f6', desc:'< $2/M' },
  { key:'standard', label:'标准',    dot:'#f59e0b', desc:'$2–10/M' },
  { key:'premium',  label:'高端',    dot:'#ef4444', desc:'> $10/M' },
];
const CATEGORIES = [
  { key:'chat',             icon:'💬', label:'Chat / Text' },
  { key:'vision',           icon:'👁',  label:'Vision' },
  { key:'image-generation', icon:'🖼',  label:'Image Generation' },
  { key:'audio',            icon:'🎵', label:'Audio' },
  { key:'video',            icon:'🎬', label:'Video' },
  { key:'embedding',        icon:'📊', label:'Embedding' },
  { key:'rerank',           icon:'🔀', label:'Reranking' },
  { key:'reasoning',        icon:'🧠', label:'Reasoning' },
];
const SORT_OPTIONS = [
  { value:'default',    label:'Newest' },
  { value:'price_asc',  label:'Price: Low → High' },
  { value:'price_desc', label:'Price: High → Low' },
  { value:'name_asc',   label:'Name A → Z' },
];

/* ── Accordion section ───────────────────────────────── */
function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="or-section">
      <button className="or-section-hd" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span className={'or-section-arrow' + (open ? ' open' : '')}>›</span>
      </button>
      {open && <div className="or-section-body">{children}</div>}
    </div>
  );
}

/* ── Filter row (checkbox style) ────────────────────── */
function FilterRow({ active, onClick, label, icon, count, dot }) {
  return (
    <div className={'or-filter-row' + (active ? ' active' : '')} onClick={onClick}>
      {dot && <span className="or-dot" style={{ background: dot }} />}
      {icon && <span className="or-row-icon">{icon}</span>}
      <span className="or-row-label">{label}</span>
      {count != null && <span className="or-row-count">{count}</span>}
    </div>
  );
}

/* ── Model list row ──────────────────────────────────── */
function ModelRow({ model, pricing }) {
  const vendorSlug = model.vendor_name || 'unknown';
  const modelSlug  = encodeURIComponent(model.model_name);
  const icon       = resolveLobeIcon(model.icon || model.vendor_icon, 22);
  const inUsd      = inputUsd(pricing);
  const outUsd     = outputUsd(pricing);
  const isPerCall  = pricing?.quota_type === 1;
  const inStr      = fmtUsd(inUsd, isPerCall);
  const outStr     = fmtUsd(outUsd);

  /* tags from description tags or endpoint types */
  const rawTags = (model.tags || '').split(',').map(s => s.trim()).filter(Boolean);
  const endpointTags = (model.endpoint_types || [])
    .filter(t => t !== 'openai' && t !== 'chat')
    .map(t => ({ 'image-generation':'Image','audio':'Audio','video':'Video',
                 'embedding':'Embedding','rerank':'Rerank','reasoning':'Reasoning',
                 'vision':'Vision' }[t] || null))
    .filter(Boolean);
  const chips = rawTags.length ? rawTags.slice(0,3) : endpointTags.slice(0,3);

  return (
    <Link to={`/${vendorSlug}/${modelSlug}`} className="or-model-row">
      <div className="or-row-left">
        <div className="or-row-icon-wrap">
          {icon
            ? <span className="or-model-icon">{icon}</span>
            : <span className="or-model-icon" style={{ background: strColor(model.vendor_name || model.model_name), color:'#fff' }}>
                {(model.vendor_name || model.model_name || '?')[0].toUpperCase()}
              </span>
          }
        </div>
        <div className="or-row-body">
          <div className="or-row-name">
            {model.vendor_name
              ? <><span className="or-row-vendor">{model.vendor_name}:</span> {model.model_name}</>
              : model.model_name}
          </div>
          {chips.length > 0 && (
            <div className="or-row-chips">
              {chips.map(c => <span key={c} className="or-chip">{c}</span>)}
            </div>
          )}
          {model.description && (
            <div className="or-row-desc">{model.description}</div>
          )}
          <div className="or-row-meta">
            {model.vendor_name && <span>by <span className="or-meta-vendor">{model.vendor_name}</span></span>}
            {inStr  && <><span className="or-meta-sep">|</span><span>{inStr} input</span></>}
            {outStr && <><span className="or-meta-sep">|</span><span>{outStr} output</span></>}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ══════════════════════════════════════════════════════
   Main page component
   ══════════════════════════════════════════════════════ */
export default function ModelsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allModels,  setAllModels]  = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [viewMode,   setViewMode]   = useState('list'); // 'list' | 'grid'
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorExpanded, setVendorExpanded] = useState(false);

  /* URL params */
  const q       = searchParams.get('q')      || '';
  const vendor  = searchParams.get('vendor') || '';
  const cap     = searchParams.get('cap')    || '';
  const tier    = searchParams.get('tier')   || '';
  const modIn   = searchParams.get('modin')  || '';
  const modOut  = searchParams.get('modout') || '';
  const sort    = searchParams.get('sort')   || 'default';
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);

  const setP = useCallback((key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      val ? next.set(key, val) : next.delete(key);
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const clearAll = () => { setSearchParams({}); setSearchInput(''); };

  /* ── Load ── */
  useEffect(() => {
    let alive = true;
    API.get('/api/pricing').then(res => {
      if (!alive) return;
      const arr = res.data?.data || [];
      const vendors = Array.isArray(res.data?.vendors) ? res.data.vendors : Object.values(res.data?.vendors || {});
      const map = {};
      arr.forEach(p => { map[p.model_name] = p; });

      const models = arr.map(p => {
        const v = vendors.find(vv => (vv.Id || vv.id) === p.vendor_id);
        return {
          model_name:     p.model_name,
          description:    p.description || '',
          icon:           p.icon || '',
          tags:           p.tags || '',
          vendor_id:      p.vendor_id,
          vendor_name:    v ? (v.Name || v.name || '') : '',
          vendor_icon:    v ? (v.Icon || v.icon || '') : '',
          endpoint_types: p.supported_endpoint_types || [],
        };
      });

      setAllModels(models);
      setPricingMap(map);
    }).catch(console.error).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  /* ── Derived counts ── */
  const vendorStats = useMemo(() => {
    const m = {};
    allModels.forEach(model => {
      const n = model.vendor_name || '其他';
      m[n] = (m[n] || 0) + 1;
    });
    return Object.entries(m).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allModels]);

  const capCounts = useMemo(() => {
    const m = {};
    allModels.forEach(model => {
      const s = new Set(model.endpoint_types);
      if (s.has('openai')) s.add('chat');
      if (s.has('chat') || s.has('openai')) s.add('chat');
      CATEGORIES.forEach(c => { if (s.has(c.key)) m[c.key] = (m[c.key] || 0) + 1; });
    });
    return m;
  }, [allModels]);

  const tierCounts = useMemo(() => {
    const m = { free:0, budget:0, standard:0, premium:0 };
    allModels.forEach(model => {
      const t2 = priceTier(pricingMap[model.model_name]);
      if (t2) m[t2] = (m[t2] || 0) + 1;
    });
    return m;
  }, [allModels, pricingMap]);

  /* ── Filter & sort ── */
  const filtered = useMemo(() => {
    let list = allModels;

    if (q) {
      const lq = q.toLowerCase();
      list = list.filter(m =>
        m.model_name.toLowerCase().includes(lq) ||
        m.description.toLowerCase().includes(lq) ||
        m.vendor_name.toLowerCase().includes(lq)
      );
    }
    if (vendor) list = list.filter(m => m.vendor_name === vendor);
    if (cap) {
      list = list.filter(m => {
        const s = new Set(m.endpoint_types);
        if (s.has('openai')) s.add('chat');
        return s.has(cap);
      });
    }
    if (tier) list = list.filter(m => priceTier(pricingMap[m.model_name]) === tier);
    if (modIn) {
      // text = has chat; image = has vision; audio = has audio input; video = has video
      const MAP = { text:'chat', image:'vision', audio:'audio', video:'video' };
      const need = MAP[modIn];
      if (need) list = list.filter(m => {
        const s = new Set(m.endpoint_types);
        if (s.has('openai')) s.add('chat');
        return s.has(need);
      });
    }
    if (modOut) {
      const need = MODALITY_OUT.find(o => o.key === modOut)?.match;
      if (need) list = list.filter(m => m.endpoint_types.includes(need));
    }

    if (sort === 'name_asc') list = [...list].sort((a,b) => a.model_name.localeCompare(b.model_name));
    else if (sort === 'price_asc')  list = [...list].sort((a,b) => (inputUsd(pricingMap[a.model_name]) ?? 9999) - (inputUsd(pricingMap[b.model_name]) ?? 9999));
    else if (sort === 'price_desc') list = [...list].sort((a,b) => (inputUsd(pricingMap[b.model_name]) ?? -1) - (inputUsd(pricingMap[a.model_name]) ?? -1));
    return list;
  }, [allModels, pricingMap, q, vendor, cap, tier, modIn, modOut, sort]);

  const activeCount = [q, vendor, cap, tier, modIn, modOut].filter(Boolean).length;

  /* visible vendors in sidebar */
  const visibleVendors = useMemo(() => {
    const searched = vendorSearch
      ? vendorStats.filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
      : vendorStats;
    return vendorExpanded ? searched : searched.slice(0, 10);
  }, [vendorStats, vendorSearch, vendorExpanded]);

  /* ── Render ── */
  return (
    <PublicLayout>
      <div className="or-page">
        <div className="or-layout">

          {/* ════════ Sidebar ════════ */}
          <aside className="or-sidebar">

            <Section title="Input Modalities" defaultOpen>
              {MODALITY_IN.map(m => (
                <FilterRow
                  key={m.key}
                  active={modIn === m.key}
                  onClick={() => setP('modin', modIn === m.key ? '' : m.key)}
                  icon={m.icon} label={m.label}
                />
              ))}
            </Section>

            <Section title="Output Modalities">
              {MODALITY_OUT.map(m => (
                <FilterRow
                  key={m.key}
                  active={modOut === m.key}
                  onClick={() => setP('modout', modOut === m.key ? '' : m.key)}
                  icon={m.icon} label={m.label}
                />
              ))}
            </Section>

            <Section title="Prompt Pricing">
              {PRICE_TIERS.map(tier2 => (
                <FilterRow
                  key={tier2.key}
                  active={tier === tier2.key}
                  onClick={() => setP('tier', tier === tier2.key ? '' : tier2.key)}
                  dot={tier2.dot}
                  label={`${tier2.label}  ${tier2.desc}`}
                  count={tierCounts[tier2.key]}
                />
              ))}
            </Section>

            <Section title="Categories" defaultOpen>
              {CATEGORIES.map(c => {
                const cnt = capCounts[c.key];
                if (!cnt) return null;
                return (
                  <FilterRow
                    key={c.key}
                    active={cap === c.key}
                    onClick={() => setP('cap', cap === c.key ? '' : c.key)}
                    icon={c.icon} label={c.label} count={cnt}
                  />
                );
              })}
            </Section>

            <Section title="Providers" defaultOpen>
              <input
                className="or-vendor-search"
                placeholder="搜索..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
              />
              {visibleVendors.map(v => (
                <FilterRow
                  key={v.name}
                  active={vendor === v.name}
                  onClick={() => setP('vendor', vendor === v.name ? '' : v.name)}
                  label={v.name}
                  count={v.count}
                  icon={<span style={{
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    width:16, height:16, borderRadius:4, fontSize:9, fontWeight:700,
                    color:'#fff', background:strColor(v.name), flexShrink:0
                  }}>{v.name[0]?.toUpperCase()}</span>}
                />
              ))}
              {vendorStats.length > 10 && !vendorSearch && (
                <button className="or-expand-btn" onClick={() => setVendorExpanded(x => !x)}>
                  {vendorExpanded ? '收起 ↑' : `查看更多 +${vendorStats.length - 10}`}
                </button>
              )}
            </Section>

          </aside>

          {/* ════════ Main ════════ */}
          <div className="or-main">

            {/* Top bar */}
            <div className="or-topbar">
              <h1 className="or-models-title">Models</h1>
              <div className="or-topbar-right">
                <div className="or-search-wrap">
                  <span className="or-search-icon">⌕</span>
                  <input
                    className="or-search"
                    placeholder="Search"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && setP('q', searchInput.trim())}
                    onBlur={() => setP('q', searchInput.trim())}
                  />
                </div>
                {/* View toggle */}
                <div className="or-view-toggle">
                  <button
                    className={'or-view-btn' + (viewMode === 'grid' ? ' active' : '')}
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                  >⊞</button>
                  <button
                    className={'or-view-btn' + (viewMode === 'list' ? ' active' : '')}
                    onClick={() => setViewMode('list')}
                    title="List view"
                  >☰</button>
                </div>
                <select
                  className="or-sort"
                  value={sort}
                  onChange={e => setP('sort', e.target.value)}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Count + active chips */}
            <div className="or-subbar">
              <span className="or-count">
                {loading ? '…' : `${filtered.length} models`}
              </span>
              {activeCount > 0 && (
                <div className="or-chips-row">
                  {q && <span className="or-active-chip" onClick={() => { setP('q',''); setSearchInput(''); }}>🔍 {q} ×</span>}
                  {vendor  && <span className="or-active-chip" onClick={() => setP('vendor','')}>📦 {vendor} ×</span>}
                  {cap     && <span className="or-active-chip" onClick={() => setP('cap','')}>{CATEGORIES.find(c=>c.key===cap)?.icon} {CATEGORIES.find(c=>c.key===cap)?.label} ×</span>}
                  {tier    && <span className="or-active-chip" onClick={() => setP('tier','')}>{PRICE_TIERS.find(t=>t.key===tier)?.label} ×</span>}
                  {modIn   && <span className="or-active-chip" onClick={() => setP('modin','')}>Input: {MODALITY_IN.find(m=>m.key===modIn)?.label} ×</span>}
                  {modOut  && <span className="or-active-chip" onClick={() => setP('modout','')}>Output: {MODALITY_OUT.find(m=>m.key===modOut)?.label} ×</span>}
                  <span className="or-active-chip or-chip-clear" onClick={clearAll}>Clear all</span>
                </div>
              )}
            </div>

            {/* Model list/grid */}
            {loading ? (
              <div className="or-list">
                {Array.from({length:8}).map((_,i) => (
                  <div key={i} className="or-skeleton-row">
                    <div className="pub-skeleton" style={{width:36,height:36,borderRadius:8,flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div className="pub-skeleton" style={{height:14,width:'35%'}} />
                      <div className="pub-skeleton" style={{height:12,width:'70%',marginTop:8}} />
                      <div className="pub-skeleton" style={{height:11,width:'50%',marginTop:6}} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="pub-empty">
                <div className="pub-empty-icon">🔍</div>
                <div className="pub-empty-title">No models found</div>
                <div className="pub-empty-desc">Try adjusting your search or filters</div>
                <button className="pub-clear-btn" style={{marginTop:16,width:'auto',padding:'8px 20px'}} onClick={clearAll}>Clear filters</button>
              </div>
            ) : viewMode === 'list' ? (
              <div className="or-list">
                {filtered.map(m => (
                  <ModelRow key={m.model_name} model={m} pricing={pricingMap[m.model_name]} />
                ))}
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
