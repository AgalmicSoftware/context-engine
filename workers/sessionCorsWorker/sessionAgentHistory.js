// Chats with the Session Agent that the person asking chose to store: one
// entry per exchange in the session's coordinator, under its own prefix. An
// entry holds the day, the answer style, the question, the answer and what the
// answer drew on, and says who asked only when they chose that. Nothing reads
// these back into an answer.
import { SESSION_AGENT_LIMITS } from '../../shared/sessionAgent.mjs';

const PREFIX = 'session-agent-history-v1:';
const META_KEY = 'session-agent-history-meta-v1';
const DELETE_BATCH = 128;
const ID = /^\d{12}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const SESSION_AGENT_HISTORY_LIMITS = Object.freeze({ stored: 5000, page: 100 });
const L = { ...SESSION_AGENT_HISTORY_LIMITS, ...SESSION_AGENT_LIMITS };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refuse = (status, reason) => json({ ok: false, reason }, status);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
const idOf = (sequence) => String(sequence).padStart(12, '0');

/**
 * One stored exchange as it is kept, or null when it isn't one. `by` and
 * `name` are there only when the asker chose them: without them nothing in the
 * entry says who asked.
 */
export const sessionAgentHistoryEntry = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const question = text(value.question);
  const answer = text(value.answer);
  const by = text(value.by).toLowerCase();
  const name = text(value.name);
  if (!DAY.test(text(value.day)) || !['general', 'detailed'].includes(value.answers)) return null;
  if (!question || question.length > L.questionChars || !answer || answer.length > L.answerChars) return null;
  if ((by && !ADDRESS.test(by)) || name.length > L.nameChars) return null;
  return {
    day: text(value.day),
    answers: value.answers,
    question,
    answer,
    read: { context: count(value.read?.context), results: value.read?.results === true, answers: count(value.read?.answers) },
    ...(by ? { by } : {}),
    ...(name ? { name } : {}),
  };
};

/**
 * Puts a backup's chats back under their own ids. One the target already holds
 * with the same words is left as it is; if the target holds a different chat
 * under any of the ids, nothing is written and those keys come back as
 * `conflicts`. `journal(key)` is told each key before it is first written, so
 * an abandoned restore can take them out again.
 */
export const restoreSessionAgentHistory = async (storage, entries, journal = async () => {}) => {
  const missing = [];
  const conflicts = [];
  for (const { id, ...entry } of entries) {
    const existing = await storage.get(PREFIX + id);
    if (existing == null) missing.push([PREFIX + id, entry]);
    else if (JSON.stringify(existing) !== JSON.stringify(entry)) conflicts.push(PREFIX + id);
  }
  if (conflicts.length) return { written: 0, skipped: 0, conflicts };
  for (const [key, entry] of missing) {
    await journal(key);
    await storage.put(key, entry);
  }
  if (missing.length) {
    const meta = await storage.get(META_KEY);
    if (meta == null) await journal(META_KEY);
    await storage.put(META_KEY, {
      next: Math.max(count(meta?.next), Number(entries.at(-1).id)),
      stored: meta == null ? entries.length : count(meta.stored) + missing.length,
    });
  }
  return { written: missing.length, skipped: entries.length - missing.length, conflicts };
};

/** A backup's entries as they must be: each a whole exchange under its own id, none twice, oldest first. */
export const isSessionAgentHistoryBackup = (entries) =>
  Array.isArray(entries) && entries.length <= L.stored && entries.every((row, index) => {
    if (!row || typeof row.id !== 'string' || !ID.test(row.id) || (index > 0 && row.id <= entries[index - 1].id)) return false;
    const { id, ...entry } = row;
    const kept = sessionAgentHistoryEntry(entry);
    return !!kept && JSON.stringify(kept) === JSON.stringify(entry);
  });

/** Every stored exchange, oldest first, each with its `id`. */
export const listSessionAgentHistory = async (storage) => {
  const entries = [];
  for (let startAfter = ''; ;) {
    const page = [...await storage.list({ prefix: PREFIX, limit: 1000, ...(startAfter ? { startAfter } : {}) })];
    page.forEach(([key, entry]) => entries.push({ id: key.slice(PREFIX.length), ...entry }));
    if (page.length < 1000) return entries;
    startAfter = page.at(-1)[0];
  }
};

