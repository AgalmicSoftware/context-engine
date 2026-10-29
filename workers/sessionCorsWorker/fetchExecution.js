import { BodyByteLimitError, readBodyBytes } from '../shared/bodyByteLimit.mjs';
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

const readFetchBytes = async (response) => {
  try { return await readBodyBytes(response, MAX_RESPONSE_BYTES); }
  catch (error) {
    if (error instanceof BodyByteLimitError) return null;
    throw error;
  }
};

const stripHtml = (html) => {
  const source = String(html || '');
  const lower = source.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  const missingClosers = new Set();
  const text = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor);
    const end = start < 0 ? -1 : source.indexOf('>', start + 1);
    if (end < 0) {
      text.push(source.slice(cursor));
      break;
    }
    text.push(source.slice(cursor, start));
    const hidden = /^<(script|style|head|nav|footer)\b/i.exec(source.slice(start, end + 1))?.[1].toLowerCase();
    if (hidden && !missingClosers.has(hidden)) {
      const closingTag = `</${hidden}>`;
      const closing = lower.indexOf(closingTag, end + 1);
      if (closing >= 0) {
        cursor = closing + closingTag.length;
        continue;
      }
      // Repeated unclosed elements must not keep scanning the same suffix.
      missingClosers.add(hidden);
    }
    text.push(end === start + 1 ? '<>' : ' ');
    cursor = end + 1;
  }
  return text.join('').replace(/\s+/g, ' ').trim();
};

export const fetchImage = async ({
  url,
  baseHeaders,
  deps,
} = {}) => {
  const fetchResult = await fetchNormalizedTarget({ url, baseHeaders, deps });
  if (!fetchResult?.ok) return fetchResult?.response;

  const { response, json } = fetchResult;
  if (!response.ok) {
    return json({ error: `HTTP ${response.status}` }, 400, baseHeaders);
  }

  const type = response.headers.get('content-type') || '';
  if (!type.startsWith('image/')) {
    return json({ error: 'URL must return an image' }, 400, baseHeaders);
  }

  const bytes = await readFetchBytes(response);
  if (!bytes) return json({ error: 'Response too large' }, 413, baseHeaders);
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', type);
  return new Response(bytes, { status: 200, headers });
};

export const fetchUrl = async ({
  url,
  baseHeaders,
  deps,
} = {}) => {
  const fetchResult = await fetchNormalizedTarget({ url, baseHeaders, deps });
  if (!fetchResult?.ok) return fetchResult?.response;

  const { response, json } = fetchResult;
  if (!response.ok) {
    return json({ error: `HTTP ${response.status}` }, 400, baseHeaders);
  }

  const type = response.headers.get('content-type') || '';
  if (!/text\/html|application\/json/i.test(type)) {
    return json({ error: 'URL must return HTML or JSON' }, 400, baseHeaders);
  }

  const bytes = await readFetchBytes(response);
  if (!bytes) return json({ error: 'Response too large' }, 413, baseHeaders);
  const text = new TextDecoder().decode(bytes);
  if (type.includes('application/json')) {
    const data = JSON.parse(text);
    return json({ content: JSON.stringify(data), status: 'success', contentType: type }, 200, baseHeaders);
  }

  const stripped = stripHtml(text);
  if (!stripped || stripped.length < 50) {
    return json({ error: 'Insufficient content extracted' }, 400, baseHeaders);
  }

  return json({ content: stripped, status: 'success', contentType: type }, 200, baseHeaders);
};
