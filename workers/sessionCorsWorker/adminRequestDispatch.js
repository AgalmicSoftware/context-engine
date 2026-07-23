import {
  resolveAdminRequestAuthority,
} from './adminRequestAuthority.js';
import {
  bootstrapLitChipotleSession,
  provisionLitChipotleAction,
  readLitChipotleStatus,
  resolveLitChipotleProvisioningRuntime,
  resolveLitChipotleRuntime,
} from './chipotleClient.js';
import {
  buildSponsoredGrantToken,
  computeSponsoredGrantExpirationTtl,
  SPONSORED_GRANT_TYPES,
  writeSponsoredGrantRecord,
} from './sponsoredBootstrapGrantStore.js';
import {
  normalizeEmbeddedDeployHelperEnabled,
} from '../shared/deployHelperCore.mjs';
import {
  exportCloudflareEncryptedPayloadEnvelopes,
} from './storageRouteExecution.js';
import {
  dispatchAdminWorkerGroupRequest,
} from './workerGroups.js';
import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent as recordAbuseEventBoundary,
} from './abuseObservability.js';
import {
  findForbiddenCloudflareDeploymentTokenPath,
  findForbiddenWorkerConfigSecretPath,
} from '../shared/workerSessionConfig.mjs';
import { executeCoordinatedSessionConfigMutation } from './sessionWriteCoordinator.js';

const ALLOWED_SECRET_KEYS = [
  'openaiKey',
  'anthropicKey',
  'openrouterKey',
  'customRpcUrl',
  'customRpcKey',
  'arweaveJwk',
  'faucetPrivateKey',
  'litAccountApiKey',
  'litUsageApiKey',
];

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const recordAuthFailure = async ({ env, deps } = {}) => {
  try {
    await (deps?.recordAbuseEvent || recordAbuseEventBoundary)({
      env,
      type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
      now: deps?.now,
    });
  } catch {
    // Admin auth telemetry must not alter the original failure response.
  }
};

const buildSecretPresenceManifest = (secrets) => {
  const source = secrets && typeof secrets === 'object' ? secrets : {};
  return ALLOWED_SECRET_KEYS.reduce((acc, key) => {
    acc[key] = !!toTrimmedString(source[key]);
    return acc;
  }, {});
};

const buildSetConfigIncomingConfig = ({
  existingConfig,
  body,
  deps,
} = {}) => {
  const incoming = body?.config && typeof body.config === 'object' ? body.config : null;
  if (!incoming) return null;

  const nextIncoming = { ...incoming };
  const hasIncomingAdminAddress = !!toTrimmedString(nextIncoming.adminAddress);
  if (!existingConfig && !hasIncomingAdminAddress) {
    const requestedAdminAddress = toTrimmedString(body?.adminAddress);
    if (requestedAdminAddress && deps?.isAddress?.(requestedAdminAddress)) {
      // Preserve bootstrap behavior for the first worker config write without
      // forcing later UI edits to keep resending adminAddress in config patches.
      nextIncoming.adminAddress = requestedAdminAddress;
    }
  }

  return nextIncoming;
};

const mergeAdminSecrets = ({
  existingSecrets,
  incomingSecrets,
  deps,
} = {}) => {
  const nextSecrets = { ...((existingSecrets && typeof existingSecrets === 'object') ? existingSecrets : {}) };
  const normalizedIncoming = incomingSecrets && typeof incomingSecrets === 'object' ? incomingSecrets : {};
  ALLOWED_SECRET_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(normalizedIncoming, key)) return;
    const value = deps?.normalizeSecretValue?.(normalizedIncoming[key]);
    if (value !== undefined) nextSecrets[key] = value;
  });
  return nextSecrets;
};

const executeDirectSessionConfigMutation = async ({
  env,
  slug,
  existingConfig,
  mutation,
  deps,
} = {}) => {
  const coordinate = deps?.executeCoordinatedSessionConfigMutation ||
    executeCoordinatedSessionConfigMutation;
  return coordinate({ env, slug, existingConfig, mutation });
};

