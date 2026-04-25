import { toStr } from '../shared/primitives.js';
import { ensureHttpUrl } from '../urlUtils.js';

export const WORKER_ENDPOINT_SUFFIXES = Object.freeze([
  '/auth/nonce',
  '/auth/login',
  '/admin/set-config',
  '/admin/set-secrets',
  '/admin/set-limits',
  '/transcribe',
  '/ai',
  '/arweave/upload',
  '/fetch_url',
  '/fetch_image',
  '/fetch',
  '/health',
]);

export const stripWorkerEndpointSuffix = (rawPath: any): string => {
  const base = toStr(rawPath).trim();
  if (!base) return '';
  const cleaned = base.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const lower = cleaned.toLowerCase();
  for (const suffix of WORKER_ENDPOINT_SUFFIXES) {
    if (lower === suffix) return '';
    if (lower.endsWith(suffix)) {
      return cleaned.slice(0, cleaned.length - suffix.length);
    }
  }
  return cleaned;
};

export const normalizeWorkerUrl = (url: any): string => {
  const ensured = ensureHttpUrl(url);
  const raw = toStr(ensured || url).trim();
  if (!raw || raw.startsWith('/')) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    const strippedPath = stripWorkerEndpointSuffix(parsed.pathname);
    const path = strippedPath.replace(/\/+$/, '');
    if (!path || path === '/') return parsed.origin;
    return `${parsed.origin}${path}`;
  } catch {
    return '';
  }
};
