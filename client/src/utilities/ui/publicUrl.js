import { toStr } from '../shared/primitives.js';

// We currently deploy from the site root, but keep PUBLIC_URL/base-path support
// so the SPA can still be mounted under a subpath in preview or alternate hosting
// setups without rewriting every internal route helper.
export const readPublicUrlBasePath = (proc = (typeof process !== 'undefined' ? process : undefined)) => {
  const raw = toStr(proc?.env?.PUBLIC_URL || '').trim();
  if (!raw) return '';
  try {
    return toStr(new URL(raw).pathname || '').trim().replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
};
