import { assertExpectedSessionAuthority } from './sessionConfigAuthority.js';
import {
  executeDeployHelperRequest,
  lookupCloudflareAccount,
  sha256Hex,
  stableCanonicalSerialize,
} from '../shared/deployHelperCore.mjs';
import { buildSafeSponsoredReceiptBody } from './sponsoredBootstrapGrantStore.js';
import { runQueuedAutomaticResultsAnalysisJob, valueLooksEncrypted } from './resultsAnalysisGeneration.js';
import { publishCloudflareOwnedStorageMetadata, scanLegacyStorageOwnerIds, setCloudflareStorageResourceHidden } from './storageRouteExecution.js';
import {
  applySessionConfigMutation,
  resolveCanonicalWorkerSessionIdHex,
} from './sessionConfigMutation.js';
import { normalizeWorkerConfigRecord } from './sessionConfigNormalization.js';
import {
  getSessionConfig, getLegacySessionConfigForAuthority, putSessionConfig,
  SESSION_CONFIG_MIGRATION_REQUIRED_REASON, legacySessionConfigMigrationError,
} from './sessionConfigSecretsStore.js';
import {
  executeLitAuthorizationSignerEnsure,
  executeLitAuthorizationFinalize,
  executeSessionSecretsAfterLitRepair,
  hasPendingLitAuthorizationSetup,
  repairPendingLitAuthorizationSetup,
} from './sessionLitAuthorizationCoordinator.js';
import {
  normalizeWorkerSessionSlug,
  resolveCoordinatorSessionSlugStorageKey,
} from './sessionSlugResolution.js';
import {
  findForbiddenCloudflareDeploymentTokenPath,
  findForbiddenWorkerConfigSecretPath,
} from '../shared/workerSessionConfig.mjs';
import {
  createWorkerGroupId,
  executeWorkerGroupMutation,
  isAddressShapedWorkerGroupId,
  normalizeWorkerGroupId,
  normalizeWorkerGroupPrincipal,
  resolveWorkerGroupBootstrap,
  resolveWorkerGroupCaps,
} from './workerGroups.js';

const SPONSORED_DEPLOY_RECORD_KEY = 'sponsored-deploy';
const STORAGE_LEGACY_SCAN_KEY_PREFIX = 'storage-legacy-scan:';
const STORAGE_LEGACY_OWNER_KEY_PREFIX = 'storage-legacy-owner:';
// About two KV reads per row, so one step stays far below per-invocation limits.
const LEGACY_SCAN_ROWS_PER_STEP = 200;
const LEGACY_SCAN_STEPS_PER_UPLOAD = 4;
const LEGACY_SCAN_PENDING_ERROR = 'Existing questions and surveys are still being indexed; retry shortly.';
const LEGACY_SCAN_FAILED_ERROR = 'Recording the owners of existing questions and surveys failed; retry.';
const DIRECT_DEPLOY_RECORD_KEY = 'direct-deploy';
const SPONSORED_FAUCET_RECORD_KEY = 'sponsored-faucet';
const SESSION_CONFIG_AUTHORITY_KEY = 'session-config-authority';
const AUTH_NONCE_ACTIVE_KEY = 'auth-nonce-active';
const AUTH_NONCE_USED_KEY = 'auth-nonce-used';
const AUTH_RATE_RECORD_KEY = 'auth-rate-record';
const HOSTED_FAUCET_QUOTA_KEY = 'hosted-faucet-quota-v1';
const WORKER_GROUP_CAPACITY_META_KEY = 'worker-group-capacity-meta-v3';
const WORKER_GROUP_CAPACITY_GROUP_PREFIX = 'worker-group-capacity-group-v3:';
const WORKER_GROUP_CAPACITY_MEMBER_PREFIX = 'worker-group-capacity-member-v3:';
const RESULTS_ANALYSIS_RECORD_KEY = 'results-analysis-v1';
const RESULTS_ANALYSIS_DRAFT_KEY = 'results-analysis-draft-v1';
const RESULTS_ANALYSIS_DRAFT_CHUNK_PREFIX = 'results-analysis-draft-v1:chunk:';
const RESULTS_ANALYSIS_AUTO_JOB_KEY = 'results-analysis-auto-job-v1';
const MAX_RESULTS_ANALYSIS_REQUESTS = 24;
const RESULTS_ANALYSIS_VALUE_CHUNK_CHARS = 24_000;
const RESULTS_ANALYSIS_MAX_DRAFT_CHUNKS = 64;
const RESULTS_ANALYSIS_AUTO_JOB_MAX_BYTES = 48_000;
const RESULTS_ANALYSIS_RUNNING_LEASE_MS = 14 * 60 * 1000;
const RESULTS_ANALYSIS_MAX_THRESHOLD_RECHECKS = 2;
const RUNNING_LEASE_MS = 65_000;
const MAX_AUTH_NONCE_LIFETIME_MS = 60 * 60 * 1000;
const AUTH_NONCE_MAC_KEY = 'auth-nonce-mac-key';
const MAX_AUTH_RATE_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
const WRAPPED_SESSION_KEY_FIELDS = [
  'alg',
  'createdAt',
  'iv',
  'keyId',
  'keyProvider',
  'version',
  'wrapAlg',
  'wrappedKey',
];

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const isObjectRecord = (value) => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const byteLength = (value) => new TextEncoder().encode(toTrimmedString(value)).length;

const normalizePositiveSafeInteger = (value) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
};

const normalizeBoundedFutureTimestamp = (value, nowMs, maxAheadMs) => {
  const numeric = normalizePositiveSafeInteger(value);
  if (!numeric || numeric <= nowMs || numeric > nowMs + maxAheadMs) return 0;
  return numeric;
};

// Nonces issued before signed nonces were stored per address: version 1 kept
// one, version 2 several, with the newest in the version-1 fields.
const readActiveAuthNonces = (record, nowMs) => {
  const entries = Array.isArray(record?.entries)
    ? record.entries
    : record?.nonce ? [{ nonce: record.nonce, expiresAtMs: record.expiresAtMs }] : [];
  return entries
    .map((entry) => ({ nonce: toTrimmedString(entry?.nonce), expiresAtMs: Number(entry?.expiresAtMs || 0) }))
    .filter((entry) => entry.nonce && entry.expiresAtMs > nowMs);
};

const putActiveAuthNonces = async (transaction, entries) => {
  if (!entries.length) {
    await transaction.delete(AUTH_NONCE_ACTIVE_KEY);
    return;
  }
  const newest = entries[entries.length - 1];
  await transaction.put(AUTH_NONCE_ACTIVE_KEY, {
    version: 2,
    nonce: newest.nonce,
    expiresAtMs: newest.expiresAtMs,
    entries,
  });
};

// Signed nonces: "n1", 32 random hex characters from the Worker, the expiry as
// 13 digits of epoch milliseconds, and a 128-bit HMAC of these for this
// session and wallet under a key kept in this object. Issuing one stores
// nothing, so others cannot use up a wallet's nonces; using one records it
// until it expires, so each works once. Letters and digits only (EIP-4361).
const SIGNED_AUTH_NONCE_RE = /^n1([0-9a-f]{32})(\d{13})([0-9a-f]{32})$/;

const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex) => Uint8Array.from(hex.match(/../g) || [], (pair) => parseInt(pair, 16));
const equalText = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

