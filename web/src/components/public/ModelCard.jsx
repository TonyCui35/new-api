import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LobeIcons from '@lobehub/icons';

/* Resolve a lobehub icon string like "OpenAI", "Claude.Color", "Gemini.Avatar" */
function resolveLobeIcon(iconStr, size = 28) {
  if (!iconStr) return null;
  try {
    const parts = iconStr.split('.');
    let target = LobeIcons[parts[0]];
    if (!target) return null;

    // Subkey like .Color, .Avatar etc.
    for (let i = 1; i < parts.length; i++) {
      target = target[parts[i]];
      if (!target) return null;
    }

    if (typeof target === 'function' || (target && target.$$typeof)) {
      return React.createElement(target, { size });
    }
  } catch (_) {}
  return null;
}

/* Format USD per 1M tokens */
function fmtPrice(val) {
  if (val == null || val === 0) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < 0.001) return `$${(n * 1000000).toFixed(4)}/1M`;
  return `$${n.toFixed(4)}/1M`;
}

/* Given a Pricing entry, compute $/M input and $/M output in USD */
function getPricingDisplay(pricing) {
  if (!pricing) return { input: null, output: null };

  const BASE = 0.002; // $0.002 per 1K tokens default ratio unit (used by new-api)

  if (pricing.quota_type === 1) {
    // fixed price model
    return {
      input: pricing.model_price != null ? `$${Number(pricing.model_price).toFixed(4)}/次` : null,
      output: null,
    };
  }

  // ratio-based: ModelRatio * 0.002 * 1000 gives $/1M
  const inputUsd =
    pricing.model_ratio != null ? pricing.model_ratio * BASE * 1000 : null;
  const outputUsd =
    pricing.completion_ratio != null && pricing.model_ratio != null
      ? pricing.completion_ratio * pricing.model_ratio * BASE * 1000
      : null;

  return { input: fmtPrice(inputUsd), output: fmtPrice(outputUsd) };
}

/* Parse tags string → array, fallback to endpoint types */
const ENDPOINT_LABEL = {
  'openai': 'Chat',
  'image-generation': 'Image',
  'embeddings': 'Embedding',
  'audio': 'Audio',
  'speech': 'TTS',
  'transcription': 'STT',
  'video': 'Video',
  'rerank': 'Rerank',
  'moderation': 'Moderation',
};

function getDisplayTags(model) {
  const tagStr = model.tags || '';
  const fromTags = tagStr.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  if (fromTags.length > 0) return fromTags;
  // Fallback: use endpoint types
  const endpoints = model.supported_endpoint_types || [];
  return [...new Set(endpoints.map(e => ENDPOINT_LABEL[e] || e).filter(Boolean))].slice(0, 3);
}

/* Deterministic color from string */
const PALETTE = ['#7C3AED','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316'];
function strColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function ModelCard({ model, pricing }) {
  const { t } = useTranslation();

  if (!model) return null;

  const vendor = model.vendor_name || '';
  const modelId = model.model_name || '';
  const icon = resolveLobeIcon(model.icon || model.vendor_icon);
  const tags = getDisplayTags(model);
  const price = getPricingDisplay(pricing);

  // Slug for URL
  const vendorSlug = vendor || 'unknown';
  const modelSlug = encodeURIComponent(modelId);

  return (
    <Link
      to={`/${vendorSlug}/${modelSlug}`}
      className="pub-model-card"
    >
      {/* Card header */}
      <div className="pub-card-header">
        <div
          className="pub-card-icon"
          style={!icon ? { background: strColor(vendor || modelId), color: '#fff', fontWeight: 700, fontSize: 16 } : {}}
        >
          {icon || (vendor ? vendor[0].toUpperCase() : modelId[0]?.toUpperCase() || '?')}
        </div>
        <div className="pub-card-meta">
          <div className="pub-card-name" title={modelId}>{modelId}</div>
          {vendor && <div className="pub-card-vendor">{vendor}</div>}
        </div>
      </div>

      {/* Description */}
      {model.description && (
        <div className="pub-card-desc">{model.description}</div>
      )}

      {/* Tags / capabilities */}
      {tags.length > 0 && (
        <div className="pub-card-tags">
          {tags.map(tag => (
            <span key={tag} className="pub-tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Pricing */}
      <div className="pub-card-pricing">
        <div className="pub-price-row">
          <span className="pub-price-label">{t('输入')}</span>
          {price.input
            ? <span className="pub-price-value">{price.input}</span>
            : <span className="pub-price-na">—</span>}
        </div>
        {price.output && (
          <div className="pub-price-row">
            <span className="pub-price-label">{t('输出')}</span>
            <span className="pub-price-value">{price.output}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
