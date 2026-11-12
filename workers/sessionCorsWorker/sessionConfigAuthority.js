import { SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';
import { readAuthorizationEpoch } from './authorizationScopeFreshness.js';
import {
  SESSION_CONFIG_MIGRATION_REQUIRED_REASON,
  legacySessionConfigMigrationError,
} from './sessionConfigSecretsStore.js';

export const SESSION_CONFIG_COORDINATION_ERROR = SESSION_COORDINATOR_UNAVAILABLE;
export const SUPERSEDED_AUTHORITY_ERROR = 'Session authorization changed; retry with current authority.';

// Only Worker-verified actors reach this internal boundary. Preserve that proof
// and its authority epoch through slow work. Config writes also require the exact
// revision; fenced progress journals may survive content-only revisions.
export const assertExpectedSessionAuthority = (authority, expected, slug, { requireRevision = true } = {}) => {
  if (!slug || !expected || !/^0x[0-9a-f]{40}$/i.test(expected.actor || '') ||
    !Number.isSafeInteger(expected.revision) || expected.revision < 0 ||
    !Number.isSafeInteger(expected.authzEpoch) || expected.authzEpoch < 0 ||
    (authority != null && authority.slug !== slug) ||
    (requireRevision && expected.revision !== (authority?.revision ?? 0)) ||
    expected.authzEpoch !== readAuthorizationEpoch(authority?.config)) {
    throw Object.assign(new Error(SUPERSEDED_AUTHORITY_ERROR), { status: 409 });
  }
};

// Concurrent config reads in one isolate share the call already in flight, so a
// burst sends the session's coordinator one read instead of one per request.
// A read that never settles (its request was cancelled) is replaced after a
// wait, not joined forever.
//
// Ordinary requests (signed-out reads, and answers and reads by people the
// config does not name) may also reuse a successful read for up to one second
// from when it finished, so a sign-out everywhere or a session made private
// reaches every request within a second. Admin routes and config changes read
// fresh, and any change made through this isolate drops its copy at once.
export const SESSION_CONFIG_CACHE_MS = 1_000;
const SHARED_READ_JOIN_MS = 10_000;
const STALLED = Symbol('stalled');

// One kind of coordinator read, shared per isolate by binding and session.
// `copy` gives each caller its own result, or the shared one when it is frozen.
const createReadShare = (copy) => {
  const reads = new WeakMap();
  const stateFor = (binding, slug) => {
    let slugs = reads.get(binding);
    if (!slugs) reads.set(binding, slugs = new Map());
    let state = slugs.get(slug);
    if (!state) slugs.set(slug, state = { generation: 0, cached: null, inFlight: null });
    return state;
  };
  const share = (state, read) => {
    const joined = state.inFlight;
    if (!joined) {
      const generation = state.generation;
      const pending = read().then((result) => {
        // A read that overlapped a change made here may predate it; never keep it.
        if (result?.ok && state.generation === generation) {
          state.cached = { result, expiresAt: Date.now() + SESSION_CONFIG_CACHE_MS };
        }
        return result;
      }).finally(() => { if (state.inFlight === pending) state.inFlight = null; });
      state.inFlight = pending;
      return pending.then(copy);
    }
    let timer;
    const stalled = new Promise((resolve) => { timer = setTimeout(resolve, SHARED_READ_JOIN_MS, STALLED); });
    return Promise.race([joined, stalled]).finally(() => clearTimeout(timer)).then((result) => {
      if (result !== STALLED) return copy(result);
      // The stalled read may still finish; it must not replace a newer copy.
      if (state.inFlight === joined) { state.inFlight = null; state.generation += 1; }
      return share(state, read);
    });
  };
  return {
    read: ({ binding, slug, cache, read }) => {
      const state = stateFor(binding, slug);
      if (cache && state.cached && Date.now() < state.cached.expiresAt) return Promise.resolve(copy(state.cached.result));
      return share(state, read);
    },
    forget: (binding, slug) => {
      const state = reads.get(binding)?.get(slug);
      if (!state) return;
      state.generation += 1;
      state.cached = null;
      state.inFlight = null;
    },
  };
};

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
};

const configReads = createReadShare((result) => structuredClone(result));
// An AI Views draft can be megabytes, so its viewers share one frozen copy
// rather than each holding their own.
const resultsAnalysisStatusReads = createReadShare((result) => result);

const sessionKey = (env, slug) => {
  const binding = env?.CE_SESSION_COORDINATOR;
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  return binding && normalizedSlug ? { binding, slug: normalizedSlug } : null;
};

// AI Views viewers share one status read per isolate, and may reuse it for up
// to a second (`cache`); a new draft built through this isolate shows at once.
export const shareResultsAnalysisStatusRead = ({ env, slug, cache = false, read }) => {
  const key = sessionKey(env, slug);
  if (!key) return read();
  return resultsAnalysisStatusReads.read({ ...key, cache, read: () => read().then(deepFreeze) });
};