const signAuthNonce = async ({ cryptoImpl, keyHex, slug, address, random, expiry }) => {
  const key = await cryptoImpl.subtle.importKey('raw', hexToBytes(keyHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const message = new TextEncoder().encode(`ce-auth-nonce-v1\n${slug}\n${address}\n${random}\n${expiry}`);
  return bytesToHex(new Uint8Array(await cryptoImpl.subtle.sign('HMAC', key, message))).slice(0, 32);
};

const isBase64url = (value, length) => (
  typeof value === 'string' &&
  value.length === length &&
  /^[A-Za-z0-9_-]+$/.test(value)
);

const normalizeWrappedSessionKeyRecord = (value, slug) => {
  if (!isObjectRecord(value)) return null;
  const fields = Object.keys(value).sort();
  if (fields.join(',') !== [...WRAPPED_SESSION_KEY_FIELDS].sort().join(',')) return null;
  const createdAt = toTrimmedString(value.createdAt);
  const createdAtMs = Date.parse(createdAt);
  if (
    value.version !== 1 ||
    value.keyProvider !== 'worker_secret' ||
    value.alg !== 'AES-256-GCM' ||
    value.wrapAlg !== 'AES-GCM-KW-v1' ||
    toTrimmedString(value.keyId) !== `session:${slug}:${createdAt}` ||
    !Number.isFinite(createdAtMs) ||
    new Date(createdAtMs).toISOString() !== createdAt ||
    !isBase64url(value.iv, 16) ||
    !isBase64url(value.wrappedKey, 64)
  ) return null;
  return Object.fromEntries(WRAPPED_SESSION_KEY_FIELDS.map((field) => [field, value[field]]));
};

const normalizePublicSessionConfig = (value, slug) => {
  if (!isObjectRecord(value)) return null;
  const normalized = normalizeWorkerConfigRecord(value, { slug });
  if (!normalized) return null;
  if (
    findForbiddenCloudflareDeploymentTokenPath(normalized) ||
    findForbiddenWorkerConfigSecretPath(normalized)
  ) return null;
  return normalized;
};

const withAuthoritativeSessionKey = (config, sessionKey) => {
  if (!sessionKey) return config;
  return {
    ...config,
    storageEnvelope: {
      ...(isObjectRecord(config?.storageEnvelope) ? config.storageEnvelope : {}),
      version: 1,
      keyProvider: 'worker_secret',
      sessionKey,
    },
  };
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const normalizeDeployResult = (result = {}, sensitiveValues = []) => ({
  ok: result?.ok === true,
  status: Number(result?.status || 0) || (result?.ok === true ? 200 : 502),
  body: buildSafeSponsoredReceiptBody(
    result?.body && typeof result.body === 'object' ? result.body : {},
    sensitiveValues,
  ),
  fallbackEligible: result?.fallbackEligible === true,
});

const isTerminalDeployResult = (result = {}) => (
  result?.ok === true || result?.body?.deploymentRequestTerminal === true
);

const buildDirectDeployTerminalReplay = ({ result, requestDigestMatches } = {}) => {
  if (requestDigestMatches || result?.ok !== true) return result;
  return {
    ...result,
    body: {
      ...((result?.body && typeof result.body === 'object') ? result.body : {}),
      // Infrastructure identity is already terminal, but this response did not
      // apply the retry's mutable config or session-secret payload. Force the
      // signed post-deploy recovery path instead of replaying historical write
      // claims as if they described the current request.
      partial: true,
      configVerified: false,
      writesSessionConfig: false,
      writesSessionSecrets: false,
    },
  };
};

const createAttemptId = (cryptoImpl = globalThis.crypto) => {
  if (typeof cryptoImpl?.randomUUID === 'function') return cryptoImpl.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoImpl?.getRandomValues?.(bytes);
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');
};

const workerGroupCapacityGroupKey = (groupId) => (
  `${WORKER_GROUP_CAPACITY_GROUP_PREFIX}${encodeURIComponent(normalizeWorkerGroupId(groupId))}`
);

const workerGroupCapacityMemberKey = ({ groupId, generation, principalDigest }) => (
  `${WORKER_GROUP_CAPACITY_MEMBER_PREFIX}${encodeURIComponent(normalizeWorkerGroupId(groupId))}:` +
  `${generation}:${principalDigest}`
);

const WORKER_GROUP_MUTATIONS = new Set([
  'create',
  'update',
  'delete',
  'add-member',
  'remove-member',
  'join',
]);

// Phases a thrown KV mutation can leave behind, and the mutation each replays.
const PENDING_WORKER_GROUP_OPERATIONS = Object.freeze({ creating: 'create', updating: 'update', deleting: 'delete' });
const PENDING_WORKER_GROUP_MEMBER_OPERATIONS = Object.freeze({ reserved: 'add-member', removing: 'remove-member' });

const DEFINITELY_PREWRITE_WORKER_GROUP_CREATE_FAILURES = new Set([
  'invalid_join_mode',
  'join_mode_not_implemented',
  'invalid_member_visibility',
  'invalid_group_label',
  'invalid_group_description',
  'invalid_group_image_url',
  'invalid_group_tags',
  'invalid_group_document_urls',
  'invalid_group_member_limit',
  'invalid_group_join_end',
  'invalid_group_admin_address',
  'invalid_worker_group_id',
]);

// The fields the KV group mutations read. Anything else in a request is ignored
// there and must not inflate the durable intent past its storage limit.
const WORKER_GROUP_INPUT_FIELDS = Object.freeze([
  'groupId', 'label', 'description', 'imageUrl', 'tags', 'documentURLs',
  'memberLimit', 'joinEndsAt', 'joinMode', 'memberVisibility', 'adminAddress',
]);
const WORKER_GROUP_INTENT_MAX_BYTES = 32 * 1024;

const pickWorkerGroupInput = (input) => Object.fromEntries(WORKER_GROUP_INPUT_FIELDS
  .filter((key) => isObjectRecord(input) && Object.prototype.hasOwnProperty.call(input, key))
  .map((key) => [key, input[key]]));

const sameWorkerGroupInput = (left, right) => {
  const canonical = (value) => JSON.stringify(value, Object.keys(isObjectRecord(value) ? value : {}).sort());
  return canonical(left) === canonical(right);
};

const withoutPendingMutation = (state) => {
  const next = { ...state };
  delete next.pending;
  return next;
};

const normalizeWorkerGroupMutation = (payload) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
  const operation = toTrimmedString(payload?.operation).toLowerCase();
  const actor = normalizeWorkerGroupPrincipal(payload?.actorPrincipal);
  if (!slug || !sessionId || !WORKER_GROUP_MUTATIONS.has(operation) || !actor.ok) return null;
  if (operation === 'create') {
    if (!isObjectRecord(payload?.input)) return null;
    const requestedGroupId = toTrimmedString(payload.input.groupId);
    const groupId = requestedGroupId
      ? normalizeWorkerGroupId(requestedGroupId)
      : createWorkerGroupId();
    if (!groupId) return null;
    return {
      slug,
      sessionId,
      operation,
      input: {
        ...payload.input,
        groupId,
      },
      groupId,
      actorPrincipal: actor.principal,
    };
  }
  const rawGroupId = toTrimmedString(payload?.groupId);
  if (!rawGroupId) return null;
  const normalized = {
    slug,
    sessionId,
    operation,
    groupId: normalizeWorkerGroupId(rawGroupId),
    input: isObjectRecord(payload?.input) ? payload.input : {},
    actorPrincipal: actor.principal,
  };
  if (!normalized.groupId) return null;
  if (operation === 'add-member' || operation === 'remove-member' || operation === 'join') {
    const principal = normalizeWorkerGroupPrincipal(payload?.principal);
    if (!principal.ok) return null;
    normalized.principal = principal.principal;
    normalized.principalKey = principal.key;
  }
  return normalized;
};

const resolveInitializedWorkerGroupCapacity = (existing, slug, sessionId) => {
  if (!existing) return null;
  if (existing.version !== 3 || existing.slug !== slug || existing.sessionId !== sessionId) {
    return {
      ok: false,
      status: 409,
      reason: 'worker_group_capacity_identity_conflict',
    };
  }
  if (
    existing.phase === 'ready' &&
    Number.isSafeInteger(existing.groupCount) &&
    existing.groupCount >= 0
  ) {
    return { ok: true, meta: existing };
  }
  return {
    ok: false,
    status: 503,
    reason: 'worker_group_capacity_reconciliation_required',
  };
};

export class SessionWriteCoordinator {
  constructor(state, env, deps = {}) {
    this.state = state;
    this.env = env;
    this.executeDeployHelperRequest = deps.executeDeployHelperRequest || executeDeployHelperRequest;
    this.lookupCloudflareAccount = deps.lookupCloudflareAccount || lookupCloudflareAccount;
    this.now = deps.now || Date.now;
    this.crypto = deps.crypto || globalThis.crypto;
    this.applySessionConfigMutation = deps.applySessionConfigMutation || applySessionConfigMutation;
    this.putSessionConfig = deps.putSessionConfig || putSessionConfig;
    this.runResultsAnalysisAutoJob = deps.runResultsAnalysisAutoJob || runQueuedAutomaticResultsAnalysisJob;
    this.activeAttemptId = '';
    this.activeDirectAttemptId = '';
    this.sessionConfigTail = Promise.resolve();
    this.storageVisibilityTail = Promise.resolve();
    this.workerGroupTail = Promise.resolve();
    this.resultsAnalysisTail = Promise.resolve();
    this.storageOwnerTail = Promise.resolve();
    this.scanLegacyStorageOwnerIds = deps.scanLegacyStorageOwnerIds || scanLegacyStorageOwnerIds;
    this.legacyScanRowsPerStep = deps.legacyScanRowsPerStep || LEGACY_SCAN_ROWS_PER_STEP;
  }

  serializeSessionConfigOperation(operation) {
    const run = this.sessionConfigTail.then(operation);
    this.sessionConfigTail = run.catch(() => undefined);
    return run;
  }

  serializeWorkerGroupOperation(operation) {
    const run = this.workerGroupTail.then(operation);
    this.workerGroupTail = run.catch(() => undefined);
    return run;
  }

  serializeStorageOwnerOperation(operation) {
    const run = this.storageOwnerTail.then(operation);
    this.storageOwnerTail = run.catch(() => undefined);
    return run;
  }

  // Answers whether a question or survey id was stored before first-writer
  // records existed. The scan runs in bounded steps and keeps its progress and
  // the ids found, so it finishes however large the session is; racing
  // uploads wait their turn and read the same answers.
  async executeStorageLegacyOwner(payload) {
    const resource = toTrimmedString(payload?.resource);
    const resourceId = toTrimmedString(payload?.resourceId).toLowerCase();
    if (!['questions', 'surveys'].includes(resource) || !resourceId) {
      return jsonResponse({ ok: false, error: 'Invalid legacy owner request.' }, 400);
    }
    return this.serializeStorageOwnerOperation(async () => {
      const ownerKey = (id) => `${STORAGE_LEGACY_OWNER_KEY_PREFIX}${resource}:${id}`;
      if (await this.state.storage.get(ownerKey(resourceId))) return jsonResponse({ ok: true, adminOnly: true }, 200);
      const scanKey = `${STORAGE_LEGACY_SCAN_KEY_PREFIX}${resource}`;
      const scan = await this.state.storage.get(scanKey);
      if (scan?.done === true) return jsonResponse({ ok: true, adminOnly: false }, 200);
      let step;
      try {
        step = await this.scanLegacyStorageOwnerIds({
          env: this.env,
          config: payload?.config,
          slug: payload?.slug,
          resource,
          cursor: toTrimmedString(scan?.cursor),
          lastKey: toTrimmedString(scan?.lastKey),
          maxRows: this.legacyScanRowsPerStep,
        });
      } catch {
        return jsonResponse({ ok: false, error: LEGACY_SCAN_FAILED_ERROR }, 503);
      }
      await this.state.storage.transaction(async (transaction) => {
        for (const id of step.ids) await transaction.put(ownerKey(id), true);
        // Rows skipped because their payload is gone or unreadable by design.
        await transaction.put(scanKey, {
          version: 1,
          cursor: step.cursor,
          lastKey: step.lastKey,
          done: step.done === true,
          skippedRows: (Number(scan?.skippedRows) || 0) + (Number(step.skippedRows) || 0),
          updatedAtMs: Number(this.now()) || Date.now(),
        });
      });
      if (step.ids.includes(resourceId)) return jsonResponse({ ok: true, adminOnly: true }, 200);
      if (step.done === true) return jsonResponse({ ok: true, adminOnly: false }, 200);
      return jsonResponse({ ok: false, pending: true, error: LEGACY_SCAN_PENDING_ERROR }, 503);
    });
  }

  serializeResultsAnalysisOperation(operation) {
    const run = this.resultsAnalysisTail.then(operation);
    this.resultsAnalysisTail = run.catch(() => undefined);
    return run;
  }


  normalizeResultsAnalysisRecord(record) {
    const source = isObjectRecord(record) && record.version === 1 ? record : {};
    const requests = isObjectRecord(source.requests) ? source.requests : {};
    return {
      version: 1,
      active: isObjectRecord(source.active) ? source.active : null,
      lastGood: isObjectRecord(source.lastGood) ? source.lastGood : null,
      lastFailure: isObjectRecord(source.lastFailure) ? source.lastFailure : null,
      requests,
    };
  }

  pruneResultsAnalysisRequests(requests) {
    const entries = Object.entries(isObjectRecord(requests) ? requests : {})
      .filter(([key, value]) => toTrimmedString(key) && isObjectRecord(value))
      .sort((left, right) => Number(right[1]?.updatedAtMs || 0) - Number(left[1]?.updatedAtMs || 0))
      .slice(0, MAX_RESULTS_ANALYSIS_REQUESTS);
    return Object.fromEntries(entries);
  }

  isResultsAnalysisActiveFresh(active, nowMs) {
    return isObjectRecord(active) && nowMs - Number(active.startedAtMs || 0) < RESULTS_ANALYSIS_RUNNING_LEASE_MS;
  }

  async deleteResultsAnalysisDraftChunks(storage, meta) {
    const chunkCount = Number(meta?.chunkCount || 0) || 0;
    for (let index = 0; index < chunkCount; index += 1) {
      await storage.delete(`${RESULTS_ANALYSIS_DRAFT_CHUNK_PREFIX}${index}`);
    }
  }

  async readResultsAnalysisDraft(storage = this.state.storage) {
    const record = await storage.get(RESULTS_ANALYSIS_DRAFT_KEY);
    if (!isObjectRecord(record) || record.chunked !== true) return record;
    const chunkCount = Number(record.chunkCount || 0) || 0;
    if (!chunkCount || chunkCount > RESULTS_ANALYSIS_MAX_DRAFT_CHUNKS) return null;
    let serialized = '';
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = await storage.get(`${RESULTS_ANALYSIS_DRAFT_CHUNK_PREFIX}${index}`);
      if (typeof chunk !== 'string') return null;
      serialized += chunk;
    }
    try { return JSON.parse(serialized); } catch { return null; }
  }

  async putResultsAnalysisDraft(storage, draft) {
    const serialized = JSON.stringify(draft || {});
    if (serialized.length <= RESULTS_ANALYSIS_VALUE_CHUNK_CHARS && byteLength(serialized) < 120_000) {
      const existing = await storage.get(RESULTS_ANALYSIS_DRAFT_KEY);
      await this.deleteResultsAnalysisDraftChunks(storage, existing);
      await storage.put(RESULTS_ANALYSIS_DRAFT_KEY, draft);
      return;
    }
    const chunks = [];
    for (let index = 0; index < serialized.length; index += RESULTS_ANALYSIS_VALUE_CHUNK_CHARS) {
      chunks.push(serialized.slice(index, index + RESULTS_ANALYSIS_VALUE_CHUNK_CHARS));
    }
    if (chunks.length > RESULTS_ANALYSIS_MAX_DRAFT_CHUNKS) {
      const error = new Error('Results analysis draft exceeds durable storage limits.');
      error.status = 413;
      throw error;
    }
    if (chunks.some((chunk) => byteLength(chunk) >= 120_000)) {
      const error = new Error('Results analysis draft chunk exceeds durable storage limits.');
      error.status = 413;
      throw error;
    }
    const existing = await storage.get(RESULTS_ANALYSIS_DRAFT_KEY);
    await this.deleteResultsAnalysisDraftChunks(storage, existing);
    for (let index = 0; index < chunks.length; index += 1) {
      await storage.put(`${RESULTS_ANALYSIS_DRAFT_CHUNK_PREFIX}${index}`, chunks[index]);
    }
    await storage.put(RESULTS_ANALYSIS_DRAFT_KEY, {
      version: 1,
      chunked: true,
      draftId: toTrimmedString(draft?.draftId),
      chunkCount: chunks.length,
      updatedAtMs: Number(this.now()) || Date.now(),
    });
  }

  sanitizeResultsAnalysisAutoJob(payload = {}) {
    const slug = resolveCoordinatorSessionSlugStorageKey(payload.slug);
    const requestId = toTrimmedString(payload.requestId);
    const committedResponses = Array.isArray(payload.committedResponses)
      ? payload.committedResponses.slice(0, 1).map((entry) => {
          const metadata = isObjectRecord(entry?.metadata) ? entry.metadata : {};
          const payloadRecord = isObjectRecord(entry?.payload) ? entry.payload : {};
          // Checked before sanitizing, which may drop a deeply nested envelope.
          const payloadLooksLocked = valueLooksEncrypted(payloadRecord);
          const sanitizedPayload = this.sanitizeResultsAnalysisResponsePayload(payloadRecord);
          if (payloadLooksLocked) sanitizedPayload.locked = true;
          return {
            metadata: {
              id: toTrimmedString(metadata.id).slice(0, 160),
              responder: toTrimmedString(metadata.responder).toLowerCase().slice(0, 128),
              createdAt: toTrimmedString(metadata.createdAt).slice(0, 64),
              encrypted: metadata.encrypted === true,
              payloadEncrypted: metadata.payloadEncrypted === true,
              payloadAccessMode: toTrimmedString(metadata.payloadAccessMode).slice(0, 80),
              payloadAccessControl: isObjectRecord(metadata.payloadAccessControl)
                ? metadata.payloadAccessControl
                : toTrimmedString(metadata.payloadAccessControl).slice(0, 1000),
              groupIds: Array.isArray(metadata.groupIds)
                ? metadata.groupIds.map((entry) => toTrimmedString(entry).slice(0, 160)).filter(Boolean).slice(0, 24)
                : [],
            },
            payload: sanitizedPayload,
          };
        }).filter((entry) => entry.metadata.responder && isObjectRecord(entry.payload))
      : [];
    const job = {
      version: 1,
      slug,
      requestId,
      committedResponses,
      queuedAtMs: Number(this.now()) || Date.now(),
      thresholdRecheckAttempts: 0,
    };
    const serialized = JSON.stringify(job);
    if (!slug || byteLength(serialized) > RESULTS_ANALYSIS_AUTO_JOB_MAX_BYTES) return null;
    return job;
  }

  sanitizeResultsAnalysisResponsePayload(payload = {}) {
    const allowedKeys = new Set([
      'additional',
      'additionalComments',
      'answer',
      'comment',
      'comments',
      'conviction',
      'createdAt',
      'encrypted',
      'encryptedPortion',
      'id',
      'importance',
      'locked',
      'payloadEncrypted',
      'questionID',
      'questionId',
      'response',
      'sessionId',
      'sessionIdHex',
      'sessionSlug',
      'submittedAt',
      'timestamp',
      'value',
    ]);
    const sanitizeValue = (value, depth = 0) => {
      if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
      if (typeof value === 'string') return value.slice(0, 2000);
      if (Array.isArray(value)) return depth > 2 ? [] : value.slice(0, 24).map((entry) => sanitizeValue(entry, depth + 1));
      if (!isObjectRecord(value) || depth > 3) return null;
      return Object.fromEntries(Object.entries(value).slice(0, 32).map(([key, entry]) => [
        toTrimmedString(key).slice(0, 80),
        sanitizeValue(entry, depth + 1),
      ]));
    };
    return Object.fromEntries(Object.entries(payload)
      .filter(([key]) => allowedKeys.has(key))
      .map(([key, value]) => [key, sanitizeValue(value)]));
  }

  async scheduleResultsAnalysisAlarm(delayMs = 1_000) {
    if (typeof this.state.storage?.setAlarm !== 'function') return false;
    await this.state.storage.setAlarm((Number(this.now()) || Date.now()) + Math.max(0, Number(delayMs) || 0));
    return true;
  }

  async enqueueResultsAnalysisAutoJob(payload = {}) {
    const job = this.sanitizeResultsAnalysisAutoJob(payload);
    if (!job) return { ok: false, status: 400, error: 'Invalid results analysis auto job.' };
    const existing = await this.state.storage.get(RESULTS_ANALYSIS_AUTO_JOB_KEY);
    if (isObjectRecord(existing) && existing.slug === job.slug) {
      const byId = new Map();
      for (const entry of [...(Array.isArray(existing.committedResponses) ? existing.committedResponses : []), ...job.committedResponses]) {
        const key = toTrimmedString(entry?.metadata?.id) || `${toTrimmedString(entry?.metadata?.responder)}:${toTrimmedString(entry?.metadata?.createdAt)}`;
        if (key) byId.set(key, entry);
      }
      job.committedResponses = [...byId.values()].slice(-12);
      job.queuedAtMs = Number(existing.queuedAtMs || 0) || job.queuedAtMs;
    }
    if (byteLength(JSON.stringify(job)) > RESULTS_ANALYSIS_AUTO_JOB_MAX_BYTES) {
      job.committedResponses = job.committedResponses.slice(-4);
    }
    if (byteLength(JSON.stringify(job)) > RESULTS_ANALYSIS_AUTO_JOB_MAX_BYTES) {
      return { ok: false, status: 413, error: 'Results analysis auto job is too large.' };
    }
    await this.state.storage.put(RESULTS_ANALYSIS_AUTO_JOB_KEY, job);
    const scheduled = await this.scheduleResultsAnalysisAlarm(1_000);
    return { ok: true, status: 202, queued: true, scheduled };
  }

  async recordResultsAnalysisQueueFailure(error, job) {
    const nowMs = Number(this.now()) || Date.now();
    await this.state.storage.transaction(async (transaction) => {
      const queued = await transaction.get(RESULTS_ANALYSIS_AUTO_JOB_KEY);
      const record = this.normalizeResultsAnalysisRecord(await transaction.get(RESULTS_ANALYSIS_RECORD_KEY));
      record.lastFailure = {
        ok: false,
        error: error?.message || error?.error || toTrimmedString(error) || 'Automatic results analysis job failed.',
        status: Number(error?.status) >= 400 && Number(error?.status) <= 599 ? Number(error.status) : 502,
        requestId: toTrimmedString(job?.requestId ?? queued?.requestId),
        trigger: 'automatic',
        failedAtMs: nowMs,
      };
      if (!job || (queued?.queuedAtMs === job.queuedAtMs && queued?.requestId === job.requestId)) {
        await transaction.delete(RESULTS_ANALYSIS_AUTO_JOB_KEY);
      }
      await transaction.put(RESULTS_ANALYSIS_RECORD_KEY, record);
    });
  }

  async runQueuedResultsAnalysisAutoJob() {
    const job = await this.state.storage.get(RESULTS_ANALYSIS_AUTO_JOB_KEY);
    if (!isObjectRecord(job)) return { ok: true, skipped: true, reason: 'no_job' };
    const result = await this.runResultsAnalysisAutoJob({
      env: this.env,
      slug: job.slug,
      job,
      deps: {
        now: this.now,
        getSessionConfig: async () => (await this.readCurrentSessionConfig(job.slug)).config,
        readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: await this.readResultsAnalysisStatus() }),
        reserveCoordinatedResultsAnalysis: async ({ reservation } = {}) => this.reserveResultsAnalysis(reservation || {}),
        finalizeCoordinatedResultsAnalysis: async ({ finalization } = {}) => this.finalizeResultsAnalysis(finalization || {}),
      },
    });
    if (result?.jobState === 'running') {
      await this.scheduleResultsAnalysisAlarm(RESULTS_ANALYSIS_RUNNING_LEASE_MS + 1_000);
      return result;
    }
    // Capacity/read failures return before reserving a provider attempt. They
    // still need durable failure status so later uploads do not rescan forever.
    // Ineligible input is not a failure: later responses can make it eligible.
    if (result?.ok === false && result.status !== 422) {
      await this.recordResultsAnalysisQueueFailure(result, job);
      return result;
    }
    const current = await this.state.storage.get(RESULTS_ANALYSIS_AUTO_JOB_KEY);
    const sameQueuedJob = current?.queuedAtMs === job.queuedAtMs && current?.requestId === job.requestId;
    if (
      sameQueuedJob &&
      result?.reason === 'threshold_not_met' &&
      Array.isArray(current.committedResponses) &&
      current.committedResponses.length > 0
    ) {
      const attempts = Math.max(0, Number(current.thresholdRecheckAttempts || 0) || 0);
      if (attempts < RESULTS_ANALYSIS_MAX_THRESHOLD_RECHECKS) {
        current.thresholdRecheckAttempts = attempts + 1;
        await this.state.storage.put(RESULTS_ANALYSIS_AUTO_JOB_KEY, current);
        await this.scheduleResultsAnalysisAlarm(current.thresholdRecheckAttempts * 30_000);
        return {
          ...result,
          queued: true,
          recheckScheduled: true,
          thresholdRecheckAttempts: current.thresholdRecheckAttempts,
        };
      }
    }
    if (sameQueuedJob) {
      await this.state.storage.delete(RESULTS_ANALYSIS_AUTO_JOB_KEY);
    }
    return result;
  }

  async alarm() {
    try {
      await this.runQueuedResultsAnalysisAutoJob();
    } catch (error) {
      await this.recordResultsAnalysisQueueFailure(error);
    }
  }

  async readResultsAnalysisStatus() {
    const existing = await this.state.storage.get(RESULTS_ANALYSIS_RECORD_KEY);
    const record = this.normalizeResultsAnalysisRecord(existing);
    const latestDraft = await this.readResultsAnalysisDraft();
    const queued = await this.state.storage.get(RESULTS_ANALYSIS_AUTO_JOB_KEY);
    const lastGood = record.lastGood && latestDraft?.draftId === record.lastGood.draftId
      ? { ...record.lastGood, ...latestDraft }
      : record.lastGood;
    const nowMs = Number(this.now()) || Date.now();
    return {
      version: 1,
      jobState: this.isResultsAnalysisActiveFresh(record.active, nowMs) ? 'running' : (isObjectRecord(queued) ? 'queued' : (record.lastFailure ? 'failed' : (lastGood ? 'succeeded' : 'idle'))),
      queued: isObjectRecord(queued) ? { requestId: toTrimmedString(queued.requestId), queuedAtMs: Number(queued.queuedAtMs || 0) || 0 } : null,
      active: this.isResultsAnalysisActiveFresh(record.active, nowMs) ? record.active : null,
      lastGood,
      lastFailure: record.lastFailure,
    };
  }

  async reserveResultsAnalysis(payload = {}) {
    const requestId = toTrimmedString(payload.requestId);
    const sourceSignature = toTrimmedString(payload.sourceSignature);
    const sourceVersion = toTrimmedString(payload.sourceVersion) || '1';
    const viewSignature = toTrimmedString(payload.viewSignature);
    const reservationKey = toTrimmedString(payload.reservationKey);
    const trigger = toTrimmedString(payload.trigger) || 'manual';
    const refresh = payload.refresh === true;
    if (!sourceSignature || !viewSignature || !reservationKey) {
      return { kind: 'failed', status: 400, error: 'Invalid results analysis reservation.' };
    }
    const nowMs = Number(this.now()) || Date.now();
    return this.state.storage.transaction(async (transaction) => {
      const record = this.normalizeResultsAnalysisRecord(await transaction.get(RESULTS_ANALYSIS_RECORD_KEY));
      const latestDraft = await this.readResultsAnalysisDraft(transaction);
      const prior = requestId ? record.requests[requestId] : null;
      if (prior?.state === 'succeeded' && prior.draftId) {
        if (latestDraft?.draftId === prior.draftId) {
          return { kind: 'terminal', draft: latestDraft, draftId: prior.draftId };
        }
        return { kind: 'failed', status: 409, error: 'Results analysis request already completed for a previous draft.' };
      }
      if (prior?.state === 'failed') {
        return { kind: 'failed', status: prior.status || 502, error: prior.error || 'Results analysis generation failed.' };
      }
      if (prior?.state === 'running' && record.active?.requestId === requestId && this.isResultsAnalysisActiveFresh(record.active, nowMs)) {
        return { kind: 'pending' };
      }
      if (!refresh && record.lastGood?.sourceSignature === sourceSignature && record.lastGood?.viewSignature === viewSignature && latestDraft?.draftId === record.lastGood.draftId) {
        if (requestId) {
          record.requests[requestId] = { state: 'succeeded', draftId: latestDraft.draftId, updatedAtMs: nowMs };
          record.requests = this.pruneResultsAnalysisRequests(record.requests);
          await transaction.put(RESULTS_ANALYSIS_RECORD_KEY, record);
        }
        return { kind: 'terminal', draft: latestDraft, draftId: latestDraft.draftId };
      }
      if (
        trigger === 'automatic' &&
        record.lastFailure?.sourceSignature === sourceSignature &&
        record.lastFailure?.viewSignature === viewSignature
      ) {
        return { kind: 'failed', status: record.lastFailure.status || 502, error: record.lastFailure.error || 'Results analysis generation failed.' };
      }
      if (this.isResultsAnalysisActiveFresh(record.active, nowMs)) {
        if (requestId && !record.requests[requestId]) {
          record.requests[requestId] = { state: 'running', updatedAtMs: nowMs };
          record.requests = this.pruneResultsAnalysisRequests(record.requests);
          await transaction.put(RESULTS_ANALYSIS_RECORD_KEY, record);
        }
        return { kind: 'pending' };
      }
      const attemptId = createAttemptId(this.crypto);
      record.active = {
        reservationKey,
        requestId,
        attemptId,
        sourceSignature,
        sourceVersion,
        viewSignature,
        trigger,
        startedAtMs: nowMs,
      };
      if (requestId) record.requests[requestId] = { state: 'running', updatedAtMs: nowMs };
      record.requests = this.pruneResultsAnalysisRequests(record.requests);
      await transaction.put(RESULTS_ANALYSIS_RECORD_KEY, record);
      return { kind: 'execute', attemptId };
    });
  }

  async finalizeResultsAnalysis(payload = {}) {
    const requestId = toTrimmedString(payload.requestId);
    const reservationKey = toTrimmedString(payload.reservationKey);
    const attemptId = toTrimmedString(payload.attemptId);
    const receipt = isObjectRecord(payload.receipt) ? payload.receipt : null;
    const success = payload.success === true;
    if (!reservationKey || !attemptId || !receipt) return { ok: false, status: 400 };
    const nowMs = Number(this.now()) || Date.now();
    return this.state.storage.transaction(async (transaction) => {
      const record = this.normalizeResultsAnalysisRecord(await transaction.get(RESULTS_ANALYSIS_RECORD_KEY));
      if (
        record.active?.reservationKey !== reservationKey ||
        record.active?.attemptId !== attemptId
      ) {
        return { ok: false, status: 409 };
      }
      const active = record.active;
      record.active = null;
      if (success) {
        const draft = (receipt.draft && isObjectRecord(receipt.draft)) ? receipt.draft : receipt;
        const draftId = toTrimmedString(draft.draftId);
        if (!draftId) return { ok: false, status: 400 };
        try {
          await this.putResultsAnalysisDraft(transaction, draft);
        } catch (error) {
          record.lastFailure = {
            ok: false,
            error: error?.message || 'Results analysis draft exceeds durable storage limits.',
            status: Number(error?.status || 0) || 413,
            sourceSignature: active.sourceSignature,
            sourceVersion: active.sourceVersion,
            viewSignature: active.viewSignature,
            requestId,
            trigger: active.trigger,
            failedAtMs: nowMs,
          };
          if (requestId) record.requests[requestId] = {
            state: 'failed',
            error: record.lastFailure.error,
            status: record.lastFailure.status,
            updatedAtMs: nowMs,
          };
          record.requests = this.pruneResultsAnalysisRequests(record.requests);
          await transaction.put(RESULTS_ANALYSIS_RECORD_KEY, record);
          return { ok: false, status: record.lastFailure.status, error: record.lastFailure.error };
        }
        record.lastGood = {
          draftId,
          generatedAt: draft.generatedAt,
          requestId,
          trigger: active.trigger,
          source: isObjectRecord(draft.source) ? draft.source : null,
          sourceSignature: active.sourceSignature,
          sourceVersion: active.sourceVersion,
          viewSignature: active.viewSignature,
          sections: Array.isArray(draft.sections) ? draft.sections : [],
          completedAtMs: nowMs,
        };
        record.lastFailure = null;
        if (requestId) record.requests[requestId] = { state: 'succeeded', draftId, updatedAtMs: nowMs };
      } else {
        record.lastFailure = {
          ok: false,
          error: toTrimmedString(receipt.error) || 'Results analysis generation failed.',
          status: Number(receipt.status || 0) || 502,
          sourceSignature: active.sourceSignature,
          sourceVersion: active.sourceVersion,
          viewSignature: active.viewSignature,
          requestId,
          trigger: active.trigger,
          failedAtMs: nowMs,
        };
        if (requestId) record.requests[requestId] = {
          state: 'failed',
          error: record.lastFailure.error,
          status: record.lastFailure.status,
          updatedAtMs: nowMs,
        };
      }
      record.requests = this.pruneResultsAnalysisRequests(record.requests);
      await transaction.put(RESULTS_ANALYSIS_RECORD_KEY, record);
      return { ok: true, status: 200 };
    });
  }

  async executeResultsAnalysisStatus() {
    return jsonResponse({ ok: true, state: await this.readResultsAnalysisStatus() }, 200);
  }

  async executeResultsAnalysisReserve(payload) {
    const reservation = await this.reserveResultsAnalysis(payload || {});
    return jsonResponse(reservation, reservation.status || (reservation.kind === 'pending' ? 503 : 200));
  }

  async executeResultsAnalysisFinalize(payload) {
    const result = await this.finalizeResultsAnalysis(payload || {});
    return jsonResponse(result, result.status || 200);
  }

  async executeResultsAnalysisAutoEnqueue(payload) {
    const result = await this.enqueueResultsAnalysisAutoJob(payload || {});
    return jsonResponse(result, result.status || 202);
  }

  async initializeWorkerGroupCapacity(slug, sessionId) {
    const existing = await this.state.storage.get(WORKER_GROUP_CAPACITY_META_KEY);
    const initialized = resolveInitializedWorkerGroupCapacity(existing, slug, sessionId);
    if (initialized) return initialized;

    // Bootstrap proof may require an external KV read, which cannot run inside
    // a Durable Object storage transaction. Recheck the durable state after
    // that await so a slow readiness request cannot overwrite a concurrent
    // capacity reservation.
    const bootstrap = await resolveWorkerGroupBootstrap({ env: this.env, slug, sessionId });
    return this.state.storage.transaction(async (transaction) => {
      const concurrent = await transaction.get(WORKER_GROUP_CAPACITY_META_KEY);
      const concurrentlyInitialized = resolveInitializedWorkerGroupCapacity(concurrent, slug, sessionId);
      if (concurrentlyInitialized) return concurrentlyInitialized;

      if (!bootstrap.ok) {
        if (bootstrap.reason === 'worker_group_capacity_reconciliation_required') {
          await transaction.put(WORKER_GROUP_CAPACITY_META_KEY, {
            version: 3,
            slug,
            sessionId,
            phase: 'legacy_locked',
            bootstrapId: '',
            groupCount: resolveWorkerGroupCaps(this.env).maxGroupsPerSession,
          });
        }
        return bootstrap;
      }
      const meta = {
        version: 3,
        slug,
        sessionId,
        phase: 'ready',
        bootstrapId: bootstrap.bootstrapId,
        groupCount: 0,
      };
      await transaction.put(WORKER_GROUP_CAPACITY_META_KEY, meta);
      return { ok: true, meta };
    });
  }

  async reconcileEmptyWorkerGroupCapacity(slug, sessionId) {
    const existing = await this.state.storage.get(WORKER_GROUP_CAPACITY_META_KEY);
    const initialized = resolveInitializedWorkerGroupCapacity(existing, slug, sessionId);
    if (initialized?.ok) {
      return { ...initialized, repaired: false };
    }
    if (initialized?.reason === 'worker_group_capacity_identity_conflict') return initialized;
    if (
      existing?.version !== 3 ||
      existing.slug !== slug ||
      existing.sessionId !== sessionId ||
      existing.phase !== 'legacy_locked'
    ) {
      return {
        ok: false,
        status: 409,
        reason: 'worker_group_capacity_repair_not_applicable',
      };
    }

    // This proof scans both canonical and legacy KV rows, including deleted
    // groups. It only succeeds for a server-declared fresh deployment.
    const bootstrap = await resolveWorkerGroupBootstrap({
      env: this.env,
      slug,
      sessionId,
      requireExhaustiveEmptyScan: true,
    });
    if (!bootstrap.ok) return bootstrap;

    return this.state.storage.transaction(async (transaction) => {
      const concurrent = await transaction.get(WORKER_GROUP_CAPACITY_META_KEY);
      const concurrentlyInitialized = resolveInitializedWorkerGroupCapacity(concurrent, slug, sessionId);
      if (concurrentlyInitialized?.ok) {
        return { ...concurrentlyInitialized, repaired: false };
      }
      if (concurrentlyInitialized?.reason === 'worker_group_capacity_identity_conflict') {
        return concurrentlyInitialized;
      }
      if (
        concurrent?.version !== 3 ||
        concurrent.slug !== slug ||
        concurrent.sessionId !== sessionId ||
        concurrent.phase !== 'legacy_locked'
      ) {
        return {
          ok: false,
          status: 409,
          reason: 'worker_group_capacity_repair_not_applicable',
        };
      }
      const meta = {
        version: 3,
        slug,
        sessionId,
        phase: 'ready',
        bootstrapId: bootstrap.bootstrapId,
        groupCount: 0,
      };
      await transaction.put(WORKER_GROUP_CAPACITY_META_KEY, meta);
      return { ok: true, repaired: true, meta };
    });
  }

  async reserveWorkerGroupSlot({ slug, sessionId, groupId, maxGroupsPerSession, intent }) {
    return this.state.storage.transaction(async (transaction) => {
      const meta = await transaction.get(WORKER_GROUP_CAPACITY_META_KEY);
      if (
        meta?.version !== 3 ||
        meta.slug !== slug ||
        meta.sessionId !== sessionId ||
        meta.phase !== 'ready'
      ) {
        return { ok: false, status: 503, reason: 'worker_group_capacity_state_unavailable' };
      }
      const groupKey = workerGroupCapacityGroupKey(groupId);
      const prior = await transaction.get(groupKey);
      if (prior) {
        return {
          ok: false,
          status: 409,
          reason: prior.active === true ? 'worker_group_exists' : 'worker_group_id_retired',
        };
      }
      if (Number(meta.groupCount || 0) >= maxGroupsPerSession) {
        return { ok: false, status: 409, reason: 'worker_group_session_cap_exceeded' };
      }
      await transaction.put(WORKER_GROUP_CAPACITY_META_KEY, {
        ...meta,
        groupCount: Number(meta.groupCount || 0) + 1,
      });
      await transaction.put(groupKey, {
        version: 2,
        phase: 'creating',
        active: false,
        generation: 1,
        memberCount: 0,
        joinMode: 'admin_add',
        pending: intent,
      });
      return { ok: true, reserved: true, generation: 1 };
    });
  }

  async rollbackWorkerGroupSlot({ slug, sessionId, groupId }) {
    await this.state.storage.transaction(async (transaction) => {
      const meta = await transaction.get(WORKER_GROUP_CAPACITY_META_KEY);
      const key = workerGroupCapacityGroupKey(groupId);
      const groupState = await transaction.get(key);
      if (
        meta?.version !== 3 ||
        meta.slug !== slug ||
        meta.sessionId !== sessionId ||
        meta.phase !== 'ready' ||
        groupState?.phase !== 'creating'
      ) return;
      await transaction.put(WORKER_GROUP_CAPACITY_META_KEY, {
        ...meta,
        groupCount: Math.max(0, Number(meta.groupCount || 0) - 1),
      });
      await transaction.delete(key);
    });
  }

  async activateWorkerGroupCapacity(group) {
    await this.state.storage.transaction(async (transaction) => {
      const groupId = normalizeWorkerGroupId(group?.groupId);
      const key = workerGroupCapacityGroupKey(groupId);
      const prior = await transaction.get(key);
      if (prior?.phase !== 'creating') {
        throw new Error('Worker group creation reservation is unavailable.');
      }
      await transaction.put(key, {
        ...withoutPendingMutation(prior),
        version: 2,
        phase: 'active',
        active: true,
        joinMode: toTrimmedString(group?.joinMode).toLowerCase() || 'admin_add',
        memberVisibility: toTrimmedString(group?.memberVisibility).toLowerCase() || 'admin_only',
        memberLimit: normalizePositiveSafeInteger(group?.memberLimit),
        joinEndsAt: toTrimmedString(group?.joinEndsAt),
      });
    });
  }

  async getActiveWorkerGroupCapacity(groupId) {
    const state = await this.state.storage.get(workerGroupCapacityGroupKey(groupId));
    if (state?.version !== 2 || state.phase !== 'active' || state.active !== true) {
      return { ok: false, status: 404, reason: 'worker_group_not_found' };
    }
    return { ok: true, state };
  }

  async beginWorkerGroupUpdate(groupId, intent) {
    return this.state.storage.transaction(async (transaction) => {
      const key = workerGroupCapacityGroupKey(groupId);
      const state = await transaction.get(key);
      if (state?.phase !== 'active' || state.active !== true) {
        return { ok: false, status: 404, reason: 'worker_group_not_found' };
      }
      await transaction.put(key, {
        ...state,
        phase: 'updating',
        // Closed is the conservative join posture while the KV projection is
        // ambiguous or a restrictive update is propagating.
        joinMode: 'admin_add',
        pending: { ...intent, prior: state },
      });
      return { ok: true, prior: state };
    });
  }

  async finalizeWorkerGroupUpdate({ groupId, group }) {
    await this.state.storage.transaction(async (transaction) => {
      const key = workerGroupCapacityGroupKey(groupId);
      const state = await transaction.get(key);
      if (state?.phase !== 'updating') return;
      await transaction.put(key, {
        ...withoutPendingMutation(state),
        phase: 'active',
        active: true,
        joinMode: toTrimmedString(group?.joinMode).toLowerCase() || 'admin_add',
        memberVisibility: toTrimmedString(group?.memberVisibility).toLowerCase() || 'admin_only',
        memberLimit: normalizePositiveSafeInteger(group?.memberLimit),
        joinEndsAt: toTrimmedString(group?.joinEndsAt),
      });
    });
  }

  async rollbackWorkerGroupUpdate({ groupId, prior }) {
    await this.state.storage.transaction(async (transaction) => {
      const key = workerGroupCapacityGroupKey(groupId);
      const state = await transaction.get(key);
      if (state?.phase === 'updating') await transaction.put(key, prior);
    });
  }

  async beginWorkerGroupDelete(groupId, intent) {
    return this.state.storage.transaction(async (transaction) => {
      const key = workerGroupCapacityGroupKey(groupId);
      const state = await transaction.get(key);
      if (state?.phase !== 'active' || state.active !== true) {
        return { ok: false, status: 404, reason: 'worker_group_not_found' };
      }
      await transaction.put(key, {
        ...state,
        phase: 'deleting',
        active: false,
        joinMode: 'admin_add',
        pending: { ...intent, prior: state },
      });
      return { ok: true, prior: state };
    });
  }

  async rollbackWorkerGroupDelete({ groupId, prior }) {
    await this.state.storage.transaction(async (transaction) => {
      const key = workerGroupCapacityGroupKey(groupId);
      const state = await transaction.get(key);
      if (state?.phase === 'deleting') await transaction.put(key, prior);
    });
  }

  async reserveWorkerGroupMemberSlot({
    groupId,
    principalDigest,
    maxMembersPerGroup,
    intent,
  }) {
    return this.state.storage.transaction(async (transaction) => {
      const groupKey = workerGroupCapacityGroupKey(groupId);
      const groupState = await transaction.get(groupKey);
      if (groupState?.phase !== 'active' || groupState.active !== true) {
        return { ok: false, status: 404, reason: 'worker_group_not_found' };
      }
      const generation = Math.max(1, Number(groupState.generation || 0));
      const memberKey = workerGroupCapacityMemberKey({
        groupId,
        generation,
        principalDigest,
      });
      const memberState = await transaction.get(memberKey);
      if (memberState?.state === 'active') {
        return { ok: true, reserved: false, generation, memberKey };
      }
      if (memberState?.state === 'reserved' || memberState?.state === 'removing') {
        return {
          ok: false,
          status: 503,
          reason: 'worker_group_membership_state_pending',
        };
      }
      const configuredMemberLimit = normalizePositiveSafeInteger(groupState.memberLimit);
      const effectiveMemberLimit = configuredMemberLimit
        ? Math.min(configuredMemberLimit, maxMembersPerGroup)
        : maxMembersPerGroup;
      if (Number(groupState.memberCount || 0) >= effectiveMemberLimit) {
        return { ok: false, status: 409, reason: 'worker_group_member_cap_exceeded' };
      }
      await transaction.put(groupKey, {
        ...groupState,
        memberCount: Number(groupState.memberCount || 0) + 1,
      });
      await transaction.put(memberKey, {
        version: 2,
        state: 'reserved',
        pending: intent,
      });
      return { ok: true, reserved: true, generation, memberKey };
    });
  }

  async finalizeWorkerGroupMemberSlot(memberKey) {
    await this.state.storage.transaction(async (transaction) => {
      const memberState = await transaction.get(memberKey);
      if (memberState?.state !== 'reserved') return;
      await transaction.put(memberKey, {
        version: 2,
        state: 'active',
      });
    });
  }

  async rollbackWorkerGroupMemberSlot({ groupId, memberKey }) {
    await this.state.storage.transaction(async (transaction) => {
      const groupKey = workerGroupCapacityGroupKey(groupId);
      const groupState = await transaction.get(groupKey);
      const memberState = await transaction.get(memberKey);
      if (groupState?.active && memberState?.state === 'reserved') {
        await transaction.put(groupKey, {
          ...groupState,
          memberCount: Math.max(0, Number(groupState.memberCount || 0) - 1),
        });
        await transaction.put(memberKey, {
          version: 2,
          state: 'removed',
        });
      }
    });
  }

  async beginWorkerGroupMemberRemoval({ groupId, principalDigest, intent }) {
    return this.state.storage.transaction(async (transaction) => {
      const groupKey = workerGroupCapacityGroupKey(groupId);
      const groupState = await transaction.get(groupKey);
      if (groupState?.phase !== 'active' || groupState.active !== true) {
        return { ok: false, status: 404, reason: 'worker_group_not_found' };
      }
      const generation = Math.max(1, Number(groupState.generation || 0));
      const memberKey = workerGroupCapacityMemberKey({
        groupId,
        generation,
        principalDigest,
      });
      const memberState = await transaction.get(memberKey);
      if (memberState?.state !== 'active') {
        return {
          ok: false,
          status: memberState?.state === 'reserved' || memberState?.state === 'removing'
            ? 503
            : 404,
          reason: memberState?.state === 'reserved' || memberState?.state === 'removing'
            ? 'worker_group_membership_state_pending'
            : 'worker_group_member_not_found',
        };
      }
      await transaction.put(memberKey, {
        version: 2,
        state: 'removing',
        pending: intent,
      });
      return { ok: true, memberKey };
    });
  }

  async rollbackWorkerGroupMemberRemoval({ memberKey }) {
    await this.state.storage.transaction(async (transaction) => {
      const memberState = await transaction.get(memberKey);
      if (memberState?.state !== 'removing') return;
      await transaction.put(memberKey, {
        version: 2,
        state: 'active',
      });
    });
  }

  async releaseWorkerGroupMemberSlot({ groupId, memberKey }) {
    await this.state.storage.transaction(async (transaction) => {
      const groupKey = workerGroupCapacityGroupKey(groupId);
      const groupState = await transaction.get(groupKey);
      const memberState = await transaction.get(memberKey);
      if (!groupState || memberState?.state !== 'removing') return;
      await transaction.put(groupKey, {
        ...groupState,
        memberCount: Math.max(0, Number(groupState.memberCount || 0) - 1),
      });
      await transaction.put(memberKey, {
        version: 2,
        state: 'removed',
      });
    });
  }

  async releaseWorkerGroupCapacity({ slug, sessionId, groupId }) {
    await this.state.storage.transaction(async (transaction) => {
      const meta = await transaction.get(WORKER_GROUP_CAPACITY_META_KEY);
      const key = workerGroupCapacityGroupKey(groupId);
      const groupState = await transaction.get(key);
      if (
        meta?.version !== 3 ||
        meta.slug !== slug ||
        meta.sessionId !== sessionId ||
        meta.phase !== 'ready' ||
        groupState?.phase !== 'deleting'
      ) return;
      await transaction.put(WORKER_GROUP_CAPACITY_META_KEY, {
        ...meta,
        groupCount: Math.max(0, Number(meta.groupCount || 0) - 1),
      });
      await transaction.put(key, {
        ...withoutPendingMutation(groupState),
        phase: 'deleted',
        active: false,
        memberCount: 0,
      });
    });
  }

  // Settles the reservation a KV mutation returned on: finalize on success,
  // release on a definite failure. A thrown mutation leaves it pending.
  async completeWorkerGroupReservation(mutation, result, reservation, { replay = false } = {}) {
    const { slug, sessionId, groupId, operation } = mutation;
    if (!result.ok) {
      if (operation === 'create') {
        // A live create keeps its slot unless the failure preceded any write;
        // a replay already counts an earlier attempt's write as done.
        if (replay || DEFINITELY_PREWRITE_WORKER_GROUP_CREATE_FAILURES.has(result.reason)) {
          await this.rollbackWorkerGroupSlot({ slug, sessionId, groupId });
        }
      } else if (operation === 'update') {
        await this.rollbackWorkerGroupUpdate({ groupId, prior: reservation.prior });
      } else if (operation === 'delete') {
        await this.rollbackWorkerGroupDelete({ groupId, prior: reservation.prior });
      } else if (operation === 'remove-member') {
        await this.rollbackWorkerGroupMemberRemoval({ memberKey: reservation.memberKey });
      } else if (reservation?.reserved) {
        await this.rollbackWorkerGroupMemberSlot({ groupId, memberKey: reservation.memberKey });
      }
      return;
    }
    if (operation === 'create') {
      await this.activateWorkerGroupCapacity(result.group);
    } else if (operation === 'update') {
      await this.finalizeWorkerGroupUpdate({ groupId, group: result.group });
    } else if (operation === 'delete') {
      await this.releaseWorkerGroupCapacity({ slug, sessionId, groupId });
    } else if (operation === 'remove-member') {
      await this.releaseWorkerGroupMemberSlot({ groupId, memberKey: reservation.memberKey });
    } else if (reservation?.reserved) {
      await this.finalizeWorkerGroupMemberSlot(reservation.memberKey);
    }
  }

  async replayWorkerGroupMutation({ slug, sessionId, groupId, operation, intent }, reservation) {
    const mutation = {
      slug,
      sessionId,
      groupId,
      operation,
      input: operation === 'create'
        ? { ...(isObjectRecord(intent.input) ? intent.input : {}), groupId }
        : (isObjectRecord(intent.input) ? intent.input : {}),
      principal: intent.principal,
      actorPrincipal: intent.actorPrincipal ?? null,
    };
    let result;
    try {
      result = await executeWorkerGroupMutation({ env: this.env, ...mutation, capacityAuthorized: true, resume: true });
    } catch {
      return { ok: false, status: 503, reason: 'worker_group_mutation_ambiguous' };
    }
    await this.completeWorkerGroupReservation(mutation, result, reservation, { replay: true });
    return { ok: true, replayed: { operation, input: mutation.input, result } };
  }

  // A thrown KV mutation may or may not have been applied, so its reservation
  // stays pending with its intent. Before anything else reads or changes that
  // group or member, replay the intent: re-applying is convergent, and an effect
  // an earlier attempt already made counts as done. Reservations recorded before
  // intents existed replay with an empty input.
  async settleWorkerGroupReservations({ slug, sessionId, groupIds, principal = null }) {
    const principalDigest = principal ? await sha256Hex(`worker-group-member:${principal.key}`) : '';
    const replayed = [];
    for (const groupId of groupIds) {
      const groupKey = workerGroupCapacityGroupKey(groupId);
      let state = await this.state.storage.get(groupKey);
      const operation = PENDING_WORKER_GROUP_OPERATIONS[state?.phase];
      if (operation) {
        const intent = isObjectRecord(state.pending) ? state.pending : {};
        // An unrecorded prior state restores the group with joins still closed.
        const prior = intent.prior || { ...withoutPendingMutation(state), phase: 'active', active: true };
        const settled = await this.replayWorkerGroupMutation(
          { slug, sessionId, groupId, operation, intent },
          operation === 'create' ? { reserved: true } : { ok: true, prior },
        );
        if (!settled.ok) return settled;
        replayed.push(settled.replayed);
        state = await this.state.storage.get(groupKey);
      }
      if (!principalDigest || state?.phase !== 'active') continue;
      const memberKey = workerGroupCapacityMemberKey({
        groupId,
        generation: Math.max(1, Number(state.generation || 0)),
        principalDigest,
      });
      const member = await this.state.storage.get(memberKey);
      const memberOperation = PENDING_WORKER_GROUP_MEMBER_OPERATIONS[member?.state];
      if (!memberOperation) continue;
      const settled = await this.replayWorkerGroupMutation(
        {
          slug,
          sessionId,
          groupId,
          operation: memberOperation,
          intent: isObjectRecord(member.pending) ? member.pending : { principal: principal.principal },
        },
        memberOperation === 'add-member' ? { reserved: true, memberKey } : { ok: true, memberKey },
      );
      if (!settled.ok) return settled;
      replayed.push({ ...settled.replayed, principalKey: principal.key });
    }
    return { ok: true, replayed };
  }

  async executeWorkerGroupReady(payload) {
    const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
    const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
    if (!slug || !sessionId) {
      return jsonResponse({
        ok: false,
        status: 400,
        reason: 'worker_group_session_identity_invalid',
      }, 400);
    }
    const initialized = await this.initializeWorkerGroupCapacity(slug, sessionId);
    return jsonResponse(initialized, initialized.ok ? 200 : (initialized.status || 503));
  }

  executeWorkerGroupReconcileEmpty(payload) {
    return this.serializeWorkerGroupOperation(async () => {
      const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
      const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
      if (!slug || !sessionId) {
        return jsonResponse({
          ok: false,
          status: 400,
          reason: 'worker_group_session_identity_invalid',
        }, 400);
      }
      const reconciled = await this.reconcileEmptyWorkerGroupCapacity(slug, sessionId);
      return jsonResponse(reconciled, reconciled.ok ? 200 : (reconciled.status || 503));
    });
  }

  executeWorkerGroupAuthorization(payload) {
    return this.serializeWorkerGroupOperation(async () => {
      const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
      const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
      const groupId = normalizeWorkerGroupId(payload?.groupId);
      const principal = normalizeWorkerGroupPrincipal(payload?.principal);
      if (!slug || !sessionId || !groupId || !principal.ok) {
        return jsonResponse({
          ok: false,
          status: 400,
          reason: 'worker_group_authorization_invalid',
        }, 400);
      }
      const initialized = await this.initializeWorkerGroupCapacity(slug, sessionId);
      if (!initialized.ok) {
        return jsonResponse(initialized, initialized.status || 503);
      }
      const settled = await this.settleWorkerGroupReservations({ slug, sessionId, groupIds: [groupId], principal });
      if (!settled.ok) return jsonResponse(settled, settled.status || 503);
      const group = await this.getActiveWorkerGroupCapacity(groupId);
      if (!group.ok) return jsonResponse(group, group.status || 404);
      const principalDigest = await sha256Hex(`worker-group-member:${principal.key}`);
      const memberKey = workerGroupCapacityMemberKey({
        groupId,
        generation: Math.max(1, Number(group.state.generation || 0)),
        principalDigest,
      });
      const member = await this.state.storage.get(memberKey);
      if (member?.state !== 'active') {
        return jsonResponse({
          ok: false,
          status: 403,
          reason: 'worker_group_membership_denied',
          principal: principal.principal,
        }, 403);
      }
      return jsonResponse({
        ok: true,
        status: 200,
        store: 'durable_object',
        principal: principal.principal,
        groupId,
        group: {
          groupId,
          joinMode: group.state.joinMode,
          memberVisibility: group.state.memberVisibility,
          memberCount: Number(group.state.memberCount || 0),
        },
      }, 200);
    });
  }

  executeWorkerGroupCatalog(payload) {
    return this.serializeWorkerGroupOperation(async () => {
      const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
      const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
      const requestedGroupIds = Array.isArray(payload?.groupIds)
        ? payload.groupIds.map((groupId) => normalizeWorkerGroupId(groupId))
        : [];
      const maxGroups = resolveWorkerGroupCaps(this.env).maxGroupsPerSession;
      const uniqueGroupIds = [...new Set(requestedGroupIds)];
      const principal = payload?.principal == null
        ? null
        : normalizeWorkerGroupPrincipal(payload.principal);
      if (
        !slug ||
        !sessionId ||
        !requestedGroupIds.length ||
        requestedGroupIds.some((groupId) => !groupId) ||
        uniqueGroupIds.length !== requestedGroupIds.length ||
        uniqueGroupIds.length > maxGroups ||
        (principal && !principal.ok)
      ) {
        return jsonResponse({
          ok: false,
          status: 400,
          reason: 'worker_group_catalog_invalid',
        }, 400);
      }
      const initialized = await this.initializeWorkerGroupCapacity(slug, sessionId);
      if (!initialized.ok) {
        return jsonResponse(initialized, initialized.status || 503);
      }
      const settled = await this.settleWorkerGroupReservations({ slug, sessionId, groupIds: uniqueGroupIds, principal });
      if (!settled.ok) return jsonResponse(settled, settled.status || 503);
      const principalDigest = principal
        ? await sha256Hex(`worker-group-member:${principal.key}`)
        : '';
      const groups = [];
      for (const groupId of uniqueGroupIds) {
        const group = await this.getActiveWorkerGroupCapacity(groupId);
        if (!group.ok) continue;
        let isMember = false;
        if (principalDigest) {
          const memberKey = workerGroupCapacityMemberKey({
            groupId,
            generation: Math.max(1, Number(group.state.generation || 0)),
            principalDigest,
          });
          const member = await this.state.storage.get(memberKey);
          isMember = member?.state === 'active';
        }
        groups.push({
          groupId,
          joinMode: group.state.joinMode,
          memberVisibility: group.state.memberVisibility,
          memberCount: Number(group.state.memberCount || 0),
          isMember,
        });
      }
      return jsonResponse({
        ok: true,
        status: 200,
        store: 'durable_object',
        groups,
      }, 200);
    });
  }

  executeWorkerGroupMemberships(payload) {
    return this.serializeWorkerGroupOperation(async () => {
      const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
      const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
      const principal = normalizeWorkerGroupPrincipal(payload?.principal);
      if (!slug || !sessionId || !principal.ok) {
        return jsonResponse({ ok: false, status: 400, reason: 'worker_group_memberships_invalid' }, 400);
      }
      const initialized = await this.initializeWorkerGroupCapacity(slug, sessionId);
      if (!initialized.ok) return jsonResponse(initialized, initialized.status || 503);
      const listGroupStates = () => this.state.storage.list({ prefix: WORKER_GROUP_CAPACITY_GROUP_PREFIX });
      const pending = await listGroupStates();
      if (pending instanceof Map) {
        const groupIds = [...pending.keys()].map((key) => {
          try {
            return normalizeWorkerGroupId(decodeURIComponent(String(key).slice(WORKER_GROUP_CAPACITY_GROUP_PREFIX.length)));
          } catch {
            return '';
          }
        }).filter(Boolean);
        const settled = await this.settleWorkerGroupReservations({ slug, sessionId, groupIds, principal });
        if (!settled.ok) return jsonResponse(settled, settled.status || 503);
      }
      // Re-read settled state; capacity totals below must agree with it.
      const entries = await listGroupStates();
      if (!(entries instanceof Map)) {
        return jsonResponse({ ok: false, status: 503, reason: 'worker_group_capacity_state_unavailable' }, 503);
      }
      const activeGroups = [];
      for (const [key, state] of entries) {
        const encodedGroupId = String(key).slice(WORKER_GROUP_CAPACITY_GROUP_PREFIX.length);
        let groupId = '';
        try {
          groupId = normalizeWorkerGroupId(decodeURIComponent(encodedGroupId));
        } catch {
          groupId = '';
        }
        if (!groupId || workerGroupCapacityGroupKey(groupId) !== key) {
          return jsonResponse({ ok: false, status: 503, reason: 'worker_group_capacity_state_unavailable' }, 503);
        }
        if (state?.version === 2 && state.phase === 'active' && state.active === true) {
          activeGroups.push({ groupId, state });
        }
      }
      const meta = await this.state.storage.get(WORKER_GROUP_CAPACITY_META_KEY);
      if (activeGroups.length !== Number(meta?.groupCount)) {
        return jsonResponse({ ok: false, status: 503, reason: 'worker_group_capacity_state_unavailable' }, 503);
      }
      const principalDigest = await sha256Hex(`worker-group-member:${principal.key}`);
      const groups = [];
      for (const { groupId, state } of activeGroups.sort((left, right) => left.groupId.localeCompare(right.groupId))) {
        const memberKey = workerGroupCapacityMemberKey({
          groupId,
          generation: Math.max(1, Number(state.generation || 0)),
          principalDigest,
        });
        const member = await this.state.storage.get(memberKey);
        if (member?.state !== 'active') continue;
        const memberCount = Number(state.memberCount);
        if (!Number.isSafeInteger(memberCount) || memberCount < 0) {
          return jsonResponse({ ok: false, status: 503, reason: 'worker_group_capacity_state_unavailable' }, 503);
        }
        groups.push({
          groupId,
          joinMode: state.joinMode,
          memberVisibility: state.memberVisibility,
          memberCount,
        });
      }
      return jsonResponse(
        { ok: true, status: 200, store: 'durable_object', principal: principal.principal, groups },
        200,
      );
    });
  }

  async executeWorkerGroupMutation(payload) {
    return this.serializeWorkerGroupOperation(async () => {
      if (
        toTrimmedString(payload?.operation).toLowerCase() === 'create' &&
        isAddressShapedWorkerGroupId(payload?.input?.groupId)
      ) {
        return jsonResponse({ ok: false, status: 400, reason: 'invalid_worker_group_id' }, 400);
      }
      const mutation = normalizeWorkerGroupMutation(payload);
      if (!mutation) {
        return jsonResponse({
          ok: false,
          status: 400,
          reason: 'worker_group_mutation_invalid',
        }, 400);
      }
      const initialized = await this.initializeWorkerGroupCapacity(mutation.slug, mutation.sessionId);
      if (!initialized.ok) {
        return jsonResponse(initialized, initialized.status || 503);
      }
      const caps = resolveWorkerGroupCaps(this.env);
      let groupReservation = null;
      let memberReservation = null;
      let updateReservation = null;
      let deleteReservation = null;
      let removalReservation = null;
      let principalDigest = '';
      let activeGroup = null;
      const intent = {
        ...(mutation.operation === 'delete' ? {} : { input: pickWorkerGroupInput(mutation.input) }),
        ...(mutation.principal ? { principal: mutation.principal } : {}),
        actorPrincipal: mutation.actorPrincipal,
      };
      if (byteLength(JSON.stringify(intent)) > WORKER_GROUP_INTENT_MAX_BYTES) {
        return jsonResponse({ ok: false, status: 400, reason: 'worker_group_input_too_large' }, 400);
      }
      {
        // A retried create meets its own pending reservation here too.
        const settled = await this.settleWorkerGroupReservations({
          slug: mutation.slug,
          sessionId: mutation.sessionId,
          groupIds: [mutation.groupId],
          principal: mutation.principal ? { principal: mutation.principal, key: mutation.principalKey } : null,
        });
        if (!settled.ok) return jsonResponse(settled, settled.status || 503);
        // A retry of the request the settle just finished gets that outcome, not
        // already-exists or not-found for its own effect. Updates still apply.
        const finished = settled.replayed.find((entry) => entry.result.ok && entry.operation === mutation.operation &&
          (mutation.operation === 'delete' ||
            (mutation.operation === 'remove-member' && entry.principalKey === mutation.principalKey) ||
            (mutation.operation === 'create' && sameWorkerGroupInput(entry.input, intent.input))));
        if (finished) return this.respondToWorkerGroupMutation(mutation, finished.result);
      }
      if (mutation.operation === 'create') {
        groupReservation = await this.reserveWorkerGroupSlot({
          slug: mutation.slug,
          sessionId: mutation.sessionId,
          groupId: mutation.groupId,
          maxGroupsPerSession: caps.maxGroupsPerSession,
          intent,
        });
        if (!groupReservation.ok) {
          return jsonResponse(groupReservation, groupReservation.status || 409);
        }
      } else {
        activeGroup = await this.getActiveWorkerGroupCapacity(mutation.groupId);
        if (!activeGroup.ok) {
          return jsonResponse(activeGroup, activeGroup.status || 404);
        }
        if (
          mutation.operation === 'join' &&
          activeGroup.state.joinMode !== 'open'
        ) {
          return jsonResponse({
            ok: false,
            status: 403,
            reason: 'worker_group_join_denied',
          }, 403);
        }
        if (mutation.operation === 'join') {
          const joinEndsAt = Date.parse(toTrimmedString(activeGroup.state.joinEndsAt));
          if (Number.isFinite(joinEndsAt) && joinEndsAt <= Number(this.now())) {
            return jsonResponse({
              ok: false,
              status: 403,
              reason: 'worker_group_join_ended',
            }, 403);
          }
        }
        if (mutation.operation === 'update') {
          if (Object.prototype.hasOwnProperty.call(mutation.input, 'memberLimit')) {
            const requestedMemberLimit = Number(mutation.input.memberLimit);
            if (
              Number.isSafeInteger(requestedMemberLimit) &&
              requestedMemberLimit > 0 &&
              requestedMemberLimit < Number(activeGroup.state.memberCount || 0)
            ) {
              return jsonResponse({
                ok: false,
                status: 409,
                reason: 'worker_group_member_limit_below_current',
              }, 409);
            }
          }
          updateReservation = await this.beginWorkerGroupUpdate(mutation.groupId, intent);
          if (!updateReservation.ok) {
            return jsonResponse(updateReservation, updateReservation.status || 404);
          }
        } else if (mutation.operation === 'delete') {
          deleteReservation = await this.beginWorkerGroupDelete(mutation.groupId, intent);
          if (!deleteReservation.ok) return jsonResponse(deleteReservation, deleteReservation.status || 404);
        }
      }
      if (mutation.operation === 'add-member' || mutation.operation === 'join') {
        principalDigest = await sha256Hex(`worker-group-member:${mutation.principalKey}`);
        memberReservation = await this.reserveWorkerGroupMemberSlot({
          groupId: mutation.groupId,
          principalDigest,
          maxMembersPerGroup: caps.maxMembersPerGroup,
          intent,
        });
        if (!memberReservation.ok) {
          return jsonResponse(memberReservation, memberReservation.status || 409);
        }
      } else if (mutation.operation === 'remove-member') {
        principalDigest = await sha256Hex(`worker-group-member:${mutation.principalKey}`);
        removalReservation = await this.beginWorkerGroupMemberRemoval({
          groupId: mutation.groupId,
          principalDigest,
          intent,
        });
        if (!removalReservation.ok) {
          return jsonResponse(removalReservation, removalReservation.status || 404);
        }
      }

      let result;
      try {
        result = await executeWorkerGroupMutation({
          env: this.env,
          ...mutation,
          capacityAuthorized: true,
        });
      } catch {
        // KV may have accepted a write before surfacing an error. Retain the
        // reservation, with its intent, until a later operation replays it.
        return jsonResponse({
          ok: false,
          status: 503,
          reason: 'worker_group_mutation_ambiguous',
        }, 503);
      }

      await this.completeWorkerGroupReservation(
        mutation,
        result,
        groupReservation || updateReservation || deleteReservation || memberReservation || removalReservation,
      );
      if (!result.ok) return jsonResponse(result, result.status || 400);
      return this.respondToWorkerGroupMutation(mutation, result);
    });
  }

  async respondToWorkerGroupMutation(mutation, result) {
    if (mutation.operation === 'add-member' || mutation.operation === 'join' || mutation.operation === 'remove-member') {
      const postMutationGroup = await this.getActiveWorkerGroupCapacity(mutation.groupId);
      const memberCount = Number(postMutationGroup?.state?.memberCount);
      if (!postMutationGroup.ok || !Number.isSafeInteger(memberCount) || memberCount < 0) {
        return jsonResponse({ ok: false, status: 503, reason: 'worker_group_capacity_state_unavailable' }, 503);
      }
      result = {
        ...result,
        group: {
          ...(result.group || {}),
          groupId: mutation.groupId,
          joinMode: postMutationGroup.state.joinMode,
          memberVisibility: postMutationGroup.state.memberVisibility,
        },
        memberCount,
      };
    }
    return jsonResponse(result, 200);
  }

  async readSessionConfigAuthority(slug) {
    const existing = await this.state.storage.get(SESSION_CONFIG_AUTHORITY_KEY);
    if (existing != null) {
      if (existing.slug !== slug || !Number.isSafeInteger(existing.revision) || existing.revision < 1 ||
        !normalizePublicSessionConfig(existing.config, slug)) {
        throw Object.assign(new Error('Invalid authoritative session config.'), { status: 409 });
      }
      return existing;
    }
    // KV can initialize a legacy tenant once. After this durable record exists,
    // neither a stale replica nor a caller's baseConfig may replace its policy.
    const config = await getLegacySessionConfigForAuthority(this.env, normalizeWorkerSessionSlug(slug));
    if (!config) return null;
    const normalized = normalizePublicSessionConfig(config, slug);
    if (!normalized) throw legacySessionConfigMigrationError();
    const authority = { schemaVersion: 1, slug, revision: 1, config: normalized, projectionPending: false };
    return this.state.storage.transaction(async (transaction) => {
      const current = await transaction.get(SESSION_CONFIG_AUTHORITY_KEY);
      if (current != null) return current;
      await transaction.put(SESSION_CONFIG_AUTHORITY_KEY, authority);
      return authority;
    });
  }

  async assertSessionAuthority(payload) {
    const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
    const authority = slug ? await this.readSessionConfigAuthority(slug) : null;
    assertExpectedSessionAuthority(authority, payload?.expectedAuthority, slug);
    return authority;
  }

  // The config HTTP routes enforce, also read in-process by work that already
  // runs here: refetching this Durable Object from itself would queue behind it.
  async readCurrentSessionConfig(slug) {
    // Reads may pass a long visibility scan, but never pending config/Lit
    // projection repair. The transaction observes both journals together.
    const current = await this.state.storage.transaction(async (transaction) => {
      const authority = await transaction.get(SESSION_CONFIG_AUTHORITY_KEY);
      if (!authority || authority.projectionPending === true || await hasPendingLitAuthorizationSetup(transaction)) return null;
      if (authority.slug !== slug || !Number.isSafeInteger(authority.revision) || authority.revision < 1 ||
        !normalizePublicSessionConfig(authority.config, slug)) throw new Error('Invalid authoritative session config.');
      return authority;
    });
    if (current) return { config: current.config, revision: current.revision };
    return this.serializeSessionConfigOperation(async () => {
      await this.repairPendingSessionConfigProjection();
      const authority = await this.readSessionConfigAuthority(slug);
      return { config: authority?.config ?? null, revision: authority?.revision ?? 0 };
    });
  }

  async executeSessionConfigCurrent(payload) {
    const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
    if (!slug) return jsonResponse({ error: 'Invalid session slug.' }, 400);
    try {
      return jsonResponse({ ok: true, ...(await this.readCurrentSessionConfig(slug)) });
    } catch (error) {
      if (error?.reason === SESSION_CONFIG_MIGRATION_REQUIRED_REASON) {
        const safeError = legacySessionConfigMigrationError();
        return jsonResponse({ error: safeError.message, reason: safeError.reason }, 503);
      }
      return jsonResponse({ error: 'Session config coordination is unavailable; retry.' }, 503);
    }
  }

  async executeStoragePublication(payload) {
    return this.serializeSessionConfigOperation(async () => {
      try {
        const authority = await this.assertSessionAuthority(payload);
        await this.repairPendingSessionConfigProjection();
        await publishCloudflareOwnedStorageMetadata({ env: this.env, slug: normalizeWorkerSessionSlug(payload.slug),
          config: authority?.config, actor: payload.expectedAuthority.actor,
          metadata: payload.metadata, createOwner: payload.createOwner === true });
        return jsonResponse({ ok: true });
      } catch (error) {
        return jsonResponse({ error: error.message || 'Storage publication failed.' }, error.status || 503);
      }
    });
  }

  async executeStorageVisibilityMutation(payload) {
    // Keep hide/unhide operations ordered, while yielding the config queue
    // between bounded pages. A later authority change cancels remaining writes.
    const run = this.storageVisibilityTail.then(async () => {
      try {
        const runVisibilityMutation = (operation) => this.serializeSessionConfigOperation(async () => {
          const authority = await this.assertSessionAuthority(payload);
          await this.repairPendingSessionConfigProjection();
          return operation(authority);
        });
        const authority = await runVisibilityMutation((current) => current);
        const result = await setCloudflareStorageResourceHidden({
          env: this.env, slug: normalizeWorkerSessionSlug(payload.slug), config: authority?.config,
          body: payload.body, actor: payload.expectedAuthority.actor, deps: { now: this.now, runVisibilityMutation },
        });
        return jsonResponse(result.ok ? result.body : { error: result.error }, result.status || 500);
      } catch (error) {
        return jsonResponse({ error: error.message || 'Storage visibility update failed.' }, error.status || 503);
      }
    });
    this.storageVisibilityTail = run.catch(() => undefined);
    return run;
  }

  async finalizeSessionConfigProjection(revision) {
    await this.state.storage.transaction(async (transaction) => {
      const current = await transaction.get(SESSION_CONFIG_AUTHORITY_KEY);
      if (current?.revision !== revision || current?.projectionPending !== true) return;
      await transaction.put(SESSION_CONFIG_AUTHORITY_KEY, {
        ...current,
        projectionPending: false,
      });
    });
  }

  async projectSessionConfigAuthority(authority) {
    // The coordinator names the reserved tenant "general", while production
    // readers address its KV projection with the canonical empty slug.
    await this.putSessionConfig(
      this.env,
      normalizeWorkerSessionSlug(authority.slug),
      authority.config,
    );
    await this.finalizeSessionConfigProjection(authority.revision);
  }

  async repairPendingSessionConfigProjection() {
    await repairPendingLitAuthorizationSetup(this);
    const authority = await this.state.storage.get(SESSION_CONFIG_AUTHORITY_KEY);
    if (authority?.projectionPending !== true) return;
    await this.projectSessionConfigAuthority(authority);
  }

  async executeStorageEnvelopeKeyGetOrCreate(payload) {
    return this.serializeSessionConfigOperation(async () => {
      const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
      const baseConfig = slug ? normalizePublicSessionConfig(payload?.baseConfig, slug) : null;
      const candidate = normalizeWrappedSessionKeyRecord(payload?.candidateRecord, slug);
      if (!slug || !baseConfig || !candidate) {
        return jsonResponse({ error: 'Invalid wrapped session-key candidate.' }, 400);
      }

      try {
        await this.repairPendingSessionConfigProjection();
      } catch {
        return jsonResponse({ error: 'Session config projection is pending; retry.' }, 503);
      }

      const reserved = await this.state.storage.transaction(async (transaction) => {
        const existing = await transaction.get(SESSION_CONFIG_AUTHORITY_KEY);
        if (existing && resolveCoordinatorSessionSlugStorageKey(existing.slug) !== slug) {
          return { error: 'Session config authority identity conflict.', status: 409 };
        }
        const authorityConfig = existing?.config
          ? normalizePublicSessionConfig(existing.config, slug)
          : baseConfig;
        if (!authorityConfig) {
          return { error: 'Invalid authoritative session config.', status: 409 };
        }
        const configuredKey = normalizeWrappedSessionKeyRecord(
          authorityConfig?.storageEnvelope?.sessionKey,
          slug,
        );
        const activeKey = normalizeWrappedSessionKeyRecord(existing?.activeSessionKey, slug) || configuredKey;
        const chosen = activeKey || candidate;
        const nextConfig = withAuthoritativeSessionKey(authorityConfig, chosen);
        if (existing && activeKey) {
          return {
            authority: existing,
            config: nextConfig,
            created: false,
            sessionKey: chosen,
            project: false,
          };
        }
        const authority = {
          schemaVersion: 1,
          slug,
          // Installing the first wrapped key does not change authorization.
          // Advancing this revision would invalidate the upload that requested
          // the key; admin policy mutations still advance it independently.
          revision: existing?.revision ?? 1,
          config: nextConfig,
          activeSessionKey: chosen,
          projectionPending: true,
        };
        await transaction.put(SESSION_CONFIG_AUTHORITY_KEY, authority);
        return {
          authority,
          config: nextConfig,
          created: !configuredKey,
          sessionKey: chosen,
          project: true,
        };
      });
      if (reserved?.error) return jsonResponse({ error: reserved.error }, reserved.status || 409);
      if (reserved.project) {
        try {
          await this.projectSessionConfigAuthority(reserved.authority);
        } catch {
          return jsonResponse({ error: 'Session config projection is pending; retry.' }, 503);
        }
      }
      return jsonResponse({
        ok: true,
        config: reserved.config,
        created: reserved.created,
        sessionKey: reserved.sessionKey,
      });
    });
  }

  async executeSessionConfigMutation(payload) {
    return this.serializeSessionConfigOperation(async () => {
      const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
      if (!slug || !isObjectRecord(payload?.mutation)) {
        return jsonResponse({ error: 'Invalid session config mutation.' }, 400);
      }

      try {
        await this.assertSessionAuthority(payload);
        await this.repairPendingSessionConfigProjection();
      } catch (error) {
        return jsonResponse({ error: error.message || 'Session config projection is pending; retry.' }, error.status || 503);
      }

      const reserved = await this.state.storage.transaction(async (transaction) => {
        const existing = await transaction.get(SESSION_CONFIG_AUTHORITY_KEY);
        if (existing && resolveCoordinatorSessionSlugStorageKey(existing.slug) !== slug) {
          return { error: 'Session config authority identity conflict.', status: 409 };
        }
        const authorityConfig = existing?.config
          ? normalizePublicSessionConfig(existing.config, slug)
          : {};
        if (!authorityConfig) {
          return { error: 'Invalid authoritative session config.', status: 409 };
        }
        const activeSessionKey = normalizeWrappedSessionKeyRecord(existing?.activeSessionKey, slug) ||
          normalizeWrappedSessionKeyRecord(authorityConfig?.storageEnvelope?.sessionKey, slug);
        const result = this.applySessionConfigMutation({
          existingConfig: authorityConfig,
          mutation: payload.mutation,
          slug,
        });
        if (!result?.ok) {
          return {
            error: result?.error || 'Session config mutation failed.',
            status: result?.status || 400,
          };
        }
        const priorSessionKey = authorityConfig?.storageEnvelope?.sessionKey ?? null;
        const mutatedSessionKey = result.config?.storageEnvelope?.sessionKey ?? null;
        if (
          !activeSessionKey &&
          stableCanonicalSerialize(mutatedSessionKey) !==
            stableCanonicalSerialize(priorSessionKey)
        ) {
          return {
            error: 'Storage envelope session keys must be created through the key coordinator.',
            status: 409,
          };
        }
        const nextConfig = withAuthoritativeSessionKey(result.config, activeSessionKey);
        if (
          result.skipPersistence ||
          stableCanonicalSerialize(nextConfig) === stableCanonicalSerialize(authorityConfig)
        ) {
          return { config: authorityConfig, project: false, skipPersistence: true };
        }
        const authority = {
          schemaVersion: 1,
          slug,
          revision: Number(existing?.revision || 0) + 1,
          config: nextConfig,
          activeSessionKey,
          projectionPending: true,
        };
        await transaction.put(SESSION_CONFIG_AUTHORITY_KEY, authority);
        return { authority, config: nextConfig, project: true, skipPersistence: false };
      });
      if (reserved?.error) return jsonResponse({ error: reserved.error }, reserved.status || 400);
      if (reserved.project) {
        try {
          await this.projectSessionConfigAuthority(reserved.authority);
        } catch {
          return jsonResponse({ error: 'Session config projection is pending; retry.' }, 503);
        }
      }
      return jsonResponse({ ok: true, skipPersistence: reserved.skipPersistence === true });
    });
  }

  async readAuthNonceKey({ create = false } = {}) {
    const existing = await this.state.storage.get(AUTH_NONCE_MAC_KEY);
    if (/^[0-9a-f]{64}$/.test(toTrimmedString(existing?.key)) || !create) return toTrimmedString(existing?.key);
    const candidate = { version: 1, key: bytesToHex(this.crypto.getRandomValues(new Uint8Array(32))) };
    const record = await this.state.storage.transaction(async (transaction) => {
      const current = await transaction.get(AUTH_NONCE_MAC_KEY);
      if (/^[0-9a-f]{64}$/.test(toTrimmedString(current?.key))) return current;
      await transaction.put(AUTH_NONCE_MAC_KEY, candidate);
      return candidate;
    });
    return record.key;
  }

  async executeAuthNonceIssue(payload) {
    const nowMs = Number(this.now()) || Date.now();
    const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
    const address = toTrimmedString(payload?.address).toLowerCase();
    const random = toTrimmedString(payload?.nonce);
    const expiresAtMs = normalizeBoundedFutureTimestamp(
      payload?.expiresAtMs,
      nowMs,
      MAX_AUTH_NONCE_LIFETIME_MS,
    );
    if (!slug || !address || !/^[0-9a-f]{32}$/.test(random) || !expiresAtMs) {
      return jsonResponse({ error: 'Invalid auth nonce issuance request.' }, 400);
    }
    const keyHex = await this.readAuthNonceKey({ create: true });
    const expiry = String(expiresAtMs).padStart(13, '0');
    const mac = await signAuthNonce({ cryptoImpl: this.crypto, keyHex, slug, address, random, expiry });
    return jsonResponse({ ok: true, nonce: `n1${random}${expiry}${mac}` });
  }

  async executeAuthNonceConsume(payload) {
    const nowMs = Number(this.now()) || Date.now();
    const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
    const address = toTrimmedString(payload?.address).toLowerCase();
    const nonce = toTrimmedString(payload?.nonce);
    const usedExpiresAtMs = normalizeBoundedFutureTimestamp(
      payload?.usedExpiresAtMs,
      nowMs,
      MAX_AUTH_NONCE_LIFETIME_MS,
    );
    if (!slug || !address || !nonce || nonce.length > 256 || !usedExpiresAtMs) {
      return jsonResponse({ error: 'Invalid auth nonce consumption request.' }, 400);
    }
    // Check a signed nonce before the transaction; its key never changes.
    const signed = nonce.match(SIGNED_AUTH_NONCE_RE);
    let signedExpiresAtMs = 0;
    if (signed) {
      const keyHex = await this.readAuthNonceKey();
      const expiresAtMs = Number(signed[2]);
      const mac = keyHex
        ? await signAuthNonce({ cryptoImpl: this.crypto, keyHex, slug, address, random: signed[1], expiry: signed[2] })
        : '';
      if (mac && equalText(mac, signed[3]) && expiresAtMs > nowMs && expiresAtMs <= nowMs + MAX_AUTH_NONCE_LIFETIME_MS) {
        signedExpiresAtMs = expiresAtMs;
      }
    }

    const result = await this.state.storage.transaction(async (transaction) => {
      const used = await transaction.get(AUTH_NONCE_USED_KEY);
      const entries = Array.isArray(used?.entries)
        ? used.entries.filter((entry) => Number(entry?.expiresAtMs || 0) > nowMs)
        : [];
      if (entries.some((entry) => toTrimmedString(entry?.nonce) === nonce)) {
        await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
        return { ok: false, error: 'Nonce already used.' };
      }
      if (signed) {
        // Kept past the nonce's own expiry too, for margin, as before.
        if (signedExpiresAtMs) entries.push({ nonce, expiresAtMs: Math.max(signedExpiresAtMs, usedExpiresAtMs) });
        await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
        return signedExpiresAtMs ? { ok: true } : { ok: false, error: 'Nonce mismatch or expired.' };
      }

      // A nonce the previous release issued is consumed from its stored list.
      const active = readActiveAuthNonces(await transaction.get(AUTH_NONCE_ACTIVE_KEY), nowMs);
      const remaining = active.filter((entry) => entry.nonce !== nonce);
      await putActiveAuthNonces(transaction, remaining);
      if (remaining.length === active.length) {
        await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
        return { ok: false, error: 'Nonce mismatch or expired.' };
      }

      entries.push({ nonce, expiresAtMs: usedExpiresAtMs });
      await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
      return { ok: true };
    });
    return jsonResponse(result, result.ok ? 200 : 409);
  }

  async executeAuthRateCheck(payload) {
    const nowMs = Number(this.now()) || Date.now();
    const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
    const route = toTrimmedString(payload?.route).toLowerCase();
    const identity = toTrimmedString(payload?.identity).toLowerCase();
    const limit = normalizePositiveSafeInteger(payload?.limit);
    const resetAtMs = normalizeBoundedFutureTimestamp(
      payload?.resetAtMs,
      nowMs,
      MAX_AUTH_RATE_WINDOW_MS,
    );
    if (!slug || !route || !identity || !limit || !resetAtMs) {
      return jsonResponse({ error: 'Invalid auth rate-limit request.' }, 400);
    }
    const result = await this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(AUTH_RATE_RECORD_KEY);
      const current = Number(existing?.resetAtMs || 0) > nowMs
        ? normalizePositiveSafeInteger(existing?.count)
        : 0;
      const count = current + 1;
      const effectiveResetAtMs = Number(existing?.resetAtMs || 0) > nowMs
        ? existing.resetAtMs
        : resetAtMs;
      await transaction.put(AUTH_RATE_RECORD_KEY, {
        version: 1,
        count,
        resetAtMs: effectiveResetAtMs,
      });
      return { ok: true, allowed: count <= limit, count, resetAtMs: effectiveResetAtMs };
    });
    return jsonResponse(result);
  }

  async executeHostedFaucetQuota(payload, finalize = false) {
    const requestId = toTrimmedString(payload?.requestId);
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(requestId) || (finalize && typeof payload?.sent !== 'boolean')) {
      return jsonResponse({ error: 'Invalid hosted faucet quota request.' }, 400);
    }
    const nowMs = Number(this.now()) || Date.now();
    const cutoff = nowMs - 24 * 60 * 60 * 1000;
    const result = await this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(HOSTED_FAUCET_QUOTA_KEY);
      const sent = (Array.isArray(existing?.sent) ? existing.sent : []).filter((at) => at > cutoff);
      const pending = Object.fromEntries(Object.entries(existing?.pending || {}).filter(([, at]) => at > cutoff));
      if (finalize) {
        if (!Object.hasOwn(pending, requestId)) return { ok: true, alreadyFinalized: true };
        delete pending[requestId];
        if (payload.sent) sent.push(nowMs);
      } else {
        if (Object.hasOwn(pending, requestId) || sent.length + Object.keys(pending).length >= 3) {
          return { ok: true, allowed: false };
        }
        pending[requestId] = nowMs;
      }
      await transaction.put(HOSTED_FAUCET_QUOTA_KEY, { version: 1, sent, pending });
      return { ok: true, ...(finalize ? {} : { allowed: true, requestId }) };
    });
    return jsonResponse(result);
  }

  async reserveSponsoredDeploy(requestDigest) {
    const nowMs = Number(this.now()) || Date.now();
    return this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(SPONSORED_DEPLOY_RECORD_KEY);
      if (existing && toTrimmedString(existing.requestDigest) !== requestDigest) {
        return { kind: 'conflict' };
      }
      if (existing?.state === 'terminal' && existing.result) {
        return { kind: 'terminal', result: existing.result };
      }
      if (
        existing?.state === 'running' &&
        (
          this.activeAttemptId === toTrimmedString(existing.attemptId) ||
          nowMs - Number(existing.startedAtMs || 0) < RUNNING_LEASE_MS
        )
      ) {
        return { kind: 'pending' };
      }

      const attemptId = createAttemptId(this.crypto);
      await transaction.put(SPONSORED_DEPLOY_RECORD_KEY, {
        version: 1,
        state: 'running',
        requestDigest,
        attemptId,
        startedAtMs: nowMs,
      });
      return { kind: 'execute', attemptId };
    });
  }

  async finalizeSponsoredDeploy({ requestDigest, attemptId, result, terminal }) {
    await this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(SPONSORED_DEPLOY_RECORD_KEY);
      if (
        toTrimmedString(existing?.requestDigest) !== requestDigest ||
        toTrimmedString(existing?.attemptId) !== attemptId ||
        existing?.state !== 'running'
      ) {
        return;
      }
      await transaction.put(SPONSORED_DEPLOY_RECORD_KEY, terminal
        ? {
            version: 1,
            state: 'terminal',
            requestDigest,
            result,
            completedAtMs: Number(this.now()) || Date.now(),
          }
        : {
            version: 1,
            state: 'retryable',
            requestDigest,
            updatedAtMs: Number(this.now()) || Date.now(),
          });
    });
  }

  async reserveDirectDeploy({ requestDigest, immutableIdentityDigest, accountId }) {
    const nowMs = Number(this.now()) || Date.now();
    return this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(DIRECT_DEPLOY_RECORD_KEY);
      if (
        existing &&
        toTrimmedString(existing.immutableIdentityDigest) !== immutableIdentityDigest
      ) {
        return { kind: 'identity-conflict' };
      }
      if (existing && toTrimmedString(existing.accountId) !== accountId) {
        return { kind: 'account-conflict' };
      }
      if (existing?.state === 'terminal' && existing.result) {
        // A stable deployment identity is consumed after terminal success. A
        // later token or mutable-config edit replays that deployment instead
        // of silently creating or overwriting infrastructure.
        return {
          kind: 'terminal',
          result: existing.result,
          requestDigestMatches: toTrimmedString(existing.requestDigest) === requestDigest,
        };
      }
      if (
        existing?.state === 'running' &&
        (
          this.activeDirectAttemptId === toTrimmedString(existing.attemptId) ||
          nowMs - Number(existing.startedAtMs || 0) < RUNNING_LEASE_MS
        )
      ) {
        return { kind: 'pending' };
      }

      const attemptId = createAttemptId(this.crypto);
      await transaction.put(DIRECT_DEPLOY_RECORD_KEY, {
        version: 1,
        state: 'running',
        requestDigest,
        immutableIdentityDigest,
        accountId,
        attemptId,
        startedAtMs: nowMs,
      });
      return { kind: 'execute', attemptId };
    });
  }

  async finalizeDirectDeploy({
    requestDigest,
    immutableIdentityDigest,
    accountId,
    attemptId,
    result,
    terminal,
  }) {
    await this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(DIRECT_DEPLOY_RECORD_KEY);
      if (
        existing?.state !== 'running' ||
        toTrimmedString(existing.requestDigest) !== requestDigest ||
        toTrimmedString(existing.immutableIdentityDigest) !== immutableIdentityDigest ||
        toTrimmedString(existing.accountId) !== accountId ||
        toTrimmedString(existing.attemptId) !== attemptId
      ) return;
      await transaction.put(DIRECT_DEPLOY_RECORD_KEY, terminal
        ? {
            version: 1,
            state: 'terminal',
            requestDigest,
            immutableIdentityDigest,
            accountId,
            result,
            completedAtMs: Number(this.now()) || Date.now(),
          }
        : {
            version: 1,
            state: 'retryable',
            requestDigest,
            immutableIdentityDigest,
            accountId,
            updatedAtMs: Number(this.now()) || Date.now(),
          });
    });
  }

  async executeDirectDeploy(payload) {
    const requestDigest = toTrimmedString(payload?.requestDigest);
    const immutableIdentityDigest = toTrimmedString(payload?.immutableIdentityDigest);
    const deployBody = payload?.deployBody && typeof payload.deployBody === 'object'
      ? payload.deployBody
      : null;
    if (!requestDigest || !immutableIdentityDigest || !deployBody) {
      return jsonResponse({ error: 'Invalid direct deploy coordination request.' }, 400);
    }
    const account = await this.lookupCloudflareAccount({
      apiToken: toTrimmedString(deployBody.apiToken || deployBody.token),
      env: this.env,
    });
    if (!account?.ok || !toTrimmedString(account.accountId)) {
      const lookupStatus = Number(account?.status || 0);
      const responseStatus = lookupStatus === 404 || lookupStatus === 409 ? lookupStatus : 502;
      const safeError = buildSafeSponsoredReceiptBody({
        error: account?.error || 'Failed to derive the Cloudflare account for deployment.',
        deploymentRequestPending: account?.status >= 500 || account?.status === 429,
      }, Array.isArray(payload?.sensitiveValues) ? payload.sensitiveValues : []);
      return jsonResponse({
        ok: false,
        status: responseStatus,
        body: safeError,
      }, responseStatus);
    }
    const accountId = toTrimmedString(account.accountId);
    const reservation = await this.reserveDirectDeploy({ requestDigest, immutableIdentityDigest, accountId });
    if (reservation.kind === 'terminal') {
      const replayResult = buildDirectDeployTerminalReplay(reservation);
      return jsonResponse(replayResult, Number(replayResult?.status || 0) || 200);
    }
    if (reservation.kind === 'account-conflict') {
      return jsonResponse({
        ok: false,
        status: 409,
        body: {
          error: 'This deployment request is already bound to a different Cloudflare account.',
          deploymentRequestConflict: true,
          deploymentRequestTerminal: true,
        },
      }, 409);
    }
    if (reservation.kind === 'identity-conflict') {
      return jsonResponse({
        ok: false,
        status: 409,
        body: {
          error: 'deploymentRequestId was already used for a different immutable deployment identity.',
          deploymentRequestConflict: true,
          deploymentRequestTerminal: true,
        },
      }, 409);
    }
    if (reservation.kind === 'pending') {
      return jsonResponse({
        ok: false,
        status: 503,
        body: {
          error: 'Deployment request is already running; retry the same request later.',
          deploymentRequestPending: true,
        },
      }, 503);
    }

    let rawResult;
    this.activeDirectAttemptId = reservation.attemptId;
    try {
      const coordinatedRequestDigest = await sha256Hex(stableCanonicalSerialize({
        version: 1,
        immutableIdentityDigest,
        accountId,
      }));
      rawResult = await this.executeDeployHelperRequest({
        body: deployBody,
        env: this.env,
        requestOrigin: toTrimmedString(payload?.requestOrigin),
        consoleImpl: console,
        coordinationBypass: true,
        coordinatedRequestDigest,
        resolvedAccountId: accountId,
      });
    } catch {
      rawResult = {
        ok: false,
        status: 503,
        body: {
          error: 'Deployment execution was interrupted; retry the same request.',
          deploymentRequestPending: true,
        },
      };
    }
    try {
      const result = normalizeDeployResult(
        rawResult,
        Array.isArray(payload?.sensitiveValues) ? payload.sensitiveValues : [],
      );
      const terminal = isTerminalDeployResult(result);
      await this.finalizeDirectDeploy({
        requestDigest,
        immutableIdentityDigest,
        accountId,
        attemptId: reservation.attemptId,
        result,
        terminal,
      });
      return jsonResponse(result, result.status);
    } finally {
      if (this.activeDirectAttemptId === reservation.attemptId) this.activeDirectAttemptId = '';
    }
  }

  async reserveSponsoredFaucet(requestDigest) {
    return this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(SPONSORED_FAUCET_RECORD_KEY);
      if (existing && toTrimmedString(existing.requestDigest) !== requestDigest) {
        return { kind: 'conflict' };
      }
      if (existing?.state === 'terminal' && existing.receipt) {
        return { kind: 'terminal', receipt: existing.receipt };
      }
      if (existing?.state === 'running') return { kind: 'pending' };
      await transaction.put(SPONSORED_FAUCET_RECORD_KEY, {
        version: 1,
        state: 'running',
        requestDigest,
        startedAtMs: Number(this.now()) || Date.now(),
      });
      return { kind: 'execute' };
    });
  }

  async finalizeSponsoredFaucet({ requestDigest, receipt }) {
    const safeReceipt = {
      status: Number(receipt?.status || 0) || 502,
      body: buildSafeSponsoredReceiptBody(
        receipt?.body && typeof receipt.body === 'object' ? receipt.body : {},
      ),
    };
    return this.state.storage.transaction(async (transaction) => {
      const existing = await transaction.get(SPONSORED_FAUCET_RECORD_KEY);
      if (toTrimmedString(existing?.requestDigest) !== requestDigest) return null;
      if (existing?.state === 'terminal' && existing.receipt) return existing.receipt;
      if (existing?.state !== 'running') return null;
      await transaction.put(SPONSORED_FAUCET_RECORD_KEY, {
        version: 1,
        state: 'terminal',
        requestDigest,
        receipt: safeReceipt,
        completedAtMs: Number(this.now()) || Date.now(),
      });
      return safeReceipt;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Not found.' }, 404);
    }

    const payload = await request.json().catch(() => null);
    if (url.pathname.startsWith('/session-config/') && url.hostname !== 'session-coordinator.internal') {
      return jsonResponse({ error: 'Not found.' }, 404);
    }
    if (url.pathname === '/session-config/current') return this.executeSessionConfigCurrent(payload);
    if (url.pathname === '/session-config/storage/set-hidden') return this.executeStorageVisibilityMutation(payload);
    if (url.pathname === '/session-config/storage/publish') return this.executeStoragePublication(payload);
    if (url.pathname === '/session-config/lit-authorization/ensure') {
      return this.serializeSessionConfigOperation(() => executeLitAuthorizationSignerEnsure(this, payload));
    }
    if (url.pathname === '/session-config/lit-authorization/finalize') {
      return this.serializeSessionConfigOperation(() => executeLitAuthorizationFinalize(this, payload));
    }
    if (url.pathname === '/session-config/lit-authorization/update-secrets') {
      return this.serializeSessionConfigOperation(() => executeSessionSecretsAfterLitRepair(this, payload));
    }
    if (url.pathname === '/session-config/storage-envelope-key/get-or-create') {
      return this.executeStorageEnvelopeKeyGetOrCreate(payload);
    }
    if (url.pathname === '/session-config/mutate') {
      return this.executeSessionConfigMutation(payload);
    }
    if (url.pathname === '/results-analysis/status') {
      return this.executeResultsAnalysisStatus();
    }
    if (url.pathname === '/storage/legacy-owner') {
      return this.executeStorageLegacyOwner(payload);
    }
    if (url.pathname === '/results-analysis/reserve') {
      return this.executeResultsAnalysisReserve(payload);
    }
    if (url.pathname === '/results-analysis/finalize') {
      return this.executeResultsAnalysisFinalize(payload);
    }
    if (url.pathname === '/results-analysis/auto/enqueue') {
      return this.executeResultsAnalysisAutoEnqueue(payload);
    }
    if (url.pathname === '/auth-state/nonce/issue') {
      return this.executeAuthNonceIssue(payload);
    }
    if (url.pathname === '/auth-state/nonce/consume') {
      return this.executeAuthNonceConsume(payload);
    }
    if (url.pathname === '/hosted-faucet/reserve' || url.pathname === '/hosted-faucet/finalize') {
      return this.executeHostedFaucetQuota(payload, url.pathname.endsWith('/finalize'));
    }
    if (url.pathname === '/auth-state/rate/check') {
      return this.executeAuthRateCheck(payload);
    }
    if (url.pathname === '/worker-groups/ready') {
      return this.executeWorkerGroupReady(payload);
    }
    if (url.pathname === '/worker-groups/reconcile-empty') {
      return this.executeWorkerGroupReconcileEmpty(payload);
    }
    if (url.pathname === '/worker-groups/authorize') {
      return this.executeWorkerGroupAuthorization(payload);
    }
    if (url.pathname === '/worker-groups/catalog') {
      return this.executeWorkerGroupCatalog(payload);
    }
    if (url.pathname === '/worker-groups/memberships') {
      return this.executeWorkerGroupMemberships(payload);
    }
    if (url.pathname === '/worker-groups/mutate') {
      return this.executeWorkerGroupMutation(payload);
    }
    if (url.pathname === '/deploy-helper') return this.executeDirectDeploy(payload);
    if (url.pathname === '/sponsored-faucet/reserve') {
      const requestDigest = toTrimmedString(payload?.requestDigest);
      if (!requestDigest) return jsonResponse({ error: 'Invalid sponsored faucet reservation.' }, 400);
      const reservation = await this.reserveSponsoredFaucet(requestDigest);
      return jsonResponse(reservation, reservation.kind === 'conflict' ? 409 : (reservation.kind === 'pending' ? 503 : 200));
    }
    if (url.pathname === '/sponsored-faucet/finalize') {
      const requestDigest = toTrimmedString(payload?.requestDigest);
      const receipt = payload?.receipt && typeof payload.receipt === 'object' ? payload.receipt : null;
      if (!requestDigest || !receipt) return jsonResponse({ error: 'Invalid sponsored faucet receipt.' }, 400);
      const storedReceipt = await this.finalizeSponsoredFaucet({ requestDigest, receipt });
      return storedReceipt
        ? jsonResponse({ kind: 'terminal', receipt: storedReceipt }, 200)
        : jsonResponse({ error: 'Sponsored faucet reservation does not match.' }, 409);
    }
    if (url.pathname !== '/sponsored-deploy') return jsonResponse({ error: 'Not found.' }, 404);
    const requestDigest = toTrimmedString(payload?.requestDigest);
    const deployBody = payload?.deployBody && typeof payload.deployBody === 'object'
      ? payload.deployBody
      : null;
    const sensitiveValues = Array.isArray(payload?.sensitiveValues)
      ? payload.sensitiveValues
      : [];
    if (!requestDigest || !deployBody) {
      return jsonResponse({ error: 'Invalid sponsored deploy coordination request.' }, 400);
    }

    const reservation = await this.reserveSponsoredDeploy(requestDigest);
    if (reservation.kind === 'conflict') {
      return jsonResponse({
        ok: false,
        status: 409,
        body: {
          error: 'Sponsored grant was already reserved or redeemed with a different request payload.',
          sponsoredGrantPayloadConflict: true,
        },
      }, 409);
    }
    if (reservation.kind === 'terminal') {
      return jsonResponse(reservation.result, Number(reservation.result?.status || 0) || 200);
    }
    if (reservation.kind === 'pending') {
      return jsonResponse({
        ok: false,
        status: 503,
        body: {
          error: 'Sponsored grant redemption is pending; the action will not be repeated.',
          deploymentRequestPending: true,
        },
      }, 503);
    }

    let rawResult;
    this.activeAttemptId = reservation.attemptId;
    try {
      rawResult = await this.executeDeployHelperRequest({
        body: deployBody,
        env: this.env,
        requestOrigin: toTrimmedString(payload?.requestOrigin),
        consoleImpl: console,
        coordinationBypass: true,
      });
    } catch (error) {
      rawResult = {
        ok: false,
        status: 502,
        body: {
          error: toTrimmedString(error?.message || error) || 'Failed to run embedded sponsored deploy.',
          deploymentRequestPending: true,
        },
      };
    }
    const result = normalizeDeployResult(rawResult, sensitiveValues);
    const terminal = isTerminalDeployResult(result);
    try {
      await this.finalizeSponsoredDeploy({
        requestDigest,
        attemptId: reservation.attemptId,
        result,
        terminal,
      });
      return jsonResponse(result, result.status);
    } finally {
      if (this.activeAttemptId === reservation.attemptId) this.activeAttemptId = '';
    }
  }
}

