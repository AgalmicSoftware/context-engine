import { normalizeInterviewSettings } from '../../shared/interviewSettings.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { checkUploadedAnswers } from './responseAnswerValidation.js';
import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { getStorageIndexBinding } from './storageKvBindings.js';

// The AI's drafted text for a question, kept apart from responses (which public
// sessions publish) where only config admins can read it. No other reader lists
// this prefix, and backups leave it out on purpose.
export const DRAFT_TEXT_PATHS = Object.freeze(['/storage/draft-text/put', '/storage/draft-text/delete', '/storage/draft-text/export']);
export const draftTextPrefix = (slug) => `ce-draft-text:${sessionSlugStorageKey(slug)}:`;

const MAX_BODY_CHARS = 2 * 1024 * 1024;
const MAX_ITEMS = 200;
// The app's limit for freeform answers and AI-drafted comments.
const MAX_TEXT_CHARS = 8000;
// Rows run to about 16,000 characters each, so a page stays a few megabytes.
const EXPORT_PAGE_ROWS = 250;
const KV_BULK_GET_KEYS = 100;
const ORIGINS = new Set(['external_prefill', 'voice_interview', 'typed_context', 'group_recording', 'wrapped_agent', 'unknown']);
const CONDITIONS = new Set(['shown', 'blind']);
const ITEM_KEYS = new Set(['questionId', 'aiAnswer', 'aiComment', 'origin', 'condition']);

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const address = (value) => (/^0x[0-9a-f]{40}$/i.test(String(value || '')) ? String(value).toLowerCase() : '');
const response = (body, status, headers) => new Response(JSON.stringify(body), {
  status, headers: { ...Object.fromEntries(new Headers(headers || {})), 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
});
const rowKey = async (slug, principal, questionId) =>
  `${draftTextPrefix(slug)}${await sha256Hex(`${principal}|${questionId.toLowerCase()}`)}`;

const readBody = async (request, maxChars) => {
  if (Number(request.headers.get('content-length') || 0) > maxChars) return { status: 413 };
  try {
    const text = await request.text();
    if (text.length > maxChars) return { status: 413 };
    const body = JSON.parse(text);
    return isObj(body) ? { body } : { status: 400 };
  } catch { return { status: 400 }; }
};

const optionalText = (value) => value === undefined || value === null || (typeof value === 'string' && value.length <= MAX_TEXT_CHARS);
const hasText = (value) => typeof value === 'string' && !!value.trim();

const checkItems = (body) => {
  const { items } = body;
  if (Object.keys(body).some((key) => key !== 'items') || !Array.isArray(items) || !items.length) return 'Send items: a list of drafts.';
  if (items.length > MAX_ITEMS) return `Send at most ${MAX_ITEMS} drafts at once.`;
  const seen = new Set();
  for (const item of items) {
    if (!isObj(item) || Object.keys(item).some((key) => !ITEM_KEYS.has(key))) return 'A draft has a field this route does not accept.';
    const questionId = typeof item.questionId === 'string' ? item.questionId.trim() : '';
    if (!questionId || questionId.length > 256) return 'Each draft needs a questionId.';
    if (seen.has(questionId.toLowerCase())) return 'Each question may appear once.';
    seen.add(questionId.toLowerCase());
    if (!optionalText(item.aiAnswer) || !optionalText(item.aiComment)) return `Draft text is limited to ${MAX_TEXT_CHARS} characters a field.`;
    if (!hasText(item.aiAnswer) && !hasText(item.aiComment)) return 'Each draft needs an aiAnswer or aiComment.';
    if (item.origin !== undefined && !ORIGINS.has(item.origin)) return 'Unknown draft origin.';
    if (item.condition !== undefined && !CONDITIONS.has(item.condition)) return 'Unknown draft condition.';
  }
  return '';
};

const put = async ({ request, env, config, slug, principal, index, authorizeSession, deps, headers }) => {
  if (normalizeInterviewSettings(config?.interviewMode).keepDraftTextForAdmins !== true) {
    return response({ error: 'This session does not keep draft text.', reason: 'draft_text_disabled' }, 403, headers);
  }
  const read = await readBody(request, MAX_BODY_CHARS);
  if (!read.body) return response({ error: read.status === 413 ? 'Draft text request too large.' : 'Invalid draft text request.' }, read.status, headers);
  const invalid = checkItems(read.body);
  if (invalid) return response({ error: invalid }, 400, headers);
  // The same session gate a response upload passes.
  const access = await authorizeSession();
  if (!access?.ok) return access?.response || response({ error: 'Session access required.' }, 403, headers);
  const items = read.body.items.map((item) => ({ ...item, questionId: item.questionId.trim() }));
  // Only the session's own questions, so each person holds at most one row per question.
  const known = await checkUploadedAnswers({
    env, config, index, slug, deps, payload: { responses: items.map((item) => ({ questionID: item.questionId })) },
  });
  if (!known.ok) return response({ error: known.error, reason: known.reason }, known.status || 422, headers);
  const savedAt = new Date().toISOString();
  for (const item of items) {
    const row = {
      responder: principal, questionId: item.questionId,
      aiAnswer: typeof item.aiAnswer === 'string' ? item.aiAnswer : null,
      aiComment: typeof item.aiComment === 'string' ? item.aiComment : null,
      origin: item.origin || null, condition: item.condition || null, savedAt,
    };
    await index.put(await rowKey(slug, principal, item.questionId), JSON.stringify(row), { metadata: { responder: principal } });
  }
  return response({ ok: true, saved: items.length }, 200, headers);
};

const ownsRow = async (index, entry, principal) => {
  if (entry.metadata?.responder) return entry.metadata.responder === principal;
  try { return JSON.parse(await index.get(entry.name))?.responder === principal; } catch { return false; }
};

// Withdrawal works whatever the setting and after the session ends, and never
// needs the questions to still exist.
const remove = async ({ request, slug, principal, index, headers }) => {
  const read = await readBody(request, MAX_BODY_CHARS);
  if (!read.body) return response({ error: read.status === 413 ? 'Delete request too large.' : 'Invalid delete request.' }, read.status, headers);
  const { questionIds, all } = read.body;
  const keys = Object.keys(read.body);
  const byIds = keys.length === 1 && Array.isArray(questionIds) && questionIds.length <= MAX_ITEMS &&
    questionIds.every((id) => typeof id === 'string' && id.trim() && id.trim().length <= 256);
  if (!byIds && !(keys.length === 1 && all === true)) {
    return response({ error: `Send questionIds (at most ${MAX_ITEMS}) or all: true.` }, 400, headers);
  }
  if (byIds) {
    for (const id of questionIds) await index.delete(await rowKey(slug, principal, id.trim()));
    return response({ ok: true }, 200, headers);
  }
  // Find every row first: deleting while paging could move a list cursor past rows.
  const owned = [];
  let cursor = '';
  do {
    const listed = await index.list({ prefix: draftTextPrefix(slug), ...(cursor ? { cursor } : {}) });
    for (const entry of listed?.keys || []) if (await ownsRow(index, entry, principal)) owned.push(entry.name);
    const next = listed?.list_complete === false ? String(listed.cursor || '') : '';
    if (listed?.list_complete === false && (!next || next === cursor)) throw new Error('Draft text list cursor did not advance.');
    cursor = next;
  } while (cursor);
  for (const name of owned) await index.delete(name);
  return response({ ok: true }, 200, headers);
};

const exportRows = async ({ request, slug, principal, index, isConfigAdmin, headers }) => {
  // Only whoever may change the session config: not co-admins or results admins.
  if (typeof isConfigAdmin !== 'function' || await isConfigAdmin(principal) !== true) return response({ error: 'Draft text export requires a session config admin.' }, 403, headers);
  const read = await readBody(request, 8192);
  if (!read.body) return response({ error: read.status === 413 ? 'Export request too large.' : 'Invalid export request.' }, read.status, headers);
  const { cursor = '' } = read.body;
  if (Object.keys(read.body).some((key) => key !== 'cursor') || typeof cursor !== 'string' || cursor.length > 2048) {
    return response({ error: 'Invalid export request.' }, 400, headers);
  }
  let listed;
  try {
    listed = await index.list({ prefix: draftTextPrefix(slug), limit: EXPORT_PAGE_ROWS, ...(cursor ? { cursor } : {}) });
  } catch { return response({ error: 'Invalid export cursor. Restart the export.' }, 400, headers); }
  const names = (listed?.keys || []).map((entry) => entry.name);
  const rows = [];
  for (let start = 0; start < names.length; start += KV_BULK_GET_KEYS) {
    const values = await index.get(names.slice(start, start + KV_BULK_GET_KEYS));
    for (const name of names.slice(start, start + KV_BULK_GET_KEYS)) {
      let row = null;
      try { row = JSON.parse(values.get(name)); } catch { row = null; }
      if (!isObj(row) || !address(row.responder)) continue;
      rows.push({
        responder: row.responder, questionId: row.questionId, aiAnswer: row.aiAnswer ?? null, aiComment: row.aiComment ?? null,
        origin: row.origin ?? null, condition: row.condition ?? null, savedAt: row.savedAt ?? null,
      });
    }
  }
  return response({
    type: 'ce_draft_text_export', version: 1, sessionSlug: slug, exportedAt: new Date().toISOString(),
    rows, cursor: listed?.list_complete === false ? String(listed.cursor || '') || null : null,
  }, 200, headers);
};

export const draftTextRoute = async ({ path, request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps, authorizeSession, isConfigAdmin }) => {
  const principal = address(uploaderAddress);
  if (!principal || (authScopes?.storage !== true && authScopes?.arweave !== true)) return response({ error: 'Authentication required.' }, 401, baseHeaders);
  const index = getStorageIndexBinding(env);
  if (!index?.get || !index?.put || !index?.delete || !index?.list) return response({ error: 'Draft text storage is unavailable.' }, 503, baseHeaders);
  const args = { request, env, config, slug, principal, index, deps, headers: baseHeaders };
  if (path === '/storage/draft-text/put') return put({ ...args, authorizeSession });
  if (path === '/storage/draft-text/delete') return remove(args);
  return exportRows({ ...args, isConfigAdmin });
};
