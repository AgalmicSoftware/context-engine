import {
  executeDeployHelperRequest,
  lookupCloudflareAccount,
  sha256Hex,
  stableCanonicalSerialize,
} from '../shared/deployHelperCore.mjs';
import { buildSafeSponsoredReceiptBody } from './sponsoredBootstrapGrantStore.js';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { getSessionConfig, putSessionConfig } from './sessionConfigSecretsStore.js';
import { validateInboundWorkerSessionSlug } from './sessionSlugResolution.js';

const SPONSORED_DEPLOY_RECORD_KEY = 'sponsored-deploy';
const DIRECT_DEPLOY_RECORD_KEY = 'direct-deploy';
const SPONSORED_FAUCET_RECORD_KEY = 'sponsored-faucet';
const RUNNING_LEASE_MS = 65_000;
const KV_SAME_KEY_WRITE_INTERVAL_MS = 1_050;

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const resolveCoordinatedSessionSlug = (rawSlug) => {
  if (typeof rawSlug !== 'string') return null;
  if (rawSlug !== '' && !rawSlug.trim()) return null;
  const result = validateInboundWorkerSessionSlug(rawSlug);
  if (!result.ok) return null;
  return {
    slug: result.slug,
    identitySlug: result.slug || 'general',
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
    this.getSessionConfig = deps.getSessionConfig || getSessionConfig;
    this.putSessionConfig = deps.putSessionConfig || putSessionConfig;
    this.applySessionConfigMutation = deps.applySessionConfigMutation || applySessionConfigMutation;
    this.sleep = deps.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.now = deps.now || Date.now;
    this.crypto = deps.crypto || globalThis.crypto;
    this.activeAttemptId = '';
    this.activeDirectAttemptId = '';
    this.configMutationTail = Promise.resolve();
    this.lastConfigWriteAtMs = 0;
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

  async waitForConfigWriteInterval() {
    const elapsedMs = (Number(this.now()) || Date.now()) - Number(this.lastConfigWriteAtMs || 0);
    const waitMs = Math.max(0, KV_SAME_KEY_WRITE_INTERVAL_MS - elapsedMs);
    if (waitMs) await this.sleep(waitMs);
  }

  async persistSessionConfigWithRetry({ slug, config }) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.putSessionConfig(this.env, slug, config);
        this.lastConfigWriteAtMs = Number(this.now()) || Date.now();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await this.sleep(KV_SAME_KEY_WRITE_INTERVAL_MS);
      }
    }
    throw lastError;
  }

  async executeSessionConfigMutation(payload) {
    const run = async () => {
      const slugResolution = resolveCoordinatedSessionSlug(payload?.slug);
      const mutation = payload?.mutation && typeof payload.mutation === 'object'
        ? payload.mutation
        : null;
      if (!slugResolution || !mutation) {
        return jsonResponse({ error: 'Invalid session config mutation request.' }, 400);
      }

      try {
        // Regression guard: queueing is not enough. Re-read KV inside every
        // critical section so runtime-managed fields never come from a stale DO snapshot.
        await this.waitForConfigWriteInterval();
        const existingConfig = await this.getSessionConfig(this.env, slugResolution.slug);
        const result = this.applySessionConfigMutation({
          existingConfig,
          mutation,
          slug: slugResolution.slug,
        });
        if (!result?.ok) {
          return jsonResponse(
            { error: result?.error || 'Session config mutation failed.' },
            result?.status || 400,
          );
        }
        if (!result.skipPersistence) {
          await this.persistSessionConfigWithRetry({
            slug: slugResolution.slug,
            config: result.config,
          });
        }
        return jsonResponse({ ok: true }, 200);
      } catch {
        return jsonResponse({
          error: 'Session config persistence is pending; retry the signed mutation.',
        }, 503);
      }
    };

    const queued = this.configMutationTail.then(run, run);
    this.configMutationTail = queued.catch(() => undefined);
    return queued;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Not found.' }, 404);
    }

    const payload = await request.json().catch(() => null);
    if (url.pathname === '/deploy-helper') return this.executeDirectDeploy(payload);
    if (url.pathname === '/session-config-mutation') return this.executeSessionConfigMutation(payload);
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

export const executeCoordinatedSessionConfigMutation = async ({
  env,
  slug,
  mutation,
} = {}) => {
  const slugResolution = resolveCoordinatedSessionSlug(slug);
  if (!slugResolution || !mutation || typeof mutation !== 'object') {
    return { ok: false, status: 400, body: { error: 'Invalid session config mutation.' } };
  }
  const stub = await resolveCoordinatorStub(
    env,
    `session-config:${slugResolution.identitySlug}`,
  );
  if (!stub) {
    return {
      ok: false,
      status: 503,
      body: { error: 'Session config coordination is unavailable; config was not changed.' },
    };
  }
  try {
    const response = await stub.fetch('https://session-coordinator.internal/session-config-mutation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slugResolution.slug, mutation }),
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await response.json().catch(() => ({})),
    };
  } catch {
    return {
      ok: false,
      status: 503,
      body: { error: 'Session config persistence is pending; retry the signed mutation.' },
    };
  }
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
