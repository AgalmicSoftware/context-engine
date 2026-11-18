import {
  CONTEXT_ROLE,
  CONTEXT_TAGS as TAGS,
  CONTEXT_TEXT_ROLE,
  contextCardsOn,
  contextFileIsReadByAi,
  contextRoleOf,
  contextTagValue,
  groupLockedIds,
  isAdminsOnlyAccess,
  isContextImage,
} from '../../shared/sessionContextSources.mjs';
import { buildSessionContextPrompt, SESSION_CONTEXT_TEXT_LIMITS } from '../../shared/sessionContextText.mjs';
import { metadataAccessMatchesPublishedAudience } from './storageAudience.js';
import { getStorageIndexBinding } from './storageKvBindings.js';
import { buildIndexPrefix, prefetchKvPayloads, readContextSourceBytes, readContextSourceRow } from './storageRouteExecution.js';
import { StorageReadLimitError, jsonByteLength } from './storageScanBudget.js';
import { contextCardOf } from './contextSourcePolicy.js';

// How much one AI prompt's reading list may cost: rows looked at (chosen from
// the key list before any is read), list pages (40,000 keys, after which the
// rest are not looked at), row bytes, and sources read.
// Reading also stops once the texts fill the caller's block (totalChars): a
// source can be a 1 MB read and a decryption, and the block holds far less.
export const CONTEXT_READ_LIMITS = Object.freeze({ rows: 300, listPages: 40, metadataBytes: 1024 * 1024, sources: 16 });
const MAX_READ_BYTES = 1024 * 1024;
// The next sources' stored bytes are read ahead in one KV bulk get: this many
// at most, so little is read in vain when the block fills early, and of this
// many stored bytes together, which keeps the reply well under KV's 25 MB.
const PREFETCH_SOURCES = 16;
const PREFETCH_BYTES = 8 * 1024 * 1024;
const LIST_PAGE = 1000;
const BULK_GET = 100;
const decoder = new TextDecoder();

const lower = (value) => String(value || '').trim().toLowerCase();
// Rows stored before list entries said who added them, or when, have no time
// there, so they come first among everyone else's: they are the oldest.
const rankOf = (hint) => (hint?.admin === true ? 0 : 1);
const byRank = (a, b) => a.rank - b.rank || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || a.order - b.order;