// Optional independently migrated namespace for Worker Groups. Deployments that
// do not bind CE_WORKER_GROUP_COORDINATOR continue to use
// SessionWriteCoordinator through the existing CE_SESSION_COORDINATOR binding.
export class WorkerGroupWriteCoordinator extends SessionWriteCoordinator {}

export const executeCoordinatedSponsoredDeploy = async ({
  env,
  grantToken,
  requestDigest,
  deployBody,
  requestOrigin = '',
  sensitiveValues = [],
} = {}) => {
  const coordinator = env?.CE_SESSION_COORDINATOR;
  if (!coordinator?.idFromName || !coordinator?.get) {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'Sponsored deploy coordination is unavailable; no Cloudflare action was attempted.',
        deploymentRequestPending: true,
      },
    };
  }
  const normalizedGrantToken = toTrimmedString(grantToken);
  if (!normalizedGrantToken) {
    return { ok: false, status: 400, body: { error: 'Missing sponsored deploy grant identity.' } };
  }
  const coordinatorName = await sha256Hex(`sponsored-grant:${normalizedGrantToken}`);
  const stub = coordinator.get(coordinator.idFromName(coordinatorName));
  const response = await stub.fetch('https://session-coordinator.internal/sponsored-deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestDigest, deployBody, requestOrigin, sensitiveValues }),
  });
  const result = await response.json().catch(() => ({}));
  if (result && typeof result === 'object' && result.body && Number(result.status || 0)) {
    return {
      ok: result.ok === true,
      status: Number(result.status),
      body: result.body,
    };
  }
  return { ok: false, status: response.status || 502, body: result };
};

