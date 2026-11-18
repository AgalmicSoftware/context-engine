import {
  ADMINS_ONLY_ACCESS,
  CONTEXT_ROLE,
  CONTEXT_SOURCE_LIMITS as LIMITS,
  CONTEXT_TAGS as TAGS,
  CONTEXT_TEXT_ROLE,
  contextAdderProblem,
  contextCardsOn,
  contextFileByteLimit,
  contextFileIsReadByAi,
  contextFileNoun,
  contextRoleOf,
  contextTagValue,
  groupLockedAccess,
  isAdminsOnlyAccess,
  lockedGroupsOf,
  participantsMayAddContext,
} from '../../shared/sessionContextSources.mjs';
import { contextCardContent } from '../../shared/contextCards.mjs';
import { looksSecret } from '../../shared/secretText.mjs';
import { resolveSessionLifecycle } from '../shared/sessionLifecycle.mjs';
import { cardAfterContextAdd, makeContextCard, readContextCardText, setContextCard } from './contextCard.js';
import { readFileWithSessionAi } from './contextDocumentRead.js';
import { contextCardOf, mayHaveContextCard } from './contextSourcePolicy.js';
import { fetchContextSnapshotText } from './fetchExecution.js';
import {
  buildIndexKey,
  getStorageIndexBinding,
  listContextSourceRows,
  readContextSourceBytes,
  readContextSourceRow,
  removeCloudflareStorageRecords,
  resolveSessionAdminAddresses,
  storageIndexPutOptions,
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

// A source's AI readings (a PDF's or an image's). A KV list can lag a recent write, so the readings a
// file's row points to and those the admin's page shows are read directly too;
// each must be a reading of this file.
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

// An agent's self-declared mark and name for a link it adds, as the tags a file carries.
const adderTagsOf = (body) => [
  { name: TAGS.adderKind, value: trim(body.adder) },
  { name: TAGS.adderName, value: trim(body.adderName) },
].filter((tag) => tag.value);

// Who may read a link, as for a file: everyone the session admits, its admins
// alone, or the members of some of its groups. A refresh keeps the link's own.
const linkAccessOf = (body, replaces) => {
  const kept = replaces?.accessConditions;
  if (replaces) {
    if (isAdminsOnlyAccess(kept)) return { accessConditions: ADMINS_ONLY_ACCESS };
    const groups = lockedGroupsOf(kept);
    return { accessConditions: groups.length ? groupLockedAccess(groups) : null };
  }
  const named = body.groupIds;
  if (named === undefined || (Array.isArray(named) && !named.length)) {
    return { accessConditions: body.adminsOnly === true ? ADMINS_ONLY_ACCESS : null };
  }
  if (body.adminsOnly === true) return { error: 'Choose some groups or the admins alone, not both.' };
  const access = Array.isArray(named) ? groupLockedAccess(named) : null;
  return access && lockedGroupsOf(access).length
    ? { accessConditions: access }
    : { error: `Name between 1 and ${LIMITS.lockedGroups} of the session’s groups.` };
};

// A link: the Worker fetches the page under the strict link policy and stores
// its text with the link. With `replaces`, a refresh of that link: the same
// page read again, whose snapshot keeps the link's title, privacy and adder,
// then the old record goes.
const addLink = async ({ body, env, config, slug, deps, store, json, now }) => {
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
  if (replaces && contextTagValue(replaces.tags, TAGS.url) !== parsed.toString()) {
    return json({ error: 'A refresh reads the same link again; add another link as a new item.' }, 400);
  }
  // A refresh keeps the link's agent mark, as the store keeps its adder.
  const adderTags = adderTagsOf(replaces
    ? { adder: contextTagValue(replaces.tags, TAGS.adderKind), adderName: contextTagValue(replaces.tags, TAGS.adderName) }
    : body);
  const adderProblem = contextAdderProblem(adderTags);
  if (adderProblem) return json({ error: adderProblem, reason: 'context_adder_invalid' }, 400);
  const access = linkAccessOf(body, replaces);
  if (access.error) return json({ error: access.error, reason: 'context_policy_unsupported' }, 400);
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
  const title = clip((replaces ? contextTagValue(replaces.tags, TAGS.name) : trim(body.title)) || fetched.title || parsed.hostname,
    LIMITS.titleChars);
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
    accessConditions: access.accessConditions,
    // A refreshed link stays its first adder's, who may still remove it. A new
    // one is counted by its address: its page text and time change each fetch.
    ...(replaces ? { contextUploader: replaces.uploader } : { countKey: `link:${record.url}` }),
    tags: [
      ...commonTags('link'),
      { name: TAGS.role, value: CONTEXT_ROLE },
      { name: TAGS.name, value: title },
      { name: TAGS.mime, value: 'application/json' },
      { name: TAGS.url, value: record.url },
      { name: TAGS.fetchedAt, value: fetchedAt },
      ...adderTags,
    ],
  });
  if (stored.response) return stored.response;
  // The old record goes as any removal does, in the session coordinator, which hands back
  // the card it held at that moment: a card someone wrote while the page was being read
  // again is carried over, and none is written onto a record already gone.
  const old = replaces ? await coordinate(deps, { env, slug, operation: 'remove', id: replaces.id }) : null;
  if (old && !old.ok && old.status !== 404) {
    // The old record stays, so the one just stored goes: a refresh that fails
    // leaves the link as it was, not there twice.
    await removeCloudflareStorageRecords({ env, slug, rows: [{ id: stored.id, resource: 'docsContext' }] }).catch(() => {});
    return json(old.body, old.status);
  }
  // A refreshed link keeps a card a person wrote; otherwise the page just read gets a new one.
  await cardAfterContextAdd({ env, config, slug, id: stored.id, text, carried: old?.body?.card || null, deps });
  return json({
    ok: true,
    source: {
      id: stored.id, kind: 'link', title, url: record.url, fetchedAt,
      adminsOnly: isAdminsOnlyAccess(access.accessConditions), lockedGroupIds: lockedGroupsOf(access.accessConditions),
      chars: text.length, truncated: record.snapshot.truncated,
    },
  });
};

