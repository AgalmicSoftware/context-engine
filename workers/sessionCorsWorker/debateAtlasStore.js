// A session's built debate atlases, newest first, in its coordinator. One
// build runs at a time; each finished build is kept in chunks, as the
// results-analysis draft is, so no single stored value grows past the limit.
const INDEX_KEY = 'debate-atlas-v1';
const CHUNK_PREFIX = 'debate-atlas-v1:build:';
const CHUNK_CHARS = 24_000;
const MAX_CHUNKS = 64;
export const MAX_DEBATE_ATLAS_BUILDS = 8;
// Longer than a build's deadline, so only a build whose request died waits it out.
export const DEBATE_ATLAS_LEASE_MS = 6 * 60 * 1000;
export const DEBATE_ATLAS_ID = /^atlas_[a-z0-9]{1,12}_[a-f0-9]{8}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const chunkKey = (id, index) => `${CHUNK_PREFIX}${id}:${index}`;

const readIndex = async (storage) => {
  const value = await storage.get(INDEX_KEY);
  return isObj(value) && Array.isArray(value.builds) ? value : { version: 1, active: null, builds: [] };
};
const isFresh = (active, nowMs) => isObj(active) && nowMs - Number(active.startedAtMs || 0) < DEBATE_ATLAS_LEASE_MS;
const randomHex = (coordinator, bytes) => [...(coordinator.crypto || globalThis.crypto).getRandomValues(new Uint8Array(bytes))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

const chunkBuild = (build) => {
  const serialized = JSON.stringify(build);
  const chunks = [];
  for (let index = 0; index < serialized.length; index += CHUNK_CHARS) chunks.push(serialized.slice(index, index + CHUNK_CHARS));
  return chunks;
};

const readBuild = async (storage, entry) => {
  const chunks = [];
  for (let index = 0; index < Number(entry.chunkCount || 0); index += 1) {
    const chunk = await storage.get(chunkKey(entry.id, index));
    if (typeof chunk !== 'string') return null;
    chunks.push(chunk);
  }
  try {
    const build = JSON.parse(chunks.join(''));
    return isObj(build) && build.id === entry.id ? build : null;
  } catch {
    return null;
  }
};

const listedBuild = ({ chunkCount, ...entry }) => entry;

export const dispatchDebateAtlasStore = async (coordinator, operation, payload = {}) => {
  const storage = coordinator.state.storage;
  const nowMs = Number(coordinator.now()) || Date.now();
  if (operation === 'reserve') {
    return storage.transaction(async (transaction) => {
      const index = await readIndex(transaction);
      if (isFresh(index.active, nowMs)) {
        return json({
          ok: false,
          reason: 'debate_atlas_build_running',
          error: 'An atlas is already being built for this session. Try again when it finishes.',
          active: { startedAtMs: index.active.startedAtMs },
        }, 409);
      }
      const attemptId = randomHex(coordinator, 16);
      index.active = { attemptId, builder: trim(payload.builder).toLowerCase(), startedAtMs: nowMs };
      await transaction.put(INDEX_KEY, index);
      return json({ ok: true, attemptId });
    });
  }
  if (operation === 'finalize') {
    const build = isObj(payload.build) ? payload.build : null;
    const invalid = !!build && !DEBATE_ATLAS_ID.test(trim(build.id));
    const chunks = build && !invalid ? chunkBuild(build) : [];
    const refusal = invalid
      ? json({ ok: false, error: 'Invalid atlas build.' }, 400)
      : chunks.length > MAX_CHUNKS
        ? json({ ok: false, error: 'This atlas is too large to keep.' }, 413)
        : null;
    return storage.transaction(async (transaction) => {
      const index = await readIndex(transaction);
      if (!trim(payload.attemptId) || index.active?.attemptId !== trim(payload.attemptId)) {
        return json({ ok: false, error: 'This atlas build is no longer current.' }, 409);
      }
      index.active = null;
      // A build that cannot be kept still ends its attempt, so the next press need not wait out the lease.
      if (refusal) {
        await transaction.put(INDEX_KEY, index);
        return refusal;
      }
      if (build) {
        for (let chunk = 0; chunk < chunks.length; chunk += 1) await transaction.put(chunkKey(build.id, chunk), chunks[chunk]);
        const { branches, ...summary } = build;
        index.builds = [{ ...summary, chunkCount: chunks.length }, ...index.builds.filter((entry) => entry.id !== build.id)];
        for (const dropped of index.builds.splice(MAX_DEBATE_ATLAS_BUILDS)) {
          for (let chunk = 0; chunk < Number(dropped.chunkCount || 0); chunk += 1) await transaction.delete(chunkKey(dropped.id, chunk));
        }
      }
      await transaction.put(INDEX_KEY, index);
      return json({ ok: true });
    });
  }
  if (operation === 'read') {
    const index = await readIndex(storage);
    const id = trim(payload.id);
    if (id && !DEBATE_ATLAS_ID.test(id)) return json({ ok: false, error: 'Invalid atlas id.' }, 400);
    const entry = id ? index.builds.find((candidate) => candidate.id === id) : index.builds[0];
    if (id && !entry) return json({ ok: false, error: 'That atlas is no longer kept.' }, 404);
    const build = entry ? await readBuild(storage, entry) : null;
    if (entry && !build) return json({ ok: false, error: 'This atlas could not be read; retry.' }, 503);
    return json({
      ok: true,
      active: isFresh(index.active, nowMs) ? { startedAtMs: index.active.startedAtMs } : null,
      builds: index.builds.map(listedBuild),
      build,
    });
  }
  return json({ error: 'Not found.' }, 404);
};
