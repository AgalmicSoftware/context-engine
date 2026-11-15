import {
  CONTEXT_FILE_TYPES,
  CONTEXT_ROLE,
  CONTEXT_TAGS as TAGS,
  CONTEXT_TEXT_ROLE,
  contextRoleOf,
  contextTagValue,
  groupLockedIds,
  isAdminsOnlyAccess,
} from '../../shared/sessionContextSources.mjs';
import { buildSessionContextPrompt, SESSION_CONTEXT_TEXT_LIMITS } from '../../shared/sessionContextText.mjs';
import { metadataAccessMatchesPublishedAudience } from './storageAudience.js';
import { getStorageIndexBinding } from './storageKvBindings.js';
import { buildIndexPrefix, readContextSourceBytes, readContextSourceRow } from './storageRouteExecution.js';
import { StorageReadLimitError, jsonByteLength } from './storageScanBudget.js';

// How much one AI prompt's reading list may cost: rows looked at (chosen from
// the key list before any is read), list pages (40,000 keys, after which the
// rest are not looked at), row bytes, and sources read.
// Reading also stops once the texts fill the caller's block (totalChars): a
// source can be a 1 MB read and a decryption, and the block holds far less.
export const CONTEXT_READ_LIMITS = Object.freeze({ rows: 300, listPages: 40, metadataBytes: 1024 * 1024, sources: 16 });
const MAX_READ_BYTES = 1024 * 1024;
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
 * `totalChars`. The Worker's own AI features act for participants, so
 * admins-only items never reach them. `readable(row)` narrows or widens that
 * to one person's access; `principal` names who the read is for in the
 * envelope audit; files added by `leaveOutUploaders` (lower-case addresses)
 * are left out, with the AI's readings of them, and counted in `withheld`.
 * `leftOut` counts the sources with text not read for lack of room, and the
 * rows not looked at, which may include some this reader could not have read.
 * Each source also says who may read it (`everyone` the session admits, or
 * only the `groupIds` it is locked to) and who added it (`uploader`).
 * `unavailable` says the list couldn't be read, in whole or in part, and
 * `failed` how many sources' reads threw: a caller that must not go ahead
 * with less than everything checks both. `unreadable` counts sources this
 * Worker can't read at all.
 */
export const loadParticipantContextSources = async ({
  env, slug, config, deps, readable, principal, leaveOutUploaders, totalChars = SESSION_CONTEXT_TEXT_LIMITS.totalChars,
  maxSources = CONTEXT_READ_LIMITS.sources,
} = {}) => {
  const warn = typeof deps?.log?.warn === 'function' ? deps.log.warn : console.warn;
  let listed = { rows: [], leftOut: 0, stopped: [] };
  try {
    listed = await listContextRowsInOrder({ env, slug });
  } catch {
    // The AI call goes ahead without context, but the operator should know why.
    warn('[context] sources left out of an AI prompt', { slug, reason: 'storage unavailable' });
    return { sources: [], leftOut: 0, withheld: 0, unreadable: 0, failed: 0, unavailable: true };
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
  const mine = contextReadingOrder(visible.filter((row) => contextRoleOf(row.tags) === CONTEXT_ROLE));
  const ordered = mine.filter((row) => !leaveOutUploaders?.has(lower(row.uploader)));
  let chars = 0;
  let leftOut = listed.leftOut;
  let unreadable = 0;
  let failed = 0;
  for (const [position, row] of ordered.entries()) {
    if (sources.length >= maxSources || chars >= totalChars) {
      // A PDF the AI never read has no text to leave out.
      leftOut += ordered.slice(position)
        .filter((rest) => rest.contentType !== CONTEXT_FILE_TYPES.pdf || readings.has(rest.id) || rest.contextReadingId).length;
      break;
    }
    const isPdf = row.contentType === CONTEXT_FILE_TYPES.pdf;
    // A storage error is a read that failed just now; bytes that are gone, or
    // too large to read here, will never be read.
    let bytes = null;
    try {
      const textRow = isPdf ? await readingOf(row) : row;
      if (!textRow) continue;
      bytes = await readContextSourceBytes({ env, config, slug, metadata: textRow, maxBytes: MAX_READ_BYTES, principal, strict: true, deps });
    } catch (error) {
      if (error instanceof StorageReadLimitError) unreadable += 1;
      else failed += 1;
      continue;
    }
    if (!bytes) {
      unreadable += 1;
      continue;
    }
    const kind = contextTagValue(row.tags, TAGS.kind) === 'link' ? 'link' : 'file';
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
    sources.push({
      title: contextTagValue(row.tags, TAGS.name), kind, url, text, readByAi: isPdf,
      everyone: forEveryone(row, config), groupIds: groupLockedIds(row.accessConditions) || [], uploader: lower(row.uploader),
    });
    chars += Math.min(text.trim().length, SESSION_CONTEXT_TEXT_LIMITS.itemChars);
  }
  return {
    sources, leftOut, withheld: mine.length - ordered.length, unreadable, failed,
    unavailable: listed.stopped.includes('storage unavailable'),
  };
};

/** The session's context block for an AI acting for any participant; '' when none. */
export const buildParticipantContextPrompt = async ({ env, slug, config, deps, totalChars } = {}) => {
  const { sources } = await loadParticipantContextSources({ env, slug, config, deps, totalChars });
  return buildSessionContextPrompt({ sessionContext: config?.sessionContext, sources, totalChars }).text;
};
