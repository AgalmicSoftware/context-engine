import {
  ADMINS_ONLY_ACCESS,
  CONTEXT_FILE_TYPES,
  CONTEXT_ROLE,
  CONTEXT_SOURCE_LIMITS as LIMITS,
  CONTEXT_TAGS as TAGS,
  CONTEXT_TEXT_ROLE,
  contextRoleOf,
  contextTagValue,
  isAdminsOnlyAccess,
} from '../../shared/sessionContextSources.mjs';
import { looksSecret } from '../../shared/secretText.mjs';
import { readPdfWithSessionAi } from './contextDocumentRead.js';
import { fetchContextSnapshotText } from './fetchExecution.js';
import {
  buildIndexKey,
  getStorageIndexBinding,
  listContextSourceRows,
  readContextSourceBytes,
  readContextSourceRow,
  removeCloudflareStorageRecords,
  resolveSessionAdminAddresses,
} from './storageRouteExecution.js';
import { executeCoordinatedContextSourceOperation } from './sessionConfigAuthority.js';

const encoder = new TextEncoder();
const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const clip = (value, max) => trim(value).replace(/\s+/g, ' ').slice(0, max);

const commonTags = (kind) => [
  { name: 'CE-DocLibrary', value: '1' },
  { name: TAGS.kind, value: kind },
  { name: 'CE-DocStorage', value: 'cloudflare' },
];
const isReadingOf = (row, id) =>
  !!row && contextRoleOf(row.tags) === CONTEXT_TEXT_ROLE && contextTagValue(row.tags, TAGS.derivedFrom) === id;

// A source's AI readings. A KV list can lag a recent write, so the readings a
// PDF row points to and those the admin's page shows are read directly too;
// each must be a reading of this PDF.
const readingsOf = async ({ env, slug, row, shownIds = [] }) => {
  const found = new Map((await listContextSourceRows({ env, slug }))
    .filter((entry) => isReadingOf(entry, row.id))
    .map((entry) => [entry.id, entry]));
  const named = [row.contextReadingId, ...(Array.isArray(shownIds) ? shownIds.slice(0, 20) : [])]
    .map(trim)
    .filter((id) => id && !found.has(id));
  for (const id of new Set(named)) {
    const reading = await readContextSourceRow({ env, slug, id });
    if (isReadingOf(reading, row.id)) found.set(id, reading);
  }
  return [...found.values()];
};

// Stores a record through the doc-library upload path and returns its id, or
// the upload's own failure response.
const storeRecord = async (store, payload) => {
  const response = await store(payload);
  if (!response?.ok) return { response };
  const body = await response.clone().json().catch(() => ({}));
  return trim(body?.id) ? { id: trim(body.id) } : { response };
};

// A link: the Worker fetches the page under the strict link policy and stores
// its text with the link. With `replaces`, a refresh of that link: the new
// snapshot keeps its privacy and title, then the old record goes.
const addLink = async ({ body, env, slug, deps, store, json, now }) => {
  const url = trim(body.url);
  let parsed = null;
  try { parsed = url.length <= LIMITS.urlChars ? new URL(url) : null; } catch { parsed = null; }
  if (parsed?.protocol !== 'https:') {
    return json({ error: `Enter an https:// link of at most ${LIMITS.urlChars.toLocaleString('en-US')} characters.` }, 400);
  }
  if (looksSecret(url) || looksSecret(trim(body.title))) {
    return json({ error: 'This link looks like it holds a key, token or password. Remove it: secrets never go in context.' }, 400);
  }
  const replaces = trim(body.replaces) ? await readContextSourceRow({ env, slug, id: body.replaces }) : null;
  if (trim(body.replaces) && (!replaces || contextTagValue(replaces.tags, TAGS.kind) !== 'link')) {
    return json({ error: 'That link is no longer in the session.' }, 404);
  }
  const fetched = await fetchContextSnapshotText({
    url: parsed.toString(),
    deps: { safeFetch: deps?.safeFetch, isBlockedOutboundUrl: deps?.isBlockedOutboundUrl, fetchTimeoutMs: deps?.fetchTimeoutMs },
    maxBytes: LIMITS.pageBytes,
  });
  if (!fetched.ok) {
    return json({ error: `The link could not be read: ${fetched.error || 'no response'}.`, reason: 'context_link_unreadable' },
      fetched.status >= 500 ? 502 : 422);
  }
  const text = fetched.text.slice(0, LIMITS.snapshotChars);
  if (!text.trim()) return json({ error: 'The page has no text to read.', reason: 'context_link_empty' }, 422);
  const title = clip(trim(body.title) || contextTagValue(replaces?.tags, TAGS.name) || fetched.title || parsed.hostname, LIMITS.titleChars);
  const adminsOnly = replaces ? isAdminsOnlyAccess(replaces.accessConditions) : body.adminsOnly === true;
  const fetchedAt = now();
  const record = {
    v: 1,
    kind: 'link',
    url: parsed.toString(),
    title,
    createdAt: fetchedAt,
    snapshot: { text, fetchedAt, contentType: fetched.mediaType, truncated: fetched.text.length > text.length },
  };
  const stored = await storeRecord(store, {
    bytes: encoder.encode(JSON.stringify(record)),
    contentType: 'application/json',
    accessConditions: adminsOnly ? ADMINS_ONLY_ACCESS : null,
    tags: [
      ...commonTags('link'),
      { name: TAGS.role, value: CONTEXT_ROLE },
      { name: TAGS.name, value: title },
      { name: TAGS.mime, value: 'application/json' },
      { name: TAGS.url, value: record.url },
      { name: TAGS.fetchedAt, value: fetchedAt },
    ],
  });
  if (stored.response) return stored.response;
  if (replaces) await removeCloudflareStorageRecords({ env, slug, rows: [replaces] });
  return json({
    ok: true,
    source: {
      id: stored.id, kind: 'link', title, url: record.url, fetchedAt, adminsOnly,
      chars: text.length, truncated: record.snapshot.truncated,
    },
  });
};

