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
// A finished read is never reused: a reader sees the config as of a call that
// was still unanswered when it arrived. A read that never settles (its
// request was cancelled) is replaced after a wait, not joined forever.
const configReadsInFlight = new WeakMap();
const SHARED_READ_JOIN_MS = 10_000;
const STALLED = Symbol('stalled');

const shareConfigRead = (binding, slug, read) => {
  let reads = configReadsInFlight.get(binding);
  if (!reads) configReadsInFlight.set(binding, reads = new Map());
  const joined = reads.get(slug);
  if (!joined) {
    const pending = read().finally(() => { if (reads.get(slug) === pending) reads.delete(slug); });
    reads.set(slug, pending);
    return pending.then((result) => structuredClone(result));
  }
  let timer;
  const stalled = new Promise((resolve) => { timer = setTimeout(resolve, SHARED_READ_JOIN_MS, STALLED); });
  return Promise.race([joined, stalled]).finally(() => clearTimeout(timer)).then((result) => {
    if (result !== STALLED) return structuredClone(result);
    if (reads.get(slug) === joined) reads.delete(slug);
    return shareConfigRead(binding, slug, read);
  });
};

export const callSessionConfigCoordinator = async ({ env, slug, path, ...payload }) => {
  const binding = env?.CE_SESSION_COORDINATOR;
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  if (path === 'current' && normalizedSlug && binding && !Object.keys(payload).length) {
    return shareConfigRead(binding, normalizedSlug, () => callCoordinator({ env, slug, path }));
  }
  return callCoordinator({ env, slug, path, ...payload });
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

export const readCurrentSessionConfig = async ({ env, slug }) => {
  const result = await callSessionConfigCoordinator({ env, slug, path: 'current' });
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