// Context changes to a file's readings run in the session coordinator.
const coordinate = (deps, args) => (deps?.executeCoordinatedContextSourceOperation || executeCoordinatedContextSourceOperation)(args);
const readAtOf = (row) => contextTagValue(row.tags, TAGS.readAt);

// Run by the session coordinator once a reading is stored. A file removed while
// the AI read it takes the text too, and a reading newer than this one stays.
export const finishContextPdfReading = async ({ env, slug, pdfId, readingId, readAt, markWrite }) => {
  const reading = { id: readingId, resource: 'docsContext' };
  const current = await readContextSourceRow({ env, slug, id: pdfId });
  if (!current) {
    await removeCloudflareStorageRecords({ env, slug, rows: [reading], markWrite });
    return { status: 404, body: { error: 'That file was removed while the session’s AI read it.' } };
  }
  const earlier = (await readingsOf({ env, slug, row: current })).filter((row) => row.id !== readingId);
  if (earlier.some((row) => readAtOf(row) > readAt || (readAtOf(row) === readAt && row.id > readingId))) {
    await removeCloudflareStorageRecords({ env, slug, rows: [reading], markWrite });
    return { status: 409, body: { error: 'A newer reading of this file finished first.', reason: 'context_pdf_reading_superseded' } };
  }
  if (earlier.length) await removeCloudflareStorageRecords({ env, slug, rows: earlier, markWrite });
  // The file's row names its reading, so removing the file finds it without a list.
  const row = { ...current, contextReadingId: readingId };
  await getStorageIndexBinding(env).put(
    buildIndexKey({ slug, resource: 'docsContext', id: pdfId }),
    JSON.stringify(row),
    storageIndexPutOptions(row),
  );
  return { status: 200, body: { ok: true } };
};