// Context changes to a PDF's readings run in the session coordinator.
const coordinate = (deps, args) => (deps?.executeCoordinatedContextSourceOperation || executeCoordinatedContextSourceOperation)(args);
const readAtOf = (row) => contextTagValue(row.tags, TAGS.readAt);

// Run by the session coordinator once a reading is stored. A PDF removed while
// its AI read it takes the text too, and a reading newer than this one stays.
export const finishContextPdfReading = async ({ env, slug, pdfId, readingId, readAt, markWrite }) => {
  const reading = { id: readingId, resource: 'docsContext' };
  const current = await readContextSourceRow({ env, slug, id: pdfId });
  if (!current) {
    await removeCloudflareStorageRecords({ env, slug, rows: [reading], markWrite });
    return { status: 404, body: { error: 'That PDF was removed while the session’s AI read it.' } };
  }
  const earlier = (await readingsOf({ env, slug, row: current })).filter((row) => row.id !== readingId);
  if (earlier.some((row) => readAtOf(row) > readAt || (readAtOf(row) === readAt && row.id > readingId))) {
    await removeCloudflareStorageRecords({ env, slug, rows: [reading], markWrite });
    return { status: 409, body: { error: 'A newer reading of this PDF finished first.', reason: 'context_pdf_reading_superseded' } };
  }
  if (earlier.length) await removeCloudflareStorageRecords({ env, slug, rows: earlier, markWrite });
  // The PDF row names its reading, so removing the PDF finds it without a list.
  await getStorageIndexBinding(env).put(
    buildIndexKey({ slug, resource: 'docsContext', id: pdfId }),
    JSON.stringify({ ...current, contextReadingId: readingId }),
  );
  return { status: 200, body: { ok: true } };
};

// The session's AI reads the PDF; its text is stored beside it with the same privacy.
const readAndStorePdf = async ({ pdf, env, config, slug, admin, deps, store, json, now }) => {
  const bytes = await readContextSourceBytes({ env, config, slug, metadata: pdf, maxBytes: LIMITS.pdfBytes, principal: admin, deps });
  if (!bytes) return { response: json({ error: 'That PDF is no longer in the session.' }, 404) };
  const name = contextTagValue(pdf.tags, TAGS.name) || 'document.pdf';
  const secrets = (await deps?.getSessionSecrets?.(env, slug)) || {};
  const read = await readPdfWithSessionAi({
    config, secrets, bytes, filename: name, deps: { fetch: deps?.fetch, readTimeoutMs: deps?.readTimeoutMs },
  });
  if (!read.ok) return { response: json({ error: read.error, reason: read.reason }, read.status) };
  const readAt = now();
  const text = read.text.slice(0, LIMITS.readTextChars);
  const stored = await storeRecord(store, {
    bytes: encoder.encode(text),
    contentType: 'text/plain',
    // The PDF's own stored rule, so its text is never easier to read than it.
    accessConditions: pdf.accessConditions || null,
    tags: [
      ...commonTags('file'),
      { name: TAGS.role, value: CONTEXT_TEXT_ROLE },
      { name: TAGS.derivedFrom, value: pdf.id },
      { name: TAGS.name, value: clip(`${name} (read by AI).txt`, 180) },
      { name: TAGS.mime, value: 'text/plain' },
      { name: TAGS.readBy, value: 'ai' },
      { name: TAGS.readModel, value: clip(read.model, 120) },
      { name: TAGS.readAt, value: readAt },
    ],
  });
  if (stored.response) return stored;
  return { id: stored.id, model: read.model, readAt, chars: text.length, truncated: read.truncated || read.text.length > text.length };
};