export const dispatchAdminRequest = async ({
  request,
  env,
  baseHeaders,
  slug,
  action,
  deps,
} = {}) => {
  let body;
  try {
    body = await request?.json?.();
  } catch {
    return deps?.json?.({ error: 'Invalid JSON.' }, 400, baseHeaders);
  }

  const authorityResult = await (
    deps?.resolveAdminRequestAuthority || resolveAdminRequestAuthority
  )({
    env,
    request,
    body,
    slugHint: slug,
    action,
    baseHeaders,
    deps: {
      json: deps?.json,
      normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
      resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
      isAddress: deps?.isAddress,
      resolveExistingSessionCors: deps?.resolveExistingSessionCors,
      verifyMessage: deps?.verifyMessage,
      validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: deps?.parseSiweMessage,
      validateSiwe: deps?.validateSiwe,
      validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
      consumeNonce: deps?.consumeNonce,
      validateBootstrapAdmin: deps?.validateBootstrapAdmin,
      validateAdmin: deps?.validateAdmin,
      MISSING_SLUG_ERROR: deps?.MISSING_SLUG_ERROR,
    },
  });
  if (!authorityResult?.ok) {
    await recordAuthFailure({ env, deps });
    return authorityResult?.response;
  }

  const {
    existingConfig,
    headers,
    targetSlug,
  } = authorityResult;

  if (action?.startsWith?.('groups/')) {
    const response = await (deps?.dispatchAdminWorkerGroupRequest || dispatchAdminWorkerGroupRequest)({
      action,
      body,
      config: existingConfig,
      env,
      slug: targetSlug,
      adminAddress: authorityResult.address || body?.address,
      headers,
      deps: {
        json: deps?.json,
        isAddress: deps?.isAddress,
        getAddress: deps?.getAddress,
        now: deps?.now,
        randomUUID: deps?.randomUUID,
        getRandomValues: deps?.getRandomValues,
        executeCoordinatedWorkerGroupMutation: deps?.executeCoordinatedWorkerGroupMutation,
      },
    });
    if (response) return response;
  }

  if (action === 'set-config') {
    const incoming = buildSetConfigIncomingConfig({
      existingConfig,
      body,
      deps,
    });
    if (!incoming) return deps?.json?.({ error: 'Missing config.' }, 400, headers);
    if (findForbiddenCloudflareDeploymentTokenPath(incoming)) {
      return deps?.json?.({
        error: 'Cloudflare deployment tokens are not allowed in session config.',
      }, 400, headers);
    }
    if (findForbiddenWorkerConfigSecretPath(incoming)) {
      return deps?.json?.({
        error: 'Secret-like values are not allowed in public session config fields.',
      }, 400, headers);
    }

    const mutationResult = await executeDirectSessionConfigMutation({
      env,
      slug: targetSlug,
      existingConfig,
      mutation: { kind: 'set-config', incomingConfig: incoming },
      deps,
    });
    return deps?.json?.(
      mutationResult?.body || { error: 'Session config mutation failed.' },
      mutationResult?.status || 503,
      headers,
    );
  }

  if (action === 'set-secrets') {
    const incoming = body?.secrets && typeof body.secrets === 'object' ? body.secrets : null;
    if (!incoming) return deps?.json?.({ error: 'Missing secrets.' }, 400, headers);

    const nextSecrets = mergeAdminSecrets({
      existingSecrets: (await deps?.getSessionSecrets?.(env, targetSlug)) || {},
      incomingSecrets: incoming,
      deps,
    });
    await deps?.putSessionSecrets?.(env, targetSlug, nextSecrets);
    return deps?.json?.({ ok: true }, 200, headers);
  }

  if (action === 'secret-presence') {
    const existingSecrets = (await deps?.getSessionSecrets?.(env, targetSlug)) || {};
    return deps?.json?.({
      ok: true,
      sessionSlug: targetSlug,
      secrets: buildSecretPresenceManifest(existingSecrets),
    }, 200, headers);
  }

  if (action === 'lit-chipotle-status') {
    try {
      const existingSecrets = { ...((await deps?.getSessionSecrets?.(env, targetSlug)) || {}) };
      const runtime = (deps?.resolveLitChipotleRuntime || resolveLitChipotleRuntime)({
        env,
        config: existingConfig,
        secrets: existingSecrets,
        body,
      });
      const status = await (deps?.readLitChipotleStatus || readLitChipotleStatus)({
        runtime,
        fetchImpl: deps?.fetchImpl,
      });
      return deps?.json?.(status, 200, headers);
    } catch (error) {
      return deps?.json?.({ error: error?.message || 'Failed to read Lit Chipotle status.' }, 502, headers);
    }
  }

  if (action === 'lit-chipotle-provision') {
    try {
      const existingSecrets = { ...((await deps?.getSessionSecrets?.(env, targetSlug)) || {}) };
      const runtime = (deps?.resolveLitChipotleProvisioningRuntime || resolveLitChipotleProvisioningRuntime)({
        env,
        config: existingConfig,
        secrets: existingSecrets,
        body,
      });
      const result = await (deps?.provisionLitChipotleAction || provisionLitChipotleAction)({
        runtime,
        request: body,
        fetchImpl: deps?.fetchImpl,
      });
      const litCredentials = (
        result?.litActionCid ||
        result?.litGroupId ||
        result?.litPkpId
      ) ? {
        ...((existingConfig?.litCredentials && typeof existingConfig.litCredentials === 'object')
          ? existingConfig.litCredentials
          : {}),
        ...(result?.apiBase ? { litApiBase: result.apiBase } : {}),
        ...(result?.litActionCid ? { litActionCid: result.litActionCid } : {}),
        ...(result?.litGroupId ? { litGroupId: result.litGroupId } : {}),
        ...(result?.litPkpId ? { litPkpId: result.litPkpId } : {}),
      } : null;
      if (litCredentials) {
        const mutationResult = await executeDirectSessionConfigMutation({
          env,
          slug: targetSlug,
          existingConfig,
          mutation: { kind: 'merge-lit-credentials', litCredentials },
          deps,
        });
        if (!mutationResult?.ok) {
          return deps?.json?.(
            mutationResult?.body || { error: 'Session config mutation failed.' },
            mutationResult?.status || 503,
            headers,
          );
        }
      }
      return deps?.json?.(result, 200, headers);
    } catch (error) {
      return deps?.json?.({ error: error?.message || 'Failed to provision Lit Chipotle action.' }, 502, headers);
    }
  }

  if (action === 'lit-chipotle-bootstrap-session') {
    try {
      const existingSecrets = { ...((await deps?.getSessionSecrets?.(env, targetSlug)) || {}) };
      const result = await (deps?.bootstrapLitChipotleSession || bootstrapLitChipotleSession)({
        env,
        config: existingConfig,
        secrets: existingSecrets,
        request: body,
        sessionSlug: targetSlug,
        fetchImpl: deps?.fetchImpl,
      });
      const nextSecrets = mergeAdminSecrets({
        existingSecrets,
        incomingSecrets: result?.secretOutputs,
        deps,
      });
      if (Object.keys(nextSecrets).length) {
        await deps?.putSessionSecrets?.(env, targetSlug, nextSecrets);
      }
      const litCredentials = (
        result?.litCredentials &&
        typeof result.litCredentials === 'object'
      ) ? result.litCredentials : null;
      if (litCredentials) {
        const mutationResult = await executeDirectSessionConfigMutation({
          env,
          slug: targetSlug,
          existingConfig,
          mutation: { kind: 'merge-lit-credentials', litCredentials },
          deps,
        });
        if (!mutationResult?.ok) {
          return deps?.json?.(
            mutationResult?.body || { error: 'Session config mutation failed.' },
            mutationResult?.status || 503,
            headers,
          );
        }
      }
      const responseBody = { ...result };
      delete responseBody.secretOutputs;
      delete responseBody.litCredentials;
      return deps?.json?.(responseBody, 200, headers);
    } catch (error) {
      return deps?.json?.({ error: error?.message || 'Failed to bootstrap a Lit session account.' }, 502, headers);
    }
  }

  if (action === 'set-limits') {
    const incoming = body?.limits && typeof body.limits === 'object' ? body.limits : null;
    if (!incoming) return deps?.json?.({ error: 'Missing limits.' }, 400, headers);

    const mutationResult = await executeDirectSessionConfigMutation({
      env,
      slug: targetSlug,
      existingConfig,
      mutation: { kind: 'set-limits', incomingLimits: incoming },
      deps,
    });
    return deps?.json?.(
      mutationResult?.body || { error: 'Session config mutation failed.' },
      mutationResult?.status || 503,
      headers,
    );
  }

  if (action === 'export-storage-envelopes') {
    try {
      const result = await (deps?.exportCloudflareEncryptedPayloadEnvelopes || exportCloudflareEncryptedPayloadEnvelopes)({
        env,
        slug: targetSlug,
        config: existingConfig,
        resource: toTrimmedString(body?.resource),
        includeSessionEnvelope: true,
        deps: {
          now: deps?.now,
        },
      });
      return deps?.json?.(
        result?.ok ? result : { error: result?.error || 'Encrypted-envelope export failed.' },
        result?.ok ? 200 : (result?.status || 500),
        headers,
      );
    } catch (error) {
      return deps?.json?.({ error: error?.message || 'Encrypted-envelope export failed.' }, 500, headers);
    }
  }

  if (action === 'issue-sponsored-grants') {
    const grantRequest = body?.grantRequest && typeof body.grantRequest === 'object'
      ? body.grantRequest
      : null;
    if (!grantRequest) {
      return deps?.json?.({ error: 'Missing grantRequest.' }, 400, headers);
    }

    const deployRequest = grantRequest?.deploy && typeof grantRequest.deploy === 'object'
      ? grantRequest.deploy
      : {};
    const faucetRequest = grantRequest?.faucet && typeof grantRequest.faucet === 'object'
      ? grantRequest.faucet
      : {};
    const cloudflareApiToken = toTrimmedString(deployRequest.cloudflareApiToken);
    const faucetPrivateKey = typeof deps?.normalizeSecretValue === 'function'
      ? deps.normalizeSecretValue(faucetRequest.faucetPrivateKey)
      : toTrimmedString(faucetRequest.faucetPrivateKey);
    const bootstrapWorkerUrl = toTrimmedString(
      grantRequest.bootstrapWorkerUrl || existingConfig?.corsWorkerUrl || ''
    );
    const expiresAt = toTrimmedString(grantRequest.expiresAt);
    const embeddedDeployHelperEnabled = normalizeEmbeddedDeployHelperEnabled(
      env?.DEPLOY_HELPER_ENABLED,
      true
    );

    if (!cloudflareApiToken && !toTrimmedString(faucetPrivateKey)) {
      return deps?.json?.(
        { error: 'At least one sponsored deploy or faucet credential is required.' },
        400,
        headers,
      );
    }
    if (cloudflareApiToken && !embeddedDeployHelperEnabled) {
      return deps?.json?.(
        { error: 'Deploy grants require embedded deploy-helper to be enabled on the sponsoring worker.' },
        400,
        headers,
      );
    }

    let ttlSeconds = null;
    try {
      ttlSeconds = computeSponsoredGrantExpirationTtl(expiresAt, deps?.now?.() ?? Date.now());
    } catch (error) {
      return deps?.json?.({ error: error?.message || 'Invalid sponsored grant expiry.' }, 400, headers);
    }

    const sourceConfig = (
      existingConfig &&
      typeof existingConfig === 'object'
    ) ? { ...existingConfig } : {};
    delete sourceConfig.embeddedDeployHelperEnabled;
    delete sourceConfig.deployHelperEnabled;
    const issuedAt = new Date(deps?.now?.() ?? Date.now()).toISOString();

    try {
      let deployGrantToken = '';
      if (cloudflareApiToken) {
        deployGrantToken = buildSponsoredGrantToken();
        await writeSponsoredGrantRecord(
          env,
          deployGrantToken,
          {
            type: SPONSORED_GRANT_TYPES.deploy,
            sourceSessionSlug: targetSlug,
            sourceConfig,
            cloudflareApiToken,
            issuedAt,
            expiresAt,
          },
          ttlSeconds,
        );
      }

      let faucetGrantToken = '';
      if (toTrimmedString(faucetPrivateKey)) {
        faucetGrantToken = buildSponsoredGrantToken();
        await writeSponsoredGrantRecord(
          env,
          faucetGrantToken,
          {
            type: SPONSORED_GRANT_TYPES.faucet,
            sourceSessionSlug: targetSlug,
            sourceConfig,
            faucetPrivateKey: toTrimmedString(faucetPrivateKey),
            issuedAt,
            expiresAt,
          },
          ttlSeconds,
        );
      }

      return deps?.json?.({
        ok: true,
        deployGrantToken,
        faucetGrantToken,
        bootstrapWorkerUrl,
        expiresAt,
      }, 200, headers);
    } catch (error) {
      return deps?.json?.(
        { error: error?.message || 'Failed to issue sponsored bootstrap grants.' },
        500,
        headers,
      );
    }
  }

  return deps?.json?.({ error: 'Unknown admin action.' }, 400, headers);
};
