import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';
import { readAuthorizationEpoch } from './authorizationScopeFreshness.js';
import {
  SESSION_CONFIG_MIGRATION_REQUIRED_REASON,
  legacySessionConfigMigrationError,
} from './sessionConfigSecretsStore.js';

export const SESSION_CONFIG_COORDINATION_ERROR = 'Session config coordination is unavailable; retry.';
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

export const callSessionConfigCoordinator = async ({ env, slug, path, ...payload }) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const binding = env?.CE_SESSION_COORDINATOR;
  try {
    if (!normalizedSlug || !binding?.idFromName || !binding?.get) throw new Error();
    const name = await sha256Hex(`session-config:${normalizedSlug}`);
    const response = await binding.get(binding.idFromName(name)).fetch(
      `https://session-coordinator.internal/session-config/${path}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: normalizedSlug, ...payload }) },
    );
    const body = await response.json();
    return { ok: response.ok && body?.ok === true, status: response.status, body };
  } catch {
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
