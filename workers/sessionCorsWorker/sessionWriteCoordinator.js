import {
  executeDeployHelperRequest,
  lookupCloudflareAccount,
  sha256Hex,
  stableCanonicalSerialize,
} from '../shared/deployHelperCore.mjs';
import { buildSafeSponsoredReceiptBody } from './sponsoredBootstrapGrantStore.js';
import { runQueuedAutomaticResultsAnalysisJob } from './resultsAnalysisGeneration.js';
import {
  applySessionConfigMutation,
  resolveCanonicalWorkerSessionIdHex,
} from './sessionConfigMutation.js';
import { normalizeWorkerConfigRecord } from './sessionConfigNormalization.js';
import { putSessionConfig } from './sessionConfigSecretsStore.js';
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
const DIRECT_DEPLOY_RECORD_KEY = 'direct-deploy';
const SPONSORED_FAUCET_RECORD_KEY = 'sponsored-faucet';
const SESSION_CONFIG_AUTHORITY_KEY = 'session-config-authority';
const AUTH_NONCE_ACTIVE_KEY = 'auth-nonce-active';
const AUTH_NONCE_USED_KEY = 'auth-nonce-used';
const AUTH_RATE_RECORD_KEY = 'auth-rate-record';
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
    this.workerGroupTail = Promise.resolve();
    this.resultsAnalysisTail = Promise.resolve();
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

  resultsAnalysisPayloadLooksLocked(value, depth = 0) {
    if (depth > 5) return false;
    if (!isObjectRecord(value)) return false;
    if (value.encrypted === true || value.locked === true || value.payloadEncrypted === true) return true;
    const encryptedKeys = new Set(['ciphertext', 'cipherText', 'encryptedContent', 'encryptedKey', 'encryptedPortion', 'keyCipher', 'payloadCiphertext', 'wrappedKey']);
    if (Object.keys(value).some((key) => encryptedKeys.has(key))) return true;
    return Object.values(value).some((entry) => this.resultsAnalysisPayloadLooksLocked(entry, depth + 1));
  }

  sanitizeResultsAnalysisAutoJob(payload = {}) {
    const slug = resolveCoordinatorSessionSlugStorageKey(payload.slug);
    const requestId = toTrimmedString(payload.requestId);
    const committedResponses = Array.isArray(payload.committedResponses)
      ? payload.committedResponses.slice(0, 1).map((entry) => {
          const metadata = isObjectRecord(entry?.metadata) ? entry.metadata : {};
          const payloadRecord = isObjectRecord(entry?.payload) ? entry.payload : {};
          const payloadLooksLocked = this.resultsAnalysisPayloadLooksLocked(payloadRecord);
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

  async recordResultsAnalysisQueueFailure(error) {
    const nowMs = Number(this.now()) || Date.now();
    const queued = await this.state.storage.get(RESULTS_ANALYSIS_AUTO_JOB_KEY);
    const record = this.normalizeResultsAnalysisRecord(await this.state.storage.get(RESULTS_ANALYSIS_RECORD_KEY));
    record.lastFailure = {
      ok: false,
      error: error?.message || toTrimmedString(error) || 'Automatic results analysis job failed.',
      status: 502,
      requestId: toTrimmedString(queued?.requestId),
      trigger: 'automatic',
      failedAtMs: nowMs,
    };
    await this.state.storage.delete(RESULTS_ANALYSIS_AUTO_JOB_KEY);
    await this.state.storage.put(RESULTS_ANALYSIS_RECORD_KEY, record);
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
        readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: await this.readResultsAnalysisStatus() }),
        reserveCoordinatedResultsAnalysis: async ({ reservation } = {}) => this.reserveResultsAnalysis(reservation || {}),
        finalizeCoordinatedResultsAnalysis: async ({ finalization } = {}) => this.finalizeResultsAnalysis(finalization || {}),
      },
    });
    if (result?.jobState === 'running') {
      await this.scheduleResultsAnalysisAlarm(RESULTS_ANALYSIS_RUNNING_LEASE_MS + 1_000);
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

  async reserveWorkerGroupSlot({ slug, sessionId, groupId, maxGroupsPerSession }) {
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
        ...prior,
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

  async beginWorkerGroupUpdate(groupId) {
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
        ...state,
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

  async beginWorkerGroupDelete(groupId) {
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

  async beginWorkerGroupMemberRemoval({ groupId, principalDigest }) {
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
        ...groupState,
        phase: 'deleted',
        active: false,
        memberCount: 0,
      });
    });
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
      const entries = await this.state.storage.list({ prefix: WORKER_GROUP_CAPACITY_GROUP_PREFIX });
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
      if (activeGroups.length !== Number(initialized.meta?.groupCount)) {
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
      if (mutation.operation === 'create') {
        groupReservation = await this.reserveWorkerGroupSlot({
          slug: mutation.slug,
          sessionId: mutation.sessionId,
          groupId: mutation.groupId,
          maxGroupsPerSession: caps.maxGroupsPerSession,
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
          updateReservation = await this.beginWorkerGroupUpdate(mutation.groupId);
          if (!updateReservation.ok) {
            return jsonResponse(updateReservation, updateReservation.status || 404);
          }
        } else if (mutation.operation === 'delete') {
          deleteReservation = await this.beginWorkerGroupDelete(mutation.groupId);
          if (!deleteReservation.ok) return jsonResponse(deleteReservation, deleteReservation.status || 404);
        }
      }
      if (mutation.operation === 'add-member' || mutation.operation === 'join') {
        principalDigest = await sha256Hex(`worker-group-member:${mutation.principalKey}`);
        memberReservation = await this.reserveWorkerGroupMemberSlot({
          groupId: mutation.groupId,
          principalDigest,
          maxMembersPerGroup: caps.maxMembersPerGroup,
        });
        if (!memberReservation.ok) {
          return jsonResponse(memberReservation, memberReservation.status || 409);
        }
      } else if (mutation.operation === 'remove-member') {
        principalDigest = await sha256Hex(`worker-group-member:${mutation.principalKey}`);
        removalReservation = await this.beginWorkerGroupMemberRemoval({
          groupId: mutation.groupId,
          principalDigest,
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
        // KV may have accepted a write before surfacing an error. Retain any
        // reservation so an ambiguous projection cannot create free capacity.
        return jsonResponse({
          ok: false,
          status: 503,
          reason: 'worker_group_mutation_ambiguous',
        }, 503);
      }

      if (!result.ok) {
        if (groupReservation?.reserved) {
          const definitelyPrewrite = new Set([
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
          if (definitelyPrewrite.has(result.reason)) {
            await this.rollbackWorkerGroupSlot({
              slug: mutation.slug,
              sessionId: mutation.sessionId,
              groupId: mutation.groupId,
            });
          }
        }
        if (updateReservation?.ok) {
          await this.rollbackWorkerGroupUpdate({
            groupId: mutation.groupId,
            prior: updateReservation.prior,
          });
        }
        if (deleteReservation?.ok) {
          await this.rollbackWorkerGroupDelete({
            groupId: mutation.groupId,
            prior: deleteReservation.prior,
          });
        }
        if (memberReservation?.reserved) {
          await this.rollbackWorkerGroupMemberSlot({
            groupId: mutation.groupId,
            memberKey: memberReservation.memberKey,
          });
        }
        if (removalReservation?.ok) {
          await this.rollbackWorkerGroupMemberRemoval({
            memberKey: removalReservation.memberKey,
          });
        }
        return jsonResponse(result, result.status || 400);
      }

      if (mutation.operation === 'create') {
        await this.activateWorkerGroupCapacity(result.group);
      } else if (mutation.operation === 'update') {
        await this.finalizeWorkerGroupUpdate({
          groupId: mutation.groupId,
          group: result.group,
        });
      } else if (mutation.operation === 'add-member' || mutation.operation === 'join') {
        if (memberReservation?.reserved) {
          await this.finalizeWorkerGroupMemberSlot(memberReservation.memberKey);
        }
      } else if (mutation.operation === 'remove-member') {
        await this.releaseWorkerGroupMemberSlot({
          groupId: mutation.groupId,
          memberKey: removalReservation.memberKey,
        });
      } else if (mutation.operation === 'delete') {
        await this.releaseWorkerGroupCapacity({
          slug: mutation.slug,
          sessionId: mutation.sessionId,
          groupId: mutation.groupId,
        });
      }
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
    });
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
          revision: Number(existing?.revision || 0) + 1,
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
      const baseConfig = slug ? normalizePublicSessionConfig(payload?.baseConfig, slug) : null;
      if (!slug || !baseConfig || !isObjectRecord(payload?.mutation)) {
        return jsonResponse({ error: 'Invalid session config mutation.' }, 400);
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

  async executeAuthNonceIssue(payload) {
    const nowMs = Number(this.now()) || Date.now();
    const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
    const address = toTrimmedString(payload?.address).toLowerCase();
    const nonce = toTrimmedString(payload?.nonce);
    const expiresAtMs = normalizeBoundedFutureTimestamp(
      payload?.expiresAtMs,
      nowMs,
      MAX_AUTH_NONCE_LIFETIME_MS,
    );
    const usedExpiresAtMs = normalizeBoundedFutureTimestamp(
      payload?.usedExpiresAtMs,
      nowMs,
      MAX_AUTH_NONCE_LIFETIME_MS,
    );
    if (!slug || !address || !nonce || nonce.length > 256 || !expiresAtMs || !usedExpiresAtMs) {
      return jsonResponse({ error: 'Invalid auth nonce issuance request.' }, 400);
    }

    await this.state.storage.transaction(async (transaction) => {
      const used = await transaction.get(AUTH_NONCE_USED_KEY);
      const entries = Array.isArray(used?.entries)
        ? used.entries.filter((entry) => Number(entry?.expiresAtMs || 0) > nowMs)
        : [];
      await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
      await transaction.put(AUTH_NONCE_ACTIVE_KEY, {
        version: 1,
        nonce,
        expiresAtMs,
      });
    });
    return jsonResponse({ ok: true });
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

    const result = await this.state.storage.transaction(async (transaction) => {
      const used = await transaction.get(AUTH_NONCE_USED_KEY);
      const entries = Array.isArray(used?.entries)
        ? used.entries.filter((entry) => Number(entry?.expiresAtMs || 0) > nowMs)
        : [];
      if (entries.some((entry) => toTrimmedString(entry?.nonce) === nonce)) {
        await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
        return { ok: false, error: 'Nonce already used.' };
      }

      const active = await transaction.get(AUTH_NONCE_ACTIVE_KEY);
      const activeMatches = (
        active?.nonce === nonce &&
        Number(active?.expiresAtMs || 0) > nowMs
      );
      if (!activeMatches) {
        if (Number(active?.expiresAtMs || 0) <= nowMs) {
          await transaction.delete(AUTH_NONCE_ACTIVE_KEY);
        }
        await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
        return { ok: false, error: 'Nonce mismatch or expired.' };
      }

      entries.push({ nonce, expiresAtMs: usedExpiresAtMs });
      await transaction.put(AUTH_NONCE_USED_KEY, { version: 1, entries });
      await transaction.delete(AUTH_NONCE_ACTIVE_KEY);
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
    if (url.pathname === '/session-config/storage-envelope-key/get-or-create') {
      return this.executeStorageEnvelopeKeyGetOrCreate(payload);
    }
    if (url.pathname === '/session-config/mutate') {
      return this.executeSessionConfigMutation(payload);
    }
    if (url.pathname === '/results-analysis/status') {
      return this.executeResultsAnalysisStatus();
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
