// Feedback about the app, kept in the session's own coordinator under its own
// prefix. Nothing that reads a session's answers, files, results or backups
// lists this prefix, so feedback never reaches AI Views, the atlas, the risk
// matrix, the Session Agent, exports or backups.
const PREFIX = 'session-feedback-v1:';
const META_KEY = 'session-feedback-meta-v1';
const DELETE_BATCH = 128;
const ID = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z:[0-9a-f]{16}$/;

export const SESSION_FEEDBACK_LIMITS = Object.freeze({ perSessionPerDay: 200, stored: 2000, page: 100 });

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refuse = (status, reason) => json({ ok: false, reason }, status);

// Today's count resets with the UTC date.
const countsOf = (meta, nowMs) => {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return {
    day,
    stored: Math.max(0, Number(meta?.stored) || 0),
    today: meta?.day === day ? Math.max(0, Number(meta?.today) || 0) : 0,
  };
};
const publicCounts = ({ stored, today }) => ({ stored, today });

const randomHex = (bytes) => [...crypto.getRandomValues(new Uint8Array(bytes))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

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
      await transaction.put(META_KEY, { ...meta, stored: Math.max(0, (Number(meta?.stored) || 0) - present.length) });
      return present.length;
    });
  }
  return deleted;
};

export const dispatchSessionFeedbackStore = async (coordinator, operation, payload = {}) => {
  const storage = coordinator.state.storage;
  const nowMs = Number(coordinator.now?.()) || Date.now();

  if (operation === 'add') {
    const record = payload.record;
    if (!record || typeof record !== 'object') return refuse(400, 'feedback_invalid');
    // The caps and the write share one transaction, so simultaneous sends
    // never pass a cap together.
    return storage.transaction(async (transaction) => {
      const counts = countsOf(await transaction.get(META_KEY), nowMs);
      if (counts.stored >= SESSION_FEEDBACK_LIMITS.stored) return refuse(409, 'feedback_full');
      if (counts.today >= SESSION_FEEDBACK_LIMITS.perSessionPerDay) return refuse(429, 'feedback_session_limit');
      const createdAt = new Date(nowMs).toISOString();
      await transaction.put(`${PREFIX}${createdAt}:${randomHex(8)}`, { ...record, createdAt });
      await transaction.put(META_KEY, { day: counts.day, stored: counts.stored + 1, today: counts.today + 1 });
      return json({ ok: true });
    });
  }

  if (operation === 'list') {
    const limit = payload.limit == null ? SESSION_FEEDBACK_LIMITS.page : Number(payload.limit);
    const cursor = payload.cursor == null || payload.cursor === '' ? '' : String(payload.cursor);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > SESSION_FEEDBACK_LIMITS.page || (cursor && !ID.test(cursor))) {
      return refuse(400, 'feedback_page_invalid');
    }
    // Newest first: keys sort by time, so the list runs backwards from the cursor.
    const page = [...await storage.list({ prefix: PREFIX, reverse: true, limit: limit + 1, ...(cursor ? { end: PREFIX + cursor } : {}) })];
    const messages = page.slice(0, limit).map(([key, record]) => ({ id: key.slice(PREFIX.length), ...record }));
    return json({
      ok: true,
      messages,
      ...(page.length > limit ? { cursor: messages.at(-1).id } : {}),
      counts: publicCounts(countsOf(await storage.get(META_KEY), nowMs)),
    });
  }

  if (operation === 'delete') {
    let deleted;
    if (payload.all === true && payload.ids == null) {
      deleted = 0;
      // Stop only when none are left (another admin may delete a listed batch
      // first), and after enough rounds to clear a full store twice.
      for (let round = 0; round < 2 * Math.ceil(SESSION_FEEDBACK_LIMITS.stored / DELETE_BATCH); round += 1) {
        const keys = [...(await storage.list({ prefix: PREFIX, limit: DELETE_BATCH })).keys()];
        if (!keys.length) break;
        deleted += await removeKeys(storage, keys);
      }
    } else {
      const ids = payload.ids;
      if (payload.all != null || !Array.isArray(ids) || ids.length < 1 || ids.length > SESSION_FEEDBACK_LIMITS.page ||
        !ids.every((id) => typeof id === 'string' && ID.test(id))) {
        return refuse(400, 'feedback_invalid');
      }
      deleted = await removeKeys(storage, [...new Set(ids)].map((id) => PREFIX + id));
    }
    return json({ ok: true, deleted, counts: publicCounts(countsOf(await storage.get(META_KEY), nowMs)) });
  }

  return refuse(404, 'not_found');
};
