// Utility functions for input validation and markup sanitization


import { log } from '../../../iframe/utils/logger';

// Validate publication ID format (alphanumeric, underscore, dash only)
export const validatePublicationId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 100;
};


export const sanitizePublicationIdForStorage = (id) => {
  if (!id || typeof id !== 'string') {
    return '';
  }
  return id.replaceAll(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
};


export const sanitizeInstanceId = (id, defaultValue = "default") => {
  if (!id || typeof id !== 'string') {
    return defaultValue;
  }
  const sanitized = id.replaceAll(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  return sanitized.length > 0 ? sanitized : defaultValue;
};


export const searchStringToObject = (searchStr) => {
  if (!searchStr || typeof searchStr !== 'string') {
    return undefined;
  }

  try {
    const pairs = searchStr.substring(1).split('&');
    if (pairs.length === 0) {
      return undefined;
    }

    const obj = {};
    for (const pairStr of pairs) {
      if (pairStr === '') continue;
      const pair = pairStr.split('=');
      if (pair.length === 2) {
        try {
          const key = decodeURIComponent(pair[0].trim());
          const value = decodeURIComponent(pair[1].trim());
          if (key) {
            obj[key] = value;
          }
        } catch (decodeError) {
          log.warn('[BravaViewerUtils] Failed to decode URL parameter', { pair, error: decodeError });
        }
      }
    }
    return Object.keys(obj).length > 0 ? obj : undefined;
  } catch (error) {
    log.error('[BravaViewerUtils] Error parsing search string', error);
    return undefined;
  }
};


export const viewerLinkFromSearchString = (searchStr) => {
  const searchObj = searchStringToObject(searchStr);
  const type = searchObj?.type;
  if (type === 'bookmark' || type === 'rectangle' || type === 'page') {
    return searchObj;
  }
  return undefined;
};

const SAFE_PROPERTIES = [
  'id', 'type', 'page', 'x', 'y', 'width', 'height', 'color', 'text',
  'author', 'created', 'modified', 'points', 'rotation', 'opacity',
  'strokeWidth', 'fillColor', 'strokeColor', 'fontSize', 'fontFamily'
];

const STRING_PROPS_MAX = { text: 10000, author: 10000, fontFamily: 10000, id: 200, type: 200 };
const NUMERIC_PROPS = new Set(['page', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'strokeWidth', 'fontSize']);
const COLOR_PROPS = new Set(['color', 'fillColor', 'strokeColor']);
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const getSafeStringValue = (prop, value) => {
  if (typeof value !== 'string') return undefined;
  const max = STRING_PROPS_MAX[prop];
  if (max === undefined) return undefined;

  if (value.length <= max) {
    return value;
  }

  return undefined;
};

const getSafeNumericValue = (value) =>
  (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const getSafePointsValue = (value) => {
  if (!Array.isArray(value)) return undefined;
  const valid = value.filter(p =>
    Array.isArray(p) && p.length === 2 &&
    typeof p[0] === 'number' && typeof p[1] === 'number' &&
    Number.isFinite(p[0]) && Number.isFinite(p[1])
  );
  return valid.length === value.length ? valid : undefined;
};

const getSafeColorValue = (value) =>
  (typeof value === 'string' && HEX_COLOR.test(value) ? value : undefined);

const getSafeDateValue = (value) =>
  (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined);

/** Returns { hasValue, value } for a single property; value may be undefined when hasValue is false. */
const getSafePropValue = (prop, value) => {
  if (value === undefined || value === null) return { hasValue: false, value: undefined };
  if (STRING_PROPS_MAX[prop] !== undefined) {
    const v = getSafeStringValue(prop, value);
    return { hasValue: v !== undefined, value: v };
  }
  if (NUMERIC_PROPS.has(prop)) {
    const v = getSafeNumericValue(value);
    return { hasValue: v !== undefined, value: v };
  }
  if (prop === 'points') {
    const v = getSafePointsValue(value);
    return { hasValue: v !== undefined, value: v };
  }
  if (COLOR_PROPS.has(prop)) {
    const v = getSafeColorValue(value);
    return { hasValue: v !== undefined, value: v };
  }
  if (prop === 'created' || prop === 'modified') {
    const v = getSafeDateValue(value);
    return { hasValue: v !== undefined, value: v };
  }
  return { hasValue: false, value: undefined };
};

/** Sanitize a single markup object; returns `null` when invalid. */
const sanitizeOneMarkup = (markup) => {
  if (!markup || typeof markup !== 'object' || Array.isArray(markup)) return null;
  const out = {};
  for (const prop of SAFE_PROPERTIES) {
    if (!Object.hasOwn(markup, prop)) continue;

    // id/type are required string props with stricter handling
    if (prop === 'id' || prop === 'type') {
      const requiredValue = getSafeStringValue(prop, markup[prop]);
      if (requiredValue === undefined) return null;
      out[prop] = requiredValue;
      continue;
    }

    const { hasValue, value } = getSafePropValue(prop, markup[prop]);
    if (hasValue) out[prop] = value;
  }
  if (!out.id || !out.type) return null;
  return out;
};

// Sanitize array of markups for safe storage
export const sanitizeMarkups = (markups) => {
  if (!markups || !Array.isArray(markups)) return null;
  const sanitized = markups.map(sanitizeOneMarkup).filter(m => m !== null);
  return sanitized.length > 0 ? sanitized : null;
};