// Removes the given keys, a batch per transaction, keeping the stored count true.
const removeKeys = async (storage, keys) => {
  let deleted = 0;
  for (let start = 0; start < keys.length; start += DELETE_BATCH) {
    const batch = keys.slice(start, start + DELETE_BATCH);
    deleted += await storage.transaction(async (transaction) => {
      const present = [];
      for (const key of batch) if ((await transaction.get(key)) != null) present.push(key);
      if (present.length) await transaction.delete(present);
      const meta = await transaction.get(META_KEY);
      await transaction.put(META_KEY, { ...meta, stored: Math.max(0, count(meta?.stored) - present.length) });
      return present.length;
    });
  }
  return deleted;
};

export const dispatchSessionAgentHistoryStore = async (coordinator, operation, payload = {}) => {
  const storage = coordinator.state.storage;

  if (operation === 'add') {
    const entry = sessionAgentHistoryEntry(payload.entry);
    if (!entry) return refuse(400, 'session_agent_history_invalid');
    // Ids count up, so they sort in the order chats were stored and say nothing
    // of the time of day.
    const added = await storage.transaction(async (transaction) => {
      const meta = await transaction.get(META_KEY);
      const next = count(meta?.next) + 1;
      const stored = count(meta?.stored) + 1;
      await transaction.put(PREFIX + idOf(next), entry);
      await transaction.put(META_KEY, { next, stored });
      return { id: idOf(next), stored };
    });
    // Past the most a session keeps, the oldest go.
    if (added.stored > L.stored) {
      await removeKeys(storage, [...(await storage.list({ prefix: PREFIX, limit: added.stored - L.stored })).keys()]);
    }
    return json({ ok: true, id: added.id });
  }

  // Every stored exchange, oldest first, for the export.
  if (operation === 'all') return json({ ok: true, entries: await listSessionAgentHistory(storage) });

  if (operation === 'list') {
    const limit = payload.limit == null ? L.page : Number(payload.limit);
    const cursor = payload.cursor == null || payload.cursor === '' ? '' : String(payload.cursor);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > L.page || (cursor && !ID.test(cursor))) {
      return refuse(400, 'session_agent_history_page_invalid');
    }
    // Newest first: the list runs backwards from the cursor.
    const page = [...await storage.list({ prefix: PREFIX, reverse: true, limit: limit + 1, ...(cursor ? { end: PREFIX + cursor } : {}) })];
    const entries = page.slice(0, limit).map(([key, entry]) => ({ id: key.slice(PREFIX.length), ...entry }));
    return json({
      ok: true,
      entries,
      ...(page.length > limit ? { cursor: entries.at(-1).id } : {}),
      stored: count((await storage.get(META_KEY))?.stored),
    });
  }

  if (operation === 'delete') {
    const { ids, through } = payload;
    let deleted = 0;
    if (ids == null && typeof through === 'string' && ID.test(through)) {
      // Everything stored at or before `through`, the newest chat the admin read:
      // one stored since then stays, unread.
      const end = `${PREFIX}${through}\u0000`;
      for (let round = 0; round < 2 * Math.ceil(L.stored / DELETE_BATCH); round += 1) {
        const keys = [...(await storage.list({ prefix: PREFIX, end, limit: DELETE_BATCH })).keys()];
        if (!keys.length) break;
        deleted += await removeKeys(storage, keys);
      }
    } else {
      if (through != null || !Array.isArray(ids) || ids.length < 1 || ids.length > L.page ||
        !ids.every((id) => typeof id === 'string' && ID.test(id))) {
        return refuse(400, 'session_agent_history_invalid');
      }
      deleted = await removeKeys(storage, [...new Set(ids)].map((id) => PREFIX + id));
    }
    return json({ ok: true, deleted, stored: count((await storage.get(META_KEY))?.stored) });
  }

  return refuse(404, 'not_found');
};
