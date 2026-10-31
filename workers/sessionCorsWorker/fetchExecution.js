import { BodyByteLimitError, readBodyBytes } from '../shared/bodyByteLimit.mjs';
import { normalizeFetchTargetUrl } from './fetchRequestNormalization.js';
import { PUBLIC_HTTPS_ARTIFACT_POLICY } from './outboundUrlSafetyBinding.js';
import {
  json as jsonResponse,
} from './responseKvHelpers.js';

const FETCH_CACHE_TTL_SECONDS = 3600;
const FETCH_USER_AGENT = 'ContextEngineSessionCorsWorker';
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 10_000;
const TIMEOUT_ERROR = 'The link took longer than 10 seconds to answer.';
// Pages read as text. A PDF or an image is a file to add instead.
const TEXT_MEDIA_TYPES = new Set([
  'text/html', 'application/xhtml+xml', 'application/json', 'text/plain', 'text/markdown', 'text/x-markdown',
]);
const HTML_MEDIA_TYPES = new Set(['text/html', 'application/xhtml+xml']);
// Not awaited: a cancelled body may settle only when every reader has let go.
const discardBody = (response) => {
  response.body?.cancel?.()?.catch?.(() => {});
};
const isTimeout = (error) => error?.name === 'TimeoutError' || error?.name === 'AbortError';
const mediaTypeOf = (contentType) => String(contentType || '').split(';')[0].trim().toLowerCase();
const decodeText = (bytes, contentType) => {
  const charset = /charset\s*=\s*"?([\w.:-]+)/i.exec(String(contentType || ''))?.[1] || 'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
};

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
  cacheTtl = FETCH_CACHE_TTL_SECONDS,
} = {}) => {
  const json = resolveJson(deps);
  const normalized = resolveNormalizedTarget({ url, deps });
  if (!normalized?.ok) {
    return {
      ok: false,
      response: json({ error: normalized?.error }, normalized?.status || 400, baseHeaders),
    };
  }

  let response;
  try {
    // https only: no credentials, IP literals or private names, and every
    // redirect is checked again. One deadline covers redirects and the body.
    response = await deps?.safeFetch?.(normalized.targetUrl, {
      outboundUrlPolicy: PUBLIC_HTTPS_ARTIFACT_POLICY,
      headers: { 'user-agent': FETCH_USER_AGENT },
      ...(cacheTtl ? { cf: { cacheTtl } } : {}),
      signal: AbortSignal.timeout(deps?.fetchTimeoutMs || FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      response: json({ error: isTimeout(error) ? TIMEOUT_ERROR : 'The link could not be fetched.' },
        isTimeout(error) ? 504 : 502, baseHeaders),
    };
  }
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

const readFetchBytes = async (response, maxBytes = MAX_RESPONSE_BYTES) => {
  try { return await readBodyBytes(response, maxBytes); }
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

  let bytes;
  try { bytes = await readFetchBytes(response); }
  catch (error) {
    if (isTimeout(error)) return json({ error: TIMEOUT_ERROR }, 504, baseHeaders);
    throw error;
  }
  if (!bytes) return json({ error: 'Response too large' }, 413, baseHeaders);
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', type);
  return new Response(bytes, { status: 200, headers });
};

// A public https page as text: HTML stripped, JSON compacted, plain text and
// Markdown as sent. Returns { ok, text, contentType, mediaType } or the
// failure as { ok: false, status, error }.
const fetchPublicText = async ({ url, deps, maxBytes, cacheTtl }) => {
  const failure = (error, status) => ({ ok: false, error, status });
  const fetchResult = await fetchNormalizedTarget({
    url,
    deps: { ...deps, json: (body, status) => ({ body, status }) },
    cacheTtl,
  });
  if (!fetchResult?.ok) return failure(fetchResult?.response?.body?.error, fetchResult?.response?.status);
  const { response } = fetchResult;
  if (!response.ok) {
    discardBody(response);
    return failure(`HTTP ${response.status}`, 400);
  }
  const contentType = response.headers.get('content-type') || '';
  const mediaType = mediaTypeOf(contentType);
  if (!TEXT_MEDIA_TYPES.has(mediaType)) {
    discardBody(response);
    return failure('URL must return a web page, JSON or plain text', 400);
  }
  let bytes;
  try { bytes = await readFetchBytes(response, maxBytes); }
  catch (error) {
    if (isTimeout(error)) return failure(TIMEOUT_ERROR, 504);
    throw error;
  }
  if (!bytes) return failure('Response too large', 413);
  const raw = decodeText(bytes, contentType);
  let text;
  if (mediaType === 'application/json') {
    try { text = JSON.stringify(JSON.parse(raw)); }
    catch { return failure('The link returned JSON that could not be read', 400); }
  } else if (HTML_MEDIA_TYPES.has(mediaType)) text = stripHtml(raw);
  else text = raw.replace(/\r\n?/g, '\n').trim();
  const title = HTML_MEDIA_TYPES.has(mediaType)
    ? (/<title\b[^>]*>([^<]{1,500})<\/title>/i.exec(raw)?.[1] || '').replace(/\s+/g, ' ').trim()
    : '';
  return { ok: true, text, title, contentType, mediaType };
};

export const fetchUrl = async ({
  url,
  baseHeaders,
  deps,
} = {}) => {
  const json = resolveJson(deps);
  const result = await fetchPublicText({ url, deps, maxBytes: MAX_RESPONSE_BYTES, cacheTtl: FETCH_CACHE_TTL_SECONDS });
  if (!result.ok) return json({ error: result.error }, result.status, baseHeaders);
  if (HTML_MEDIA_TYPES.has(result.mediaType) && result.text.length < 50) {
    return json({ error: 'Insufficient content extracted' }, 400, baseHeaders);
  }
  return json({ content: result.text, status: 'success', contentType: result.contentType }, 200, baseHeaders);
};

// A context link's snapshot: uncached, so Refresh reads the page as it is now.
export const fetchContextSnapshotText = ({ url, deps, maxBytes }) =>
  fetchPublicText({ url, deps, maxBytes, cacheTtl: 0 });
