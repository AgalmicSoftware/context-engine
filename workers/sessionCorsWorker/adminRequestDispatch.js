import {
  resolveAdminRequestAuthority,
} from './adminRequestAuthority.js';
import {
  readLitPayerStatus,
} from './litPaymentDelegation.js';
import {
  buildSponsoredGrantToken,
  computeSponsoredGrantExpirationTtl,
  SPONSORED_GRANT_TYPES,
  writeSponsoredGrantRecord,
} from './sponsoredBootstrapGrantStore.js';
import {
  normalizeEmbeddedDeployHelperEnabled,
} from '../shared/deployHelperCore.mjs';

const ALLOWED_SECRET_KEYS = [
  'openaiKey',
  'anthropicKey',
  'openrouterKey',
  'customRpcUrl',
  'customRpcKey',
  'arweaveJwk',
  'faucetPrivateKey',
  'litPayerPrivateKey',
  'litPayerAddress',
];

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

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
  if (!authorityResult?.ok) return authorityResult?.response;

  const {
    existingConfig,
    headers,
    targetSlug,
  } = authorityResult;

  if (action === 'set-config') {
    const incoming = buildSetConfigIncomingConfig({
      existingConfig,
      body,
      deps,
    });
    if (!incoming) return deps?.json?.({ error: 'Missing config.' }, 400, headers);

    const merged = deps?.mergeWorkerConfigRecords?.({
      existingConfig,
      incomingConfig: incoming,
      slug: targetSlug,
    });
    await deps?.putSessionConfig?.(env, targetSlug, merged);
    return deps?.json?.({ ok: true }, 200, headers);
  }

  if (action === 'set-secrets') {
    const incoming = body?.secrets && typeof body.secrets === 'object' ? body.secrets : null;
    if (!incoming) return deps?.json?.({ error: 'Missing secrets.' }, 400, headers);

    const nextSecrets = { ...((await deps?.getSessionSecrets?.(env, targetSlug)) || {}) };
    ALLOWED_SECRET_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(incoming, key)) {
        const value = deps?.normalizeSecretValue?.(incoming[key]);
        if (value !== undefined) nextSecrets[key] = value;
      }
    });
    await deps?.putSessionSecrets?.(env, targetSlug, nextSecrets);
    return deps?.json?.({ ok: true }, 200, headers);
  }

  if (action === 'lit-status') {
    const existingSecrets = { ...((await deps?.getSessionSecrets?.(env, targetSlug)) || {}) };
    const providedPrivateKey = deps?.normalizeSecretValue?.(body?.litPayerPrivateKey);
    const litPayerPrivateKey = providedPrivateKey || existingSecrets.litPayerPrivateKey || '';
    if (!litPayerPrivateKey) {
      return deps?.json?.({ error: 'Lit payer key not configured.' }, 404, headers);
    }
    try {
      const status = await (deps?.readLitPayerStatus || readLitPayerStatus)({
        litNetwork: body?.litNetwork || existingConfig?.lit?.network || existingConfig?.litNetwork || 'naga-dev',
        litPayerPrivateKey,
      });
      return deps?.json?.({ ok: true, ...status }, 200, headers);
    } catch (error) {
      return deps?.json?.({ error: error?.message || 'Failed to read Lit payer status.' }, 502, headers);
    }
  }

  if (action === 'set-limits') {
    const incoming = body?.limits && typeof body.limits === 'object' ? body.limits : null;
    if (!incoming) return deps?.json?.({ error: 'Missing limits.' }, 400, headers);

    const merged = deps?.mergeWorkerLimitRecords?.({
      existingConfig,
      incomingLimits: incoming,
      slug: targetSlug,
    });
    await deps?.putSessionConfig?.(env, targetSlug, merged);
    return deps?.json?.({ ok: true }, 200, headers);
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