// The session's AI reads the PDF or image; its text is stored beside it with the same privacy.
const readAndStorePdf = async ({ pdf, env, config, slug, admin, deps, store, json, now }) => {
  const noun = contextFileNoun(pdf.contentType);
  const bytes = await readContextSourceBytes({
    env, config, slug, metadata: pdf, maxBytes: contextFileByteLimit(pdf.contentType), principal: admin, deps,
  });
  if (!bytes) return { response: json({ error: `That ${noun} is no longer in the session.` }, 404) };
  const name = contextTagValue(pdf.tags, TAGS.name) || (noun === 'PDF' ? 'document.pdf' : 'image');
  const secrets = (await deps?.getSessionSecrets?.(env, slug)) || {};
  const read = await readFileWithSessionAi({
    config, secrets, bytes, filename: name, contentType: pdf.contentType, deps: { fetch: deps?.fetch, readTimeoutMs: deps?.readTimeoutMs },
  });
  if (!read.ok) return { response: json({ error: read.error, reason: read.reason }, read.status) };
  const readAt = now();
  const text = read.text.slice(0, LIMITS.readTextChars);
  const stored = await storeRecord(store, {
    bytes: encoder.encode(text),
    contentType: 'text/plain',
    // The file's own stored rule, so its text is never easier to read than it.
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
  return { id: stored.id, model: read.model, readAt, text, chars: text.length, truncated: read.truncated || read.text.length > text.length };
};

// A PDF or an image: one reading at a time, replacing any earlier reading. A second read
// while one runs is refused rather than paying for the same read twice.
const readPdf = async ({ body, env, config, slug, admin, deps, store, json, now }) => {
  const pdf = await readContextSourceRow({ env, slug, id: body.id });
  if (!pdf || contextRoleOf(pdf.tags) !== CONTEXT_ROLE || !contextFileIsReadByAi(pdf.contentType)) {
    return json({ error: 'That PDF or image is no longer in the session.' }, 404);
  }
  if (config?.scopes?.ai === false) return json({ error: 'AI is turned off for this session.', reason: 'ai_disabled' }, 403);
  if (Number(pdf.size) > contextFileByteLimit(pdf.contentType)) {
    return json({ error: `This ${contextFileNoun(pdf.contentType)} is too large for the session’s AI to read.` }, 413);
  }
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
  // The file's card is made from the text just read, and sits on the file's row.
  await cardAfterContextAdd({ env, config, slug, id: pdf.id, text: reading.text, deps });
  return json({ ok: true, text: { id, derivedFrom: pdf.id, model, readAt, chars, truncated } });
};

// Run by the session coordinator: removes a source and the text the session's
// AI read from it, readings first so a failure part way never leaves a reading
// without its PDF.
export const removeContextSource = async ({ env, slug, id, readingIds, markWrite }) => {
  // A row that can't be read just now is an error, never "already gone".
  const row = await readContextSourceRow({ env, slug, id, strict: true });
  if (!row) return { status: 404, body: { error: 'That item is no longer in the session.' } };
  const rows = [...await readingsOf({ env, slug, row, shownIds: readingIds }), row];
  await removeCloudflareStorageRecords({ env, slug, rows, markWrite });
  const card = contextCardOf(row);
  // The card goes with the source; a link's refresh takes it for the new record.
  return { status: 200, body: { ok: true, removed: rows.map((entry) => entry.id), ...(card ? { card } : {}) } };
};

const remove = async ({ body, env, slug, deps, json }) => {
  const removed = await coordinate(deps, { env, slug, operation: 'remove', id: trim(body.id), readingIds: body.readingIds });
  const { card: _card, ...reply } = removed.body || {};
  return json(reply, removed.status);
};

// A person writes a source's card, or with `card: null` takes it off.
const setCard = async ({ body, env, slug, admin, isAdmin, deps, json, now }) => {
  const content = body.card === null ? null : contextCardContent(body.card);
  if (body.card !== null && !content) {
    return json({ error: 'A card needs a summary, tags or names.', reason: 'context_card_invalid' }, 400);
  }
  if (content && looksSecret([content.summary, ...content.tags, ...content.names].join(' '))) {
    return json({ error: 'This card looks like it holds a key, token or password. Remove it: secrets never go in context.' }, 400);
  }
  const set = await setContextCard({
    env, slug, id: trim(body.id), deps, card: content && { ...content, by: isAdmin ? 'admin' : 'adder', at: now() },
  });
  return json(set.body, set.status);
};

// The session's AI writes the card of a source that has none, or only one it wrote before.
const makeCard = async ({ body, env, config, slug, admin, deps, json }) => {
  const row = await readContextSourceRow({ env, slug, id: body.id });
  if (!row || contextRoleOf(row.tags) !== CONTEXT_ROLE) return json({ error: 'That item is no longer in the session.' }, 404);
  if (!mayHaveContextCard(row)) return json({ error: 'An item stored encrypted has no card.', reason: 'context_card_unsupported' }, 409);
  const current = contextCardOf(row);
  if (current && current.by !== 'ai') return json({ ok: true, card: current, kept: true });
  if (config?.scopes?.ai === false) return json({ error: 'AI is turned off for this session.', reason: 'ai_disabled' }, 403);
  const text = await readContextCardText({ env, config, slug, row, principal: admin, deps });
  if (!text.trim()) {
    return json({ error: 'This item has no text to describe. Have the session’s AI read a PDF or image first.', reason: 'context_card_no_text' }, 409);
  }
  const made = await makeContextCard({
    env, config, secrets: (await deps?.getSessionSecrets?.(env, slug)) || {}, deps, text,
    title: contextTagValue(row.tags, TAGS.name), kind: contextTagValue(row.tags, TAGS.kind),
  });
  if (!made.ok) return json({ error: 'The session’s AI could not write this card.', reason: made.reason }, made.reason === 'ai_disabled' ? 403 : 502);
  const set = await setContextCard({ env, slug, id: row.id, card: made.card, deps });
  return json(set.body, set.status);
};

const ACTIONS = Object.freeze({ 'add-link': addLink, 'read-pdf': readPdf, remove, 'set-card': setCard, 'make-card': makeCard });

// POST /storage/context { action, ... }: admins change context sources. Anyone
// else may remove what they added and write its card, and add a link while the session takes
// additions and hasn't ended, when they may have the Worker fetch pages. Where cards are on,
// they may also have the session's AI read a PDF or image they added, once, as one of their
// AI calls for the day. Refreshing a link, reading a file again and having the AI write a
// card stay with admins, as each makes the Worker work again for an item already there.
// Files are added through /storage/upload with a context role.
export const contextSourceRoute = async ({
  request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps, store, authorizeAdd, checkFetchAccess, checkAiAccess,
} = {}) => {
  const json = (body, status = 200) => (deps?.json
    ? deps.json(body, status, baseHeaders)
    : new Response(JSON.stringify(body), { status, headers: baseHeaders }));
  const admin = trim(uploaderAddress).toLowerCase();
  const refused = () => json({ error: 'Only session admins can change context.', reason: 'context_admin_required' }, 403);
  if (!admin) return refused();
  const isAdmin = resolveSessionAdminAddresses(config).has(admin);
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  const name = isObj(body) ? trim(body.action) : '';
  const participantMay = ['remove', 'set-card'].includes(name) || (name === 'read-pdf' && contextCardsOn(config)) ||
    (name === 'add-link' && !trim(body.replaces));
  if (!isAdmin && !participantMay) return refused();
  if (!isObj(body)) return json({ error: 'Invalid JSON.' }, 400);
  if (!Object.hasOwn(ACTIONS, name)) return json({ error: 'Unknown context action.' }, 400);
  if (['set-card', 'make-card'].includes(name) && !contextCardsOn(config)) {
    return json({ error: 'Context cards are off for this session.', reason: 'context_cards_off' }, 409);
  }
  // A card is words the AI may be shown, and so is a reading, so writing one is adding:
  // not where the session limits context to admins, and not once it has ended.
  if (!isAdmin && ['set-card', 'read-pdf'].includes(name)) {
    if (!participantsMayAddContext(config)) return refused();
    if (resolveSessionLifecycle(config, { now: deps?.now }).ended) {
      return json({ error: 'This session has ended.', code: 'session_ended' }, 410);
    }
  }
  // Checked before the Worker fetches anything; the upload path checks again as it stores.
  if (name === 'add-link') {
    if (!isAdmin && !participantsMayAddContext(config)) {
      return json({ error: 'Only session admins can add context.', reason: 'context_admin_required' }, 403);
    }
    if (!isAdmin && resolveSessionLifecycle(config, { now: deps?.now }).ended) {
      return json({ error: 'This session has ended.', code: 'session_ended' }, 410);
    }
    const access = await authorizeAdd();
    if (!access.ok) return access.response;
    if (!isAdmin) {
      // A participant's link has the Worker fetch a page for them, so it takes the
      // fetch scope of their sign-in and counts against their daily limit, as /fetch does.
      if (authScopes?.fetch !== true) {
        return json({
          error: 'This session doesn’t let you have its Worker fetch pages, so you can’t add links.',
          reason: 'context_link_fetch_denied',
        }, 403);
      }
      // Any other refusal, such as a failed authorization check or the daily limit, is /fetch's own.
      const fetchAccess = await checkFetchAccess?.();
      if (!fetchAccess?.ok) return fetchAccess?.response || json({ error: 'Fetch access could not be checked.' }, 403);
    }
  }
  if (!isAdmin && participantMay && name !== 'add-link') {
    // A row that can't be read proves nothing, so it removes nothing, and its card stays as it is.
    const row = await readContextSourceRow({ env, slug, id: body.id });
    if (!row) return json({ error: 'That item is no longer in the session.' }, 404);
    if (trim(row.uploader).toLowerCase() !== admin) return refused();
    if (name === 'read-pdf') {
      if (!contextFileIsReadByAi(row.contentType)) return json({ error: 'That PDF or image is no longer in the session.' }, 404);
      // One reading for its adder. Another would spend the session's AI again on a file it has read.
      if (row.contextReadingId) {
        return json({ error: 'The session’s AI has read this file. Only session admins can have it read again.', reason: 'context_admin_required' }, 403);
      }
      // It spends the session's AI for them, so it takes the AI scope of their sign-in and
      // counts against their daily limit, as /ai does. Counted last, once nothing else refuses.
      if (authScopes?.ai !== true) {
        return json({ error: 'This session doesn’t let you use its AI, so only an admin can have this file read.', reason: 'context_read_ai_denied' }, 403);
      }
      const aiAccess = await checkAiAccess?.();
      if (!aiAccess?.ok) return aiAccess?.response || json({ error: 'AI access could not be checked.' }, 403);
    }
  }
  const action = ACTIONS[name];
  const now = () => new Date(deps?.now?.() || Date.now()).toISOString();
  return action({ body, env, config, slug, admin, isAdmin, deps, store, json, now });
};