const resolveCoordinatorStub = async (env, identity) => {
  const coordinator = env?.CE_SESSION_COORDINATOR;
  if (!coordinator?.idFromName || !coordinator?.get) return null;
  const name = await sha256Hex(identity);
  return coordinator.get(coordinator.idFromName(name));
};

const AUTH_STATE_UNAVAILABLE = Object.freeze({
  ok: false,
  status: 503,
  error: 'Authorization state coordination is unavailable.',
});

const callAuthStateCoordinator = async ({
  env,
  identity,
  path,
  payload,
} = {}) => {
  let stub;
  try {
    stub = await resolveCoordinatorStub(env, identity);
  } catch {
    return { ...AUTH_STATE_UNAVAILABLE };
  }
  if (!stub?.fetch) return { ...AUTH_STATE_UNAVAILABLE };
  try {
    const response = await stub.fetch(`https://session-coordinator.internal${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== 'object') return { ...AUTH_STATE_UNAVAILABLE };
    return {
      ...body,
      status: response.status,
    };
  } catch {
    return { ...AUTH_STATE_UNAVAILABLE };
  }
};

export const issueCoordinatedAuthNonce = async ({
  env,
  slug,
  address,
  nonce,
  ttlSeconds,
  usedNonceTtlSeconds = 600,
  now = Date.now,
} = {}) => {
  const nowMs = Number(typeof now === 'function' ? now() : now) || Date.now();
  return callAuthStateCoordinator({
    env,
    identity: `auth-nonce:${toTrimmedString(slug)}:${toTrimmedString(address).toLowerCase()}`,
    path: '/auth-state/nonce/issue',
    payload: {
      slug,
      address,
      nonce,
      expiresAtMs: nowMs + normalizePositiveSafeInteger(ttlSeconds) * 1000,
      usedExpiresAtMs: nowMs + normalizePositiveSafeInteger(usedNonceTtlSeconds) * 1000,
    },
  });
};

export const consumeCoordinatedAuthNonce = async ({
  env,
  slug,
  address,
  nonce,
  usedNonceTtlSeconds,
  now = Date.now,
} = {}) => {
  const nowMs = Number(typeof now === 'function' ? now() : now) || Date.now();
  return callAuthStateCoordinator({
    env,
    identity: `auth-nonce:${toTrimmedString(slug)}:${toTrimmedString(address).toLowerCase()}`,
    path: '/auth-state/nonce/consume',
    payload: {
      slug,
      address,
      nonce,
      usedExpiresAtMs: nowMs + normalizePositiveSafeInteger(usedNonceTtlSeconds) * 1000,
    },
  });
};

const callHostedFaucetQuota = ({ env, slug, address, requestId, sent }, finalize) => callAuthStateCoordinator({
  env,
  identity: `hosted-faucet:${resolveCoordinatorSessionSlugStorageKey(slug)}:${toTrimmedString(address).toLowerCase()}`,
  path: finalize ? '/hosted-faucet/finalize' : '/hosted-faucet/reserve',
  payload: { requestId, ...(finalize ? { sent } : {}) },
});

export const reserveCoordinatedHostedFaucet = (args = {}) => callHostedFaucetQuota({
  ...args, requestId: crypto.randomUUID(),
}, false);
export const finalizeCoordinatedHostedFaucet = (args = {}) => callHostedFaucetQuota(args, true);

export const checkCoordinatedAuthRateLimit = async ({
  env,
  slug,
  route,
  identity,
  limit,
  windowMs,
  now = Date.now,
} = {}) => {
  const nowMs = Number(typeof now === 'function' ? now() : now) || Date.now();
  const normalizedRoute = toTrimmedString(route).toLowerCase();
  const normalizedIdentity = toTrimmedString(identity).toLowerCase();
  return callAuthStateCoordinator({
    env,
    identity: `auth-rate:${toTrimmedString(slug)}:${normalizedRoute}:${normalizedIdentity}`,
    path: '/auth-state/rate/check',
    payload: {
      slug,
      route: normalizedRoute,
      identity: normalizedIdentity,
      limit,
      resetAtMs: nowMs + normalizePositiveSafeInteger(windowMs),
    },
  });
};

export const getOrCreateCoordinatedStorageEnvelopeSessionKey = async ({
  env,
  slug,
  baseConfig,
  candidateRecord,
} = {}) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const stub = normalizedSlug
    ? await resolveCoordinatorStub(env, `session-config:${normalizedSlug}`)
    : null;
  if (!stub) throw new Error('Session config coordination is unavailable.');
  let response;
  try {
    response = await stub.fetch(
      'https://session-coordinator.internal/session-config/storage-envelope-key/get-or-create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: normalizedSlug,
          baseConfig,
          candidateRecord,
        }),
      },
    );
  } catch {
    throw new Error('Session config coordination failed; retry.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.ok !== true) {
    throw new Error(response.status === 503
      ? 'Session config projection is pending; retry.'
      : 'Session config coordination failed.');
  }
  return result;
};

export const executeCoordinatedSessionConfigMutation = async ({
  env,
  slug,
  existingConfig,
  mutation,
  expectedAuthority,
} = {}) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const stub = normalizedSlug
    ? await resolveCoordinatorStub(env, `session-config:${normalizedSlug}`)
    : null;
  if (!stub) {
    return {
      ok: false,
      status: 503,
      body: { error: 'Session config coordination is unavailable; config was not changed.' },
    };
  }
  let response;
  try {
    response = await stub.fetch('https://session-coordinator.internal/session-config/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: normalizedSlug,
        baseConfig: existingConfig || {},
        mutation,
        expectedAuthority,
      }),
    });
  } catch {
    return {
      ok: false,
      status: 503,
      body: { error: 'Session config coordination failed; retry.' },
    };
  }
  const result = await response.json().catch(() => ({}));
  return response.ok && result?.ok === true
    ? { ok: true, status: 200, body: { ok: true } }
    : {
        ok: false,
        status: response.status || 503,
        body: { error: result?.error || 'Session config mutation failed.' },
      };
};

export const reserveCoordinatedSponsoredFaucet = async ({ env, grantToken, requestDigest } = {}) => {
  const token = toTrimmedString(grantToken);
  const digest = toTrimmedString(requestDigest);
  const stub = token ? await resolveCoordinatorStub(env, `sponsored-faucet:${token}`) : null;
  if (!stub) return { kind: 'unavailable' };
  try {
    const response = await stub.fetch('https://session-coordinator.internal/sponsored-faucet/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestDigest: digest }),
    });
    return response.json().catch(() => ({ kind: 'unavailable' }));
  } catch {
    return { kind: 'unavailable' };
  }
};

export const finalizeCoordinatedSponsoredFaucet = async ({
  env,
  grantToken,
  requestDigest,
  receipt,
} = {}) => {
  const token = toTrimmedString(grantToken);
  const stub = token ? await resolveCoordinatorStub(env, `sponsored-faucet:${token}`) : null;
  if (!stub) return null;
  try {
    const response = await stub.fetch('https://session-coordinator.internal/sponsored-faucet/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestDigest, receipt }),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok ? result?.receipt : null;
  } catch {
    return null;
  }
};


// Returns null when there is no coordinator binding, so callers can fall back.
// Each coordinator call scans a bounded step; a few per upload finish most
// sessions, and later uploads continue an unfinished scan.
export const checkCoordinatedLegacyStorageOwner = async ({ env, config, slug, resource, resourceId } = {}) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const stub = normalizedSlug ? await resolveCoordinatorStub(env, `session-config:${normalizedSlug}`) : null;
  if (!stub) return null;
  const unavailable = { ok: false, status: 503, error: LEGACY_SCAN_FAILED_ERROR };
  try {
    for (let step = 0; step < LEGACY_SCAN_STEPS_PER_UPLOAD; step += 1) {
      const response = await stub.fetch('https://session-coordinator.internal/storage/legacy-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, config, resource, resourceId }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.ok === true) return { ok: true, adminOnly: result.adminOnly === true };
      if (result?.pending !== true) return unavailable;
    }
    return { ok: false, status: 503, error: LEGACY_SCAN_PENDING_ERROR };
  } catch {
    return unavailable;
  }
};

export const readCoordinatedResultsAnalysisStatus = async ({ env, slug } = {}) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const stub = normalizedSlug ? await resolveCoordinatorStub(env, `session-config:${normalizedSlug}`) : null;
  if (!stub) return { ok: false, status: 503, error: 'Results analysis coordination is unavailable.' };
  try {
    const response = await stub.fetch('https://session-coordinator.internal/results-analysis/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok ? result : { ok: false, status: response.status || 503, error: result?.error || 'Results analysis status unavailable.' };
  } catch {
    return { ok: false, status: 503, error: 'Results analysis coordination failed; retry.' };
  }
};

export const reserveCoordinatedResultsAnalysis = async ({ env, slug, reservation } = {}) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const stub = normalizedSlug ? await resolveCoordinatorStub(env, `session-config:${normalizedSlug}`) : null;
  if (!stub) return { kind: 'failed', status: 503, error: 'Results analysis coordination is unavailable.' };
  try {
    const response = await stub.fetch('https://session-coordinator.internal/results-analysis/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservation || {}),
    });
    return response.json().catch(() => ({ kind: 'failed', status: response.status || 503 }));
  } catch {
    return { kind: 'failed', status: 503, error: 'Results analysis coordination failed; retry.' };
  }
};

export const finalizeCoordinatedResultsAnalysis = async ({ env, slug, finalization } = {}) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const stub = normalizedSlug ? await resolveCoordinatorStub(env, `session-config:${normalizedSlug}`) : null;
  if (!stub) return { ok: false, status: 503, error: 'Results analysis coordination is unavailable.' };
  try {
    const response = await stub.fetch('https://session-coordinator.internal/results-analysis/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalization || {}),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok ? result : { ok: false, status: response.status || 503, error: result?.error || 'Results analysis finalization failed.' };
  } catch {
    return { ok: false, status: 503, error: 'Results analysis coordination failed; retry.' };
  }
};


export const enqueueCoordinatedResultsAnalysisAutoJob = async ({ env, slug, job } = {}) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug || job?.slug);
  const stub = normalizedSlug ? await resolveCoordinatorStub(env, `session-config:${normalizedSlug}`) : null;
  if (!stub) return { ok: false, status: 503, error: 'Results analysis coordination is unavailable.' };
  try {
    const response = await stub.fetch('https://session-coordinator.internal/results-analysis/auto/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(job || {}), slug: normalizedSlug }),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok ? result : { ok: false, status: response.status || 503, error: result?.error || 'Results analysis auto enqueue failed.' };
  } catch {
    return { ok: false, status: 503, error: 'Results analysis auto enqueue failed; retry.' };
  }
};
