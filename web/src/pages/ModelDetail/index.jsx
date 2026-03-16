import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LobeIcons from '@lobehub/icons';
import { API } from '../../helpers/api';
import PublicLayout from '../../components/layout/PublicLayout';

function resolveLobeIcon(iconStr, size = 36) {
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

function parseTags(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

const BASE = 0.002;

function calcPrice(pricing) {
  if (!pricing) return {};
  if (pricing.quota_type === 1) {
    return { type: 'fixed', model_price: pricing.model_price };
  }
  return {
    type: 'ratio',
    input_usd: pricing.model_ratio != null ? pricing.model_ratio * BASE * 1000 : null,
    output_usd: (pricing.completion_ratio != null && pricing.model_ratio != null)
      ? pricing.completion_ratio * pricing.model_ratio * BASE * 1000
      : null,
    cache_read: (pricing.cache_ratio != null && pricing.model_ratio != null)
      ? pricing.cache_ratio * pricing.model_ratio * BASE * 1000
      : null,
    cache_write: (pricing.create_cache_ratio != null && pricing.model_ratio != null)
      ? pricing.create_cache_ratio * pricing.model_ratio * BASE * 1000
      : null,
    image: pricing.image_ratio != null ? pricing.image_ratio * BASE * 1000 : null,
    audio_in: (pricing.audio_ratio != null && pricing.model_ratio != null)
      ? pricing.audio_ratio * pricing.model_ratio * BASE * 1000
      : null,
    audio_out: (pricing.audio_completion_ratio != null && pricing.model_ratio != null)
      ? pricing.audio_completion_ratio * pricing.model_ratio * BASE * 1000
      : null,
  };
}

function fmt(v, digits = 4) {
  if (v == null) return null;
  return `$${Number(v).toFixed(digits)}`;
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

const CODE_EXAMPLES = {
  curl: (modelId, apiBase) => `curl ${apiBase}/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'`,

  python: (modelId, apiBase) => `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="${apiBase}/v1"
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True,
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`,

  javascript: (modelId, apiBase) => `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: "${apiBase}/v1",
});

const stream = await client.chat.completions.create({
  model: "${modelId}",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`,
};

export default function ModelDetail() {
  const { vendor, model: modelSlug } = useParams();
  const { t } = useTranslation();

  const modelId = decodeURIComponent(modelSlug || '');

  const [pricing, setPricing] = useState(null);
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [codeLang, setCodeLang] = useState('curl');
  const [copied, setCopied] = useState(false);

  const apiBase = typeof window !== 'undefined'
    ? window.location.origin.replace(/^(https?:\/\/)(?!api\.)/, '$1api.')
    : 'https://api.elkapi.com';

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [pricingRes, vendorRes] = await Promise.all([
          API.get('/api/pricing'),
          API.get(`/api/public/vendors/${encodeURIComponent(vendor)}`),
        ]);
        if (!alive) return;

        const pricingArr = pricingRes.data?.data || [];
        const found = pricingArr.find(p => p.model_name === modelId);
        setPricing(found || null);

        if (vendorRes.data?.success) setVendorData(vendorRes.data.vendor);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [vendor, modelId]);

  const price = calcPrice(pricing);
  const tags = parseTags(pricing?.tags);
  const icon = resolveLobeIcon(pricing?.icon || vendorData?.icon, 36);

  const copyCode = () => {
    navigator.clipboard.writeText(CODE_EXAMPLES[codeLang](modelId, apiBase));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const TABS = [
    { key: 'overview', label: t('概览') },
    { key: 'pricing', label: t('价格') },
    { key: 'quickstart', label: t('快速接入') },
  ];

  return (
    <PublicLayout>
      <div className="pub-page">

        {/* Hero */}
        <div className="pub-detail-hero">
          <div className="pub-detail-breadcrumb">
            <Link to="/">{t('首页')}</Link> /
            <Link to="/models">{t('模型')}</Link> /
            <Link to={`/${vendor}`}>{vendor}</Link> /
            <span style={{ color: 'var(--pub-text-2)' }}>{modelId}</span>
          </div>

          <div className="pub-detail-header">
            <div className="pub-detail-icon">
              {loading
                ? <div className="pub-skeleton" style={{ width: '100%', height: '100%' }} />
                : (icon || vendor?.[0]?.toUpperCase())}
            </div>

            <div className="pub-detail-title-group">
              {loading ? (
                <>
                  <div className="pub-skeleton" style={{ height: 32, width: 300, marginBottom: 8 }} />
                  <div className="pub-skeleton" style={{ height: 16, width: 200 }} />
                </>
              ) : (
                <>
                  <h1 className="pub-detail-title">
                    {vendor}: {modelId}
                  </h1>
                  <div className="pub-detail-model-id">
                    <code>{modelId}</code>
                  </div>
                  {tags.length > 0 && (
                    <div className="pub-detail-badges">
                      {tags.map(tag => (
                        <span key={tag} className="pub-badge pub-badge-gray">{tag}</span>
                      ))}
                      {price.type === 'ratio' && price.input_usd != null && (
                        <span className="pub-badge pub-badge-green">
                          {fmt(price.input_usd)}/1M {t('输入')}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pub-detail-actions">
              <Link to="/console/playground" className="pub-btn pub-btn-primary">
                {t('试用')}
              </Link>
              <Link to="/register" className="pub-btn pub-btn-outline">
                {t('获取 API Key')}
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="pub-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={'pub-tab' + (activeTab === tab.key ? ' active' : '')}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pub-tab-content">

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div style={{ maxWidth: 720 }}>
              {loading ? (
                <>
                  <div className="pub-skeleton" style={{ height: 18, width: '100%', marginBottom: 10 }} />
                  <div className="pub-skeleton" style={{ height: 18, width: '85%', marginBottom: 10 }} />
                  <div className="pub-skeleton" style={{ height: 18, width: '70%' }} />
                </>
              ) : (
                <>
                  {pricing?.description ? (
                    <p style={{ fontSize: 15, color: 'var(--pub-text-2)', lineHeight: 1.7, marginBottom: 24 }}>
                      {pricing.description}
                    </p>
                  ) : (
                    <p style={{ fontSize: 15, color: 'var(--pub-text-3)', fontStyle: 'italic' }}>
                      {t('暂无模型描述。')}
                    </p>
                  )}

                  {vendorData?.description && (
                    <div style={{
                      background: 'var(--pub-surface-2)',
                      border: '1px solid var(--pub-border)',
                      borderRadius: 'var(--pub-radius)',
                      padding: '16px 20px',
                      marginTop: 24,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--pub-text-3)', marginBottom: 8 }}>
                        {t('服务商介绍')}
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--pub-text-2)', lineHeight: 1.6, margin: 0 }}>
                        {vendorData.description}
                      </p>
                    </div>
                  )}

                  {/* Quick info cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 32 }}>
                    <InfoCard label={t('模型 ID')} value={modelId} mono />
                    <InfoCard label={t('服务商')} value={vendor} />
                    {price.type === 'fixed'
                      ? <InfoCard label={t('定价类型')} value={t('固定价格')} />
                      : <InfoCard label={t('定价类型')} value={t('按 Token 计费')} />
                    }
                    {price.input_usd != null && (
                      <InfoCard label={t('输入价格')} value={`${fmt(price.input_usd)}/1M tokens`} highlight />
                    )}
                    {price.output_usd != null && (
                      <InfoCard label={t('输出价格')} value={`${fmt(price.output_usd)}/1M tokens`} highlight />
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Pricing tab */}
          {activeTab === 'pricing' && (
            <div style={{ maxWidth: 640 }}>
              {loading ? (
                <div className="pub-skeleton" style={{ height: 200, width: '100%' }} />
              ) : !pricing ? (
                <div className="pub-empty">
                  <div className="pub-empty-icon">💰</div>
                  <div className="pub-empty-title">{t('暂无价格信息')}</div>
                </div>
              ) : (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--pub-text)' }}>
                    {t('Token 价格')}
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--pub-text-3)', marginLeft: 8 }}>
                      USD / 1M tokens
                    </span>
                  </h3>
                  <table className="pub-pricing-table">
                    <thead>
                      <tr>
                        <th>{t('类型')}</th>
                        <th>{t('每百万 Token 价格')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {price.type === 'fixed' ? (
                        <tr>
                          <td>{t('每次调用')}</td>
                          <td className="pub-price-highlight">{fmt(price.model_price)}</td>
                        </tr>
                      ) : (
                        <>
                          {price.input_usd != null && (
                            <tr>
                              <td>{t('输入（Prompt）')}</td>
                              <td className="pub-price-highlight">{fmt(price.input_usd)}</td>
                            </tr>
                          )}
                          {price.output_usd != null && (
                            <tr>
                              <td>{t('输出（Completion）')}</td>
                              <td className="pub-price-highlight">{fmt(price.output_usd)}</td>
                            </tr>
                          )}
                          {price.cache_read != null && (
                            <tr>
                              <td>{t('缓存读取')}</td>
                              <td className="pub-price-highlight">{fmt(price.cache_read)}</td>
                            </tr>
                          )}
                          {price.cache_write != null && (
                            <tr>
                              <td>{t('缓存写入')}</td>
                              <td className="pub-price-highlight">{fmt(price.cache_write)}</td>
                            </tr>
                          )}
                          {price.audio_in != null && (
                            <tr>
                              <td>{t('音频输入')}</td>
                              <td className="pub-price-highlight">{fmt(price.audio_in)}</td>
                            </tr>
                          )}
                          {price.audio_out != null && (
                            <tr>
                              <td>{t('音频输出')}</td>
                              <td className="pub-price-highlight">{fmt(price.audio_out)}</td>
                            </tr>
                          )}
                          {price.image != null && (
                            <tr>
                              <td>{t('图像生成')}</td>
                              <td className="pub-price-highlight">{fmt(price.image)}</td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>

                  <p style={{ fontSize: 12, color: 'var(--pub-text-3)', marginTop: 12 }}>
                    * {t('实际价格按汇率及账户倍率计算，以控制台显示为准。')}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Quickstart tab */}
          {activeTab === 'quickstart' && (
            <div style={{ maxWidth: 720 }}>
              <p style={{ fontSize: 14, color: 'var(--pub-text-2)', marginBottom: 24 }}>
                {t('ElkAPI 与 OpenAI SDK 完全兼容，只需更换 base_url 和 API Key 即可接入。')}
              </p>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pub-text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                  {t('API 地址')}
                </div>
                <code style={{
                  display: 'block',
                  background: 'var(--pub-surface-2)',
                  border: '1px solid var(--pub-border)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'var(--pub-primary)',
                  fontFamily: 'Monaco, Courier New, monospace',
                }}>
                  {apiBase}/v1
                </code>
              </div>

              {/* Language tabs */}
              <div className="pub-code-tabs">
                {['curl', 'python', 'javascript'].map(lang => (
                  <button
                    key={lang}
                    className={'pub-code-tab' + (codeLang === lang ? ' active' : '')}
                    onClick={() => setCodeLang(lang)}
                  >
                    {lang === 'javascript' ? 'JS / TS' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <pre className="pub-code-block">
                  {CODE_EXAMPLES[codeLang](modelId, apiBase)}
                </pre>
                <button
                  onClick={copyCode}
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'var(--pub-surface-2)',
                    border: '1px solid var(--pub-border)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    color: 'var(--pub-text-2)',
                  }}
                >
                  <CopyIcon />
                  {copied ? t('已复制') : t('复制')}
                </button>
              </div>

              <div style={{ marginTop: 24 }}>
                <Link to="/register" className="pub-btn pub-btn-primary">{t('获取 API Key')}</Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </PublicLayout>
  );
}

function InfoCard({ label, value, mono, highlight }) {
  return (
    <div style={{
      background: 'var(--pub-surface)',
      border: '1px solid var(--pub-border)',
      borderRadius: 'var(--pub-radius-sm)',
      padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--pub-text-3)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? 'var(--pub-green)' : 'var(--pub-text)',
        fontFamily: mono ? 'Monaco, Courier New, monospace' : undefined,
        wordBreak: 'break-all',
      }}>
        {value || '—'}
      </div>
    </div>
  );
}
