import {
  executeDeployHelperRequest,
  lookupCloudflareAccount,
  sha256Hex,
  stableCanonicalSerialize,
} from '../shared/deployHelperCore.mjs';
import { buildSafeSponsoredReceiptBody } from './sponsoredBootstrapGrantStore.js';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { normalizeWorkerConfigRecord } from './sessionConfigNormalization.js';
import { putSessionConfig } from './sessionConfigSecretsStore.js';
import {
  normalizeWorkerSessionSlug,
  validateInboundWorkerSessionSlug,
} from './sessionSlugResolution.js';
import {
  findForbiddenCloudflareDeploymentTokenPath,
  findForbiddenWorkerConfigSecretPath,
} from '../shared/workerSessionConfig.mjs';

const SPONSORED_DEPLOY_RECORD_KEY = 'sponsored-deploy';
const DIRECT_DEPLOY_RECORD_KEY = 'direct-deploy';
const SPONSORED_FAUCET_RECORD_KEY = 'sponsored-faucet';
const SESSION_CONFIG_AUTHORITY_KEY = 'session-config-authority';
const AUTH_NONCE_ACTIVE_KEY = 'auth-nonce-active';
const AUTH_NONCE_USED_KEY = 'auth-nonce-used';
const AUTH_RATE_RECORD_KEY = 'auth-rate-record';
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

const normalizePositiveSafeInteger = (value) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
};

const normalizeBoundedFutureTimestamp = (value, nowMs, maxAheadMs) => {
  const numeric = normalizePositiveSafeInteger(value);
  if (!numeric || numeric <= nowMs || numeric > nowMs + maxAheadMs) return 0;
  return numeric;
};

const normalizeSessionSlug = (value) => {
  if (value == null) return '';
  const result = validateInboundWorkerSessionSlug(value);
  if (!result?.ok) return '';
  return result.slug || 'general';
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
    this.activeAttemptId = '';
    this.activeDirectAttemptId = '';
    this.sessionConfigTail = Promise.resolve();
  }

  serializeSessionConfigOperation(operation) {
    const run = this.sessionConfigTail.then(operation);
    this.sessionConfigTail = run.catch(() => undefined);
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
    const authority = await this.state.storage.get(SESSION_CONFIG_AUTHORITY_KEY);
    if (authority?.projectionPending !== true) return;
    await this.projectSessionConfigAuthority(authority);
  }

  async executeStorageEnvelopeKeyGetOrCreate(payload) {
    return this.serializeSessionConfigOperation(async () => {
      const slug = normalizeSessionSlug(payload?.slug);
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
        if (existing && normalizeSessionSlug(existing.slug) !== slug) {
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
      const slug = normalizeSessionSlug(payload?.slug);
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
        if (existing && normalizeSessionSlug(existing.slug) !== slug) {
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
    const slug = normalizeSessionSlug(payload?.slug);
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
    const slug = normalizeSessionSlug(payload?.slug);
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
    const slug = normalizeSessionSlug(payload?.slug);
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
    if (url.pathname === '/auth-state/nonce/issue') {
      return this.executeAuthNonceIssue(payload);
    }
    if (url.pathname === '/auth-state/nonce/consume') {
      return this.executeAuthNonceConsume(payload);
    }
    if (url.pathname === '/auth-state/rate/check') {
      return this.executeAuthRateCheck(payload);
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
  const normalizedSlug = normalizeSessionSlug(slug);
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
  const normalizedSlug = normalizeSessionSlug(slug);
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