// The context rows an AI prompt may draw on, at most `rows` of them: from the
// key list alone, the admins' first, then the oldest. More rows than that
// leave the newest out, never all of them, as does a list too long to finish
// or a batch of rows that can't be read. `stopped` says why, for the log.
const listContextRowsInOrder = async ({ env, slug }) => {
  const index = getStorageIndexBinding(env);
  if (typeof index?.list !== 'function' || typeof index?.get !== 'function') return { rows: [], leftOut: 0, stopped: [] };
  const stopped = [];
  const prefix = buildIndexPrefix({ slug, resource: 'docsContext' });
  const candidates = [];
  let cursor = '';
  for (let page = 0; ; page += 1) {
    if (page >= CONTEXT_READ_LIMITS.listPages) {
      stopped.push('list pages limit');
      break;
    }
    const listed = await index.list({ prefix, limit: LIST_PAGE, ...(cursor ? { cursor } : {}) });
    for (const entry of Array.isArray(listed?.keys) ? listed.keys : []) {
      const hint = entry?.metadata;
      // A PDF's reading is found from its PDF, so it never takes a place here.
      if (!entry?.name || hint?.contextSource === false || hint?.reading === true) continue;
      candidates.push({ name: entry.name, rank: rankOf(hint), at: String(hint?.createdAt || ''), order: candidates.length });
    }
    if (listed?.list_complete !== false) break;
    const next = String(listed?.cursor || '').trim();
    if (!next || next === cursor) throw new Error('Cloudflare storage list cursor is unavailable or did not advance.');
    cursor = next;
  }
  const chosen = candidates.sort(byRank).slice(0, CONTEXT_READ_LIMITS.rows);
  // A list cut short holds at least one more row than it shows.
  let leftOut = candidates.length - chosen.length + stopped.length;
  if (chosen.length < candidates.length) stopped.push('rows limit');
  const rows = [];
  let bytes = 0;
  for (let start = 0; start < chosen.length; start += BULK_GET) {
    const keys = chosen.slice(start, start + BULK_GET).map((candidate) => candidate.name);
    let got = null;
    try {
      got = await index.get(keys);
    } catch {
      stopped.push('storage unavailable');
      leftOut += keys.length;
      continue;
    }
    for (const [position, key] of keys.entries()) {
      const raw = got?.get?.(key);
      if (raw == null) continue;
      bytes += jsonByteLength(raw);
      if (bytes > CONTEXT_READ_LIMITS.metadataBytes) {
        stopped.push('row bytes limit');
        return { rows, leftOut: leftOut + chosen.length - start - position, stopped };
      }
      let metadata = null;
      try { metadata = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { metadata = null; }
      if (metadata?.contextSource === true) rows.push(metadata);
    }
  }
  return { rows, leftOut, stopped };
};

// Readable by everyone the session admits: its own access exactly, with no
// admins-only or group rule. Anything narrower, or unreadable here, is left out.
export const forEveryone = (row, config) =>
  row.payloadEncrypted !== true &&
  !(Array.isArray(row.groupIds) && row.groupIds.length) &&
  !isAdminsOnlyAccess(row.accessConditions) &&
  metadataAccessMatchesPublishedAudience(row, config);

const createdAtOf = (row) => Date.parse(row.createdAt) || 0;

// The order an AI reads sources in: what admins added, oldest first, then
// everyone else's, each person's oldest in turn, in the order they first
// added. One person's many notes then never crowd out everyone else's.
export const contextReadingOrder = (rows) => {
  const oldestFirst = [...rows].sort((a, b) => createdAtOf(a) - createdAtOf(b));
  const queues = new Map();
  oldestFirst.filter((row) => row.uploadAuthority !== 'admin').forEach((row) => {
    const who = lower(row.uploader);
    if (!queues.has(who)) queues.set(who, []);
    queues.get(who).push(row);
  });
  const rest = [];
  for (let turn = 0; queues.size; turn += 1) {
    for (const [who, queue] of queues) {
      if (turn < queue.length) rest.push(queue[turn]);
      else queues.delete(who);
    }
  }
  return [...oldestFirst.filter((row) => row.uploadAuthority === 'admin'), ...rest];
};

/**
 * The context sources every participant may read, as texts for the shared
 * prompt block: link snapshots, text files, and the AI's reading of each PDF
 * (an unread PDF gives no text), in contextReadingOrder, until they fill
 * `totalChars`, each counted to `itemChars`, the most of it the caller's
 * block takes. The Worker's own AI features act for participants, so
 * admins-only items never reach them. `readable(row)` narrows or widens that
 * to one person's access; `principal` names who the read is for in the
 * envelope audit; files added by `leaveOutUploaders` (lower-case addresses)
 * are left out, with the AI's readings of them, and counted in `withheld`.
 * `leftOut` counts the sources with text not read for lack of room, and the
 * rows not looked at, which may include some this reader could not have read.
 * `notRead` names the first of those: this reader's own sources with text and
 * a card, as { title, kind, card }, for the prompt block to list.
 * Each source also says who may read it (`everyone` the session admits, or
 * only the `groupIds` it is locked to) and who added it (`uploader`).
 * `unavailable` says the list couldn't be read, in whole or in part, and
 * `failed` how many sources' reads threw: a caller that must not go ahead
 * with less than everything checks both. `unreadable` counts sources this
 * Worker can't read at all.
 */
export const loadParticipantContextSources = async ({
  env, slug, config, deps, readable, principal, leaveOutUploaders, totalChars = SESSION_CONTEXT_TEXT_LIMITS.totalChars,
  maxSources = CONTEXT_READ_LIMITS.sources, itemChars = SESSION_CONTEXT_TEXT_LIMITS.itemChars,
} = {}) => {
  const warn = typeof deps?.log?.warn === 'function' ? deps.log.warn : console.warn;
  let listed = { rows: [], leftOut: 0, stopped: [] };
  try {
    listed = await listContextRowsInOrder({ env, slug });
  } catch {
    // The AI call goes ahead without context, but the operator should know why.
    warn('[context] sources left out of an AI prompt', { slug, reason: 'storage unavailable' });
    return { sources: [], notRead: [], leftOut: 0, withheld: 0, unreadable: 0, failed: 0, unavailable: true };
  }
  if (listed.leftOut > 0) {
    warn('[context] sources left out of an AI prompt', { slug, reason: [...new Set(listed.stopped)].join(', '), leftOut: listed.leftOut });
  }
  const canRead = readable || ((row) => forEveryone(row, config));
  const visible = [];
  for (const row of listed.rows) if (await canRead(row)) visible.push(row);
  const readings = new Map();
  visible
    .filter((row) => contextRoleOf(row.tags) === CONTEXT_TEXT_ROLE)
    .forEach((row) => readings.set(contextTagValue(row.tags, TAGS.derivedFrom), row));
  // A reading listed beside its PDF is used; otherwise the PDF names it.
  const readingOf = async (pdf) => {
    if (readings.has(pdf.id)) return readings.get(pdf.id);
    if (!pdf.contextReadingId) return null;
    const reading = await readContextSourceRow({ env, slug, id: pdf.contextReadingId, strict: true });
    return reading && contextRoleOf(reading.tags) === CONTEXT_TEXT_ROLE &&
      contextTagValue(reading.tags, TAGS.derivedFrom) === pdf.id && await canRead(reading) ? reading : null;
  };
  const sources = [];
  const notRead = [];
  // With cards off, no AI is told of one: its prompt is as it was before cards.
  const cardOf = contextCardsOn(config) ? contextCardOf : () => null;
  const kindOf = (row) => (contextTagValue(row.tags, TAGS.kind) === 'link' ? 'link' : 'file');
  const mine = contextReadingOrder(visible.filter((row) => contextRoleOf(row.tags) === CONTEXT_ROLE));
  const ordered = mine.filter((row) => !leaveOutUploaders?.has(lower(row.uploader)));
  let chars = 0;
  let leftOut = listed.leftOut;
  let unreadable = 0;
  let failed = 0;
  // Reads the next few sources' bytes in one storage round trip in place of
  // one each. Only rows this reader may read reach here, and each read below
  // still checks its own size and takes its bytes from the Map. A row too
  // large to read is left to its own read, which refuses it. So is a PDF
  // whose reading isn't listed beside it (found through the PDF's row, one
  // read more), and every row when the bulk get is refused.
  let prefetched = new Map();
  let prefetchedTo = 0;
  const prefetchFrom = async (start) => {
    const ids = [];
    let bytes = 0;
    let next = start;
    // Each row that will be a source takes a place, read ahead or not, and
    // the window ends where the block would be full: a row's stored size is
    // at least its text's length, so no more is read ahead than may be used.
    let places = Math.min(PREFETCH_SOURCES, maxSources - sources.length);
    let room = totalChars - chars;
    for (; next < ordered.length && places > 0 && room > 0; next += 1) {
      const isPdf = contextFileIsReadByAi(ordered[next].contentType);
      const textRow = isPdf ? readings.get(ordered[next].id) : ordered[next];
      const size = Number(textRow?.size);
      if (!textRow?.id || !(size <= MAX_READ_BYTES)) {
        // A PDF that names its reading is read on its own and still becomes a source.
        if (isPdf && ordered[next].contextReadingId) places -= 1;
        continue;
      }
      if (bytes + size > PREFETCH_BYTES) break;
      ids.push(textRow.id);
      bytes += size;
      places -= 1;
      room -= Math.min(size, itemChars);
    }
    prefetchedTo = Math.max(next, start + 1);
    prefetched = (ids.length > 1 && await prefetchKvPayloads({ env, slug, ids })) || new Map();
  };
  for (const [position, row] of ordered.entries()) {
    if (sources.length >= maxSources || chars >= totalChars) {
      // A PDF the AI never read has no text to leave out.
      const rest = ordered.slice(position)
        .filter((later) => !contextFileIsReadByAi(later.contentType) || readings.has(later.id) || later.contextReadingId);
      leftOut += rest.length;
      // Each passed this reader's own check above, so its card may go where its text would have.
      rest.forEach((later) => {
        const card = cardOf(later);
        if (!card) return;
        // Who may read it, as a source says: a card tells its reader something of a locked file too.
        notRead.push({
          title: contextTagValue(later.tags, TAGS.name), kind: kindOf(later), card,
          everyone: forEveryone(later, config), groupIds: groupLockedIds(later.accessConditions) || [],
        });
      });
      break;
    }
    // A PDF or an image: its text is the AI's reading of it.
    const isPdf = contextFileIsReadByAi(row.contentType);
    // A storage error is a read that failed just now; bytes that are gone, or
    // too large to read here, will never be read.
    let bytes = null;
    try {
      const textRow = isPdf ? await readingOf(row) : row;
      if (!textRow) continue;
      if (position >= prefetchedTo) await prefetchFrom(position);
      bytes = await readContextSourceBytes({
        env, config, slug, metadata: textRow, maxBytes: MAX_READ_BYTES, principal, strict: true, deps, prefetched,
      });
    } catch (error) {
      if (error instanceof StorageReadLimitError) unreadable += 1;
      else failed += 1;
      continue;
    }
    if (!bytes) {
      unreadable += 1;
      continue;
    }
    const kind = kindOf(row);
    let text = decoder.decode(bytes);
    let url = '';
    if (kind === 'link') {
      try {
        const record = JSON.parse(text);
        text = typeof record?.snapshot?.text === 'string' ? record.snapshot.text : '';
        url = typeof record?.url === 'string' ? record.url : '';
      } catch {
        unreadable += 1;
        continue;
      }
    }
    // No caller's block takes more of a text than `itemChars`, so no more is kept: one character
    // over says it was longer. A session's largest files are then never all held at once.
    text = text.trim().slice(0, itemChars + 1);
    sources.push({
      card: cardOf(row),
      title: contextTagValue(row.tags, TAGS.name), kind, url, text, readByAi: isContextImage(row.contentType) ? 'image' : isPdf,
      everyone: forEveryone(row, config), groupIds: groupLockedIds(row.accessConditions) || [], uploader: lower(row.uploader),
    });
    chars += Math.min(text.length, itemChars);
  }
  return {
    sources, notRead, leftOut, withheld: mine.length - ordered.length, unreadable, failed,
    unavailable: listed.stopped.includes('storage unavailable'),
  };
};

/** The session's context block for an AI acting for any participant; '' when none. */
export const buildParticipantContextPrompt = async ({ env, slug, config, deps, totalChars } = {}) => {
  const { sources, notRead } = await loadParticipantContextSources({ env, slug, config, deps, totalChars });
  return buildSessionContextPrompt({ sessionContext: config?.sessionContext, sources, notRead, totalChars }).text;
};
