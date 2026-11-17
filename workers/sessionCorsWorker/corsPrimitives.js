import { normalizeWorkerAllowOrigins } from './sessionConfigNormalization.js';

export const parseAllowOrigins = (raw) => {
  const cleaned = normalizeWorkerAllowOrigins(raw);
  return cleaned.length ? cleaned : null;
};

export const originAllowed = (origin, allowList) => {
  if (!allowList) return true;
  if (!origin) return true;
  return allowList.includes(origin);
};

export const corsHeaders = (origin, allowList) => {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Slug, X-Group-Slug, X-Anonymous-Client-Id, X-CE-Group-Invite',
    // Browsers keep a preflight's answer this long (ten minutes), so a page
    // polling every 15 seconds stops checking first each time. A header the
    // list lacks still gets a fresh check.
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  });
  const hasAllowList = allowList != null;
  if (!hasAllowList) {
    // Security: omit ACAO when no Origin is present to avoid granting CORS access to non-browser callers. Browsers always send Origin on cross-origin requests.
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
  } else if (origin && allowList.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
};