export const forgetResultsAnalysisStatus = (env, slug) => {
  const key = sessionKey(env, slug);
  if (key) resultsAnalysisStatusReads.forget(key.binding, key.slug);
};

// Drops this isolate's copies of a session's config and AI Views status after
// a change, so the next read, and any read already in flight, is not reused.
export const forgetSessionConfig = (env, slug) => {
  const key = sessionKey(env, slug);
  if (!key) return;
  configReads.forget(key.binding, key.slug);
  resultsAnalysisStatusReads.forget(key.binding, key.slug);
};

// Calls that leave the config as it was: reads, backup marks and exports, and
// the per-answer and per-view journals. Every other call drops this copy.
// (backup/status can finish a restore, so it drops it.)
const KEEPS_CONFIG = new Set(['current', 'backup/write-revision', 'backup/export', 'diagnostics', 'storage/publish']);
const KEEPS_CONFIG_PREFIXES = ['agent-submit/', 'debate-atlas/', 'risk-matrix/'];
const keepsConfig = (path) => KEEPS_CONFIG.has(path) || KEEPS_CONFIG_PREFIXES.some((prefix) => String(path).startsWith(prefix));

export const callSessionConfigCoordinator = async ({ env, slug, path, cache = false, ...payload }) => {
  const key = sessionKey(env, slug);
  if (path === 'current' && key && !Object.keys(payload).length) {
    return configReads.read({ ...key, cache, read: () => callCoordinator({ env, slug, path }) });
  }
  try {
    return await callCoordinator({ env, slug, path, ...payload });
  } finally {
    if (!keepsConfig(path)) forgetSessionConfig(env, slug);
  }
};

// Logs why the coordinator could not answer: Cloudflare's own error text and
// its retryable/overloaded flags, never the slug, addresses or payload. At
// most one line a second per isolate, with a count of the ones held back.
let lastFailureLogAt = 0;
let heldFailureLogs = 0;
export const logCoordinatorFailure = (where, error, extra = {}) => {
  const now = Date.now();
  if (now - lastFailureLogAt < 1000) {
    heldFailureLogs += 1;
    return;
  }
  lastFailureLogAt = now;
  console.warn('[session-coordinator] unavailable', JSON.stringify({
    where,
    error: `${error?.name || 'Error'}: ${String(error?.message || '').slice(0, 200)}`,
    ...(typeof error?.retryable === 'boolean' ? { retryable: error.retryable } : {}),
    ...(typeof error?.overloaded === 'boolean' ? { overloaded: error.overloaded } : {}),
    ...extra,
    heldBack: heldFailureLogs,
  }));
  heldFailureLogs = 0;
};

const callCoordinator = async ({ env, slug, path, ...payload }) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const binding = env?.CE_SESSION_COORDINATOR;
  let response = null;
  try {
    if (!normalizedSlug || !binding?.idFromName || !binding?.get) throw new Error('No session coordinator binding.');
    const name = await sha256Hex(`session-config:${normalizedSlug}`);
    response = await binding.get(binding.idFromName(name)).fetch(
      `https://session-coordinator.internal/session-config/${path}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: normalizedSlug, ...payload }) },
    );
    const body = await response.json();
    return { ok: response.ok && body?.ok === true, status: response.status, body };
  } catch (error) {
    logCoordinatorFailure(`session-config/${path}`, error, response ? { status: response.status } : {});
    return { ok: false, status: 503, body: { error: SESSION_CONFIG_COORDINATION_ERROR } };
  }
};

export const readCurrentSessionConfig = async ({ env, slug, cache = false }) => {
  const result = await callSessionConfigCoordinator({ env, slug, path: 'current', cache });
  if (!result.ok && result.status === 503 && result.body?.reason === SESSION_CONFIG_MIGRATION_REQUIRED_REASON) {
    throw legacySessionConfigMigrationError();
  }
  if (!result.ok || !Number.isSafeInteger(result.body.revision) || result.body.revision < 0 ||
    (result.body.config === null ? result.body.revision !== 0 :
      (!result.body.config || typeof result.body.config !== 'object' || Array.isArray(result.body.config) || result.body.revision === 0))) {
    throw Object.assign(new Error(SESSION_CONFIG_COORDINATION_ERROR), { status: 503 });
  }
  return { config: result.body.config, revision: result.body.revision };
};

export const executeCoordinatedStorageVisibilityMutation = (args) => (
  callSessionConfigCoordinator({ ...args, path: 'storage/set-hidden' })
);

export const executeCoordinatedStoragePublication = (args) => (
  callSessionConfigCoordinator({ ...args, path: 'storage/publish' })
);

export const executeCoordinatedContextSourceOperation = ({ operation, ...args }) => (
  callSessionConfigCoordinator({ ...args, path: `context-source/${operation}` })
);