// A PDF: one reading at a time, replacing any earlier reading. A second read
// while one runs is refused rather than paying for the same read twice.
const readPdf = async ({ body, env, config, slug, admin, deps, store, json, now }) => {
  const pdf = await readContextSourceRow({ env, slug, id: body.id });
  if (!pdf || contextRoleOf(pdf.tags) !== CONTEXT_ROLE || pdf.contentType !== CONTEXT_FILE_TYPES.pdf) {
    return json({ error: 'That PDF is no longer in the session.' }, 404);
  }
  if (config?.scopes?.ai === false) return json({ error: 'AI is turned off for this session.', reason: 'ai_disabled' }, 403);
  if (Number(pdf.size) > LIMITS.pdfBytes) return json({ error: 'This PDF is too large for the session’s AI to read.' }, 413);
  const begun = await coordinate(deps, { env, slug, operation: 'begin-read', id: pdf.id });
  if (!begun.ok) return json(begun.body, begun.status);
  const end = (reading = {}) => coordinate(deps, { env, slug, operation: 'end-read', id: pdf.id, token: begun.body.token,
    ...(reading.id ? { readingId: reading.id, readAt: reading.readAt } : {}) });
  let reading;
  try {
    reading = await readAndStorePdf({ pdf, env, config, slug, admin, deps, store, json, now });
  } catch (error) {
    await end();
    throw error;
  }
  const ended = await end(reading);
  if (reading.response) return reading.response;
  if (!ended.ok) return json(ended.body, ended.status);
  const { id, model, readAt, chars, truncated } = reading;
  return json({ ok: true, text: { id, derivedFrom: pdf.id, model, readAt, chars, truncated } });
};

// Run by the session coordinator: removes a source and the text the session's
// AI read from it, readings first so a failure part way never leaves a reading
// without its PDF.
export const removeContextSource = async ({ env, slug, id, readingIds, markWrite }) => {
  const row = await readContextSourceRow({ env, slug, id });
  if (!row) return { status: 404, body: { error: 'That item is no longer in the session.' } };
  const rows = [...await readingsOf({ env, slug, row, shownIds: readingIds }), row];
  await removeCloudflareStorageRecords({ env, slug, rows, markWrite });
  return { status: 200, body: { ok: true, removed: rows.map((entry) => entry.id) } };
};

const remove = async ({ body, env, slug, deps, json }) => {
  const removed = await coordinate(deps, { env, slug, operation: 'remove', id: trim(body.id), readingIds: body.readingIds });
  return json(removed.body, removed.status);
};

const ACTIONS = Object.freeze({ 'add-link': addLink, 'read-pdf': readPdf, remove });

// POST /storage/context { action, ... }: admin-only changes to context
// sources. Files are added through /storage/upload with a context role.
export const contextSourceRoute = async ({
  request, env, config, slug, uploaderAddress, baseHeaders, deps, store,
} = {}) => {
  const json = (body, status = 200) => (deps?.json
    ? deps.json(body, status, baseHeaders)
    : new Response(JSON.stringify(body), { status, headers: baseHeaders }));
  const admin = trim(uploaderAddress).toLowerCase();
  if (!admin || !resolveSessionAdminAddresses(config).has(admin)) {
    return json({ error: 'Only session admins can change context.', reason: 'context_admin_required' }, 403);
  }
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  if (!isObj(body)) return json({ error: 'Invalid JSON.' }, 400);
  const name = trim(body.action);
  if (!Object.hasOwn(ACTIONS, name)) return json({ error: 'Unknown context action.' }, 400);
  const action = ACTIONS[name];
  const now = () => new Date(deps?.now?.() || Date.now()).toISOString();
  return action({ body, env, config, slug, admin, deps, store, json, now });
};
