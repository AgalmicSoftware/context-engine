import { normalizeFetchTargetUrl } from './fetchRequestNormalization.js';
import {
  json as jsonResponse,
} from './responseKvHelpers.js';

const FETCH_CACHE_TTL_SECONDS = 3600;
const FETCH_USER_AGENT = 'ContextEngineSessionCorsWorker';
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

const resolveJson = (deps) => deps?.json || jsonResponse;

const resolveNormalizedTarget = ({ url, deps } = {}) => (
  (deps?.normalizeFetchTargetUrl || normalizeFetchTargetUrl)({
    url,
    deps: {
      isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
    },
  })
);

const fetchNormalizedTarget = async ({
  url,
  baseHeaders,
  deps,
} = {}) => {
  const json = resolveJson(deps);
  const normalized = resolveNormalizedTarget({ url, deps });
  if (!normalized?.ok) {
    return {
      ok: false,
      response: json({ error: normalized?.error }, normalized?.status || 400, baseHeaders),
    };
  }

  const response = await deps?.safeFetch?.(normalized.targetUrl, {
    headers: { 'user-agent': FETCH_USER_AGENT },
    cf: { cacheTtl: FETCH_CACHE_TTL_SECONDS },
  });
  if (!(response instanceof Response)) {
    return {
      ok: false,
      response: json({ error: response?.error }, response?.status, baseHeaders),
    };
  }

  return {
    ok: true,
    response,
    json,
  };
};

const parseContentLength = (response) => parseInt(response?.headers?.get?.('content-length') || '0', 10);

const stripHtml = (html) => (
  String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

export const fetchImage = async ({
  url,
  baseHeaders,
  deps,
} = {}) => {
  const fetchResult = await fetchNormalizedTarget({ url, baseHeaders, deps });
  if (!fetchResult?.ok) return fetchResult?.response;

  const { response, json } = fetchResult;
  const contentLength = parseContentLength(response);
  if (contentLength > MAX_RESPONSE_BYTES) {
    return json({ error: 'Response too large' }, 413, baseHeaders);
  }
  if (!response.ok) {
    return json({ error: `HTTP ${response.status}` }, 400, baseHeaders);
  }

  const type = response.headers.get('content-type') || '';
  if (!type.startsWith('image/')) {
    return json({ error: 'URL must return an image' }, 400, baseHeaders);
  }

  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', type);
  return new Response(response.body, { status: 200, headers });
};

export const fetchUrl = async ({
  url,
  baseHeaders,
  deps,
} = {}) => {
  const fetchResult = await fetchNormalizedTarget({ url, baseHeaders, deps });
  if (!fetchResult?.ok) return fetchResult?.response;

  const { response, json } = fetchResult;
  const contentLength = parseContentLength(response);
  if (contentLength > MAX_RESPONSE_BYTES) {
    return json({ error: 'Response too large' }, 413, baseHeaders);
  }
  if (!response.ok) {
    return json({ error: `HTTP ${response.status}` }, 400, baseHeaders);
  }

  const type = response.headers.get('content-type') || '';
  if (!/text\/html|application\/json/i.test(type)) {
    return json({ error: 'URL must return HTML or JSON' }, 400, baseHeaders);
  }

  if (type.includes('application/json')) {
    const data = await response.json();
    return json({ content: JSON.stringify(data), status: 'success', contentType: type }, 200, baseHeaders);
  }

  const stripped = stripHtml(await response.text());
  if (!stripped || stripped.length < 50) {
    return json({ error: 'Insufficient content extracted' }, 400, baseHeaders);
  }

  return json({ content: stripped, status: 'success', contentType: type }, 200, baseHeaders);
};
