// Auto-detect base path from script URL, pathname, or env variable


import { log } from '../../../iframe/utils/logger';

const SCRIPT_ASSETS_REGEX = /^(\/[^/]+)\/assets\//;
const COMMON_ROUTES = ['dashboard', 'login', 'cases', 'digidak', 'inbox', 'outbox', 'createCase', 'viewCase', 'searchCase'];

/** Trim trailing slashes without regex (avoids ReDoS). "/foo/bar///" → "/foo/bar", "/" → "". */
const trimTrailingSlashes = (s) => {
  if (!s || typeof s !== 'string') return s;
  let end = s.length;
  while (end > 0 && s[end - 1] === '/') end--;
  return s.slice(0, end);
};


const getBasePathFromScriptUrl = () => {
  if (typeof document === 'undefined') return undefined;
  const mainScript = document.querySelector('script[src*="/assets/"], script[src*="main-"]');
  if (!mainScript?.src) return undefined;
  try {
    const scriptUrl = new URL(mainScript.src, globalThis.location.origin);
    const match = scriptUrl.pathname.match(SCRIPT_ASSETS_REGEX);
    if (match?.[1] && match[1] !== '/assets') return match[1];
  } catch (e) {
    log.warn('[GetBasePath] Failed to parse script URL', { error: e });
  }
  return undefined;
};


const getBasePathFromPathname = () => {
  if (typeof window === 'undefined' || !globalThis.location) return undefined;
  try {
    const pathname = globalThis.location.pathname;
    const cleanPath = trimTrailingSlashes(pathname);
    if (cleanPath === '' || cleanPath === '/') {
      if (typeof document !== 'undefined') {
        const base = document.querySelector('base');
        if (base?.href) {
          try {
            const baseUrl = new URL(base.href);
            const basePath = trimTrailingSlashes(baseUrl.pathname);
            if (basePath && basePath !== '/') return basePath;
          } catch (e) {
            log.warn('[GetBasePath] Failed to parse base URL', { error: e });
          }
        }
      }
      return undefined;
    }
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length > 0 && !COMMON_ROUTES.includes(parts[0].toLowerCase())) {
      return `/${parts[0]}`;
    }
  } catch (e) {
    log.warn('[GetBasePath] Failed to extract from pathname', { error: e });
  }
  return undefined;
};


const getBasePathFromEnv = () => {
  const envBasePath = import.meta.env.VITE_BASE_PATH;
  if (!envBasePath || envBasePath === '/') return undefined;
  return envBasePath.startsWith('/') ? envBasePath : `/${envBasePath}`;
};

export const getBasePath = () =>
  getBasePathFromScriptUrl() ?? getBasePathFromPathname() ?? getBasePathFromEnv() ?? '/';


export const getBaseUrl = () => {
  try {
    const basePath = getBasePath();

    if (typeof window === 'undefined' || !globalThis.location) {
      return basePath;
    }

    const origin = globalThis.location.origin;

    if (basePath === '/') {
      return origin;
    }

    return `${origin}${basePath}`;
  } catch (error) {
    log.error('[GetBasePath] Error getting base URL', error);
    return typeof window !== 'undefined' && globalThis.location ? globalThis.location.origin : '/';
  }
};

