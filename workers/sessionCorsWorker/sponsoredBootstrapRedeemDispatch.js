import {
  deleteSponsoredGrantRecord,
  readSponsoredGrantRecord,
  SPONSORED_GRANT_TYPES,
  redactSponsoredSensitiveText,
  writeSponsoredGrantRedemptionReservation,
  writeSponsoredGrantReceipt,
} from './sponsoredBootstrapGrantStore.js';
import {
  normalizeEmbeddedDeployHelperEnabled,
  normalizeOrigin,
  sha256Hex,
  stableCanonicalSerialize,
} from '../shared/deployHelperCore.mjs';
import {
  executeCoordinatedSponsoredDeploy as executeCoordinatedSponsoredDeployBoundary,
} from './sessionWriteCoordinator.js';

const INVALID_GRANT_ERROR = 'Invalid, expired, or already used sponsored bootstrap grant.';

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const isExpiredGrant = (record = {}, nowMs = Date.now()) => {
  const expiresAt = toTrimmedString(record?.expiresAt);
  if (!expiresAt) return false;
  const expirationMs = Date.parse(expiresAt);
  if (!Number.isFinite(expirationMs)) return false;
  return expirationMs <= Number(nowMs || 0);
};

const readJsonRequestBody = async (request) => {
  try {
    return await request?.json?.();
  } catch {
    return null;
  }
};

const readReceiptResponse = async (response) => {
  if (response?.body && typeof response.body === 'object' && typeof response?.clone !== 'function') {
    return response;
  }
  if (typeof response?.clone === 'function') {
    const body = await response.clone().json().catch(() => ({}));
    return {
      status: Number(response.status || 0) || 200,
      body: body && typeof body === 'object' ? body : {},
    };
  }
  return { status: Number(response?.status || 0) || 200, body: {} };
};

const buildGrantErrorResponse = (deps, headers, status, error) => (
  deps?.json?.({ error }, status, headers)
);

const buildDeployExecutionFailure = (error) => ({
  ok: false,
  status: 502,
  body: {
    error: toTrimmedString(error?.message || error) || 'Failed to run embedded sponsored deploy.',
  },
});

const buildSponsoredRequestDigest = async (action, payload, requestOrigin = '') => sha256Hex(
  stableCanonicalSerialize({ action, payload, requestOrigin: normalizeOrigin(requestOrigin) }),
);

const buildSponsoredDeploymentRequestId = async (grantToken) => (
  `sponsored-${(await sha256Hex(`sponsored-deploy:${grantToken}`)).slice(0, 32)}`
);

const buildSponsoredConfigRevision = async (grantToken) => (
  `sponsored-revision-${(await sha256Hex(`sponsored-config:${grantToken}`)).slice(0, 32)}`
);

const SENSITIVE_FIELD_PATTERN = /(token|secret|password|privatekey|apikey|bundletext|arweavejwk)/i;

const collectSponsoredSensitiveValues = (value, parentSensitive = false, output = new Set()) => {
  if (typeof value === 'string') {
    if (parentSensitive && value.trim().length >= 4) output.add(value.trim());
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSponsoredSensitiveValues(entry, parentSensitive, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  Object.entries(value).forEach(([key, entry]) => {
    collectSponsoredSensitiveValues(
      entry,
      parentSensitive || SENSITIVE_FIELD_PATTERN.test(key.replace(/[^a-z0-9]/gi, '')),
      output,
    );
  });
  return output;
};

const buildSponsoredSensitiveValues = ({ body, grantRecord, effectiveDeployPayload } = {}) => Array.from(
  collectSponsoredSensitiveValues({ body, grantRecord, effectiveDeployPayload }),
);

const redactSponsoredDeployFailure = (result, sensitiveValues = []) => ({
  ...result,
  body: result?.body && typeof result.body === 'object'
    ? {
        ...result.body,
        ...(typeof result.body.error === 'string'
          ? { error: redactSponsoredSensitiveText(result.body.error, sensitiveValues) }
          : {}),
      }
    : result?.body,
});

const resolveSponsoredRedemptionReplay = ({ grantRecord, requestDigest, deps, headers } = {}) => {
  if (grantRecord?.state !== 'redeemed' && grantRecord?.state !== 'redeeming') return null;
  if (toTrimmedString(grantRecord?.requestDigest) !== requestDigest) {
    return buildGrantErrorResponse(
      deps,
      headers,
      409,
      'Sponsored grant was already reserved or redeemed with a different request payload.',
    );
  }
  if (grantRecord.state === 'redeeming') {
    return buildGrantErrorResponse(
      deps,
      headers,
      503,
      'Sponsored grant redemption is pending; the action will not be repeated.',
    );
  }
  const receipt = grantRecord?.receipt && typeof grantRecord.receipt === 'object'
    ? grantRecord.receipt
    : {};
  return deps?.json?.(
    receipt?.body && typeof receipt.body === 'object' ? receipt.body : {},
    Number(receipt?.status || 0) || 200,
    headers,
  );
};

export const dispatchSponsoredBootstrapRedeem = async ({
  request,
  env,
  baseHeaders,
  action,
  deps,
} = {}) => {
  const body = await readJsonRequestBody(request);
  if (!body || typeof body !== 'object') {
    return buildGrantErrorResponse(deps, baseHeaders, 400, 'Invalid JSON.');
  }

  const tokenField = action === 'deploy' ? 'deployGrantToken' : 'faucetGrantToken';
  const expectedGrantType = action === 'deploy'
    ? SPONSORED_GRANT_TYPES.deploy
    : SPONSORED_GRANT_TYPES.faucet;
  const grantToken = toTrimmedString(body?.[tokenField]);
  if (!grantToken) {
    return buildGrantErrorResponse(deps, baseHeaders, 400, `Missing ${tokenField}.`);
  }

  const grantRecord = await readSponsoredGrantRecord(env, grantToken);
  if (!grantRecord || grantRecord.type !== expectedGrantType || isExpiredGrant(grantRecord, deps?.now?.() ?? Date.now())) {
    if (grantRecord && isExpiredGrant(grantRecord, deps?.now?.() ?? Date.now())) {
      await deleteSponsoredGrantRecord(env, grantToken);
    }
    return buildGrantErrorResponse(deps, baseHeaders, 404, INVALID_GRANT_ERROR);
  }

  const sourceConfig = (
    grantRecord?.sourceConfig &&
    typeof grantRecord.sourceConfig === 'object'
  ) ? grantRecord.sourceConfig : {};
  const corsContext = await deps?.getCorsContext?.({ request, config: sourceConfig });
  if (!corsContext?.ok) {
    return corsContext?.response;
  }
  const headers = corsContext.headers;

  if (action === 'deploy') {
    const deployPayload = (
      body?.deployPayload &&
      typeof body.deployPayload === 'object'
    ) ? body.deployPayload : null;
    if (!deployPayload) {
      return buildGrantErrorResponse(deps, headers, 400, 'Missing deployPayload.');
    }
    const embeddedDeployHelperEnabled = normalizeEmbeddedDeployHelperEnabled(
      env?.DEPLOY_HELPER_ENABLED,
      true
    );

    let embeddedResult = null;
    if (!embeddedDeployHelperEnabled) {
      return buildGrantErrorResponse(
        deps,
        headers,
        400,
        'Embedded sponsored deploy is disabled on this worker.',
      );
    }

    // A grant chooses credentials, not an account. The deploy helper must
    // derive the sponsor token's one visible account itself.
    const {
      accountId: _discardedAccountId,
      deploymentRequestId: _discardedDeploymentRequestId,
      configRevision: _discardedConfigRevision,
      ...accountIndependentDeployPayload
    } = deployPayload;
    // Regression guard: the one-shot grant, not a page-lifetime hook ref,
    // owns both deploy identities so reload retries converge on one resource set.
    const deploymentRequestId = await buildSponsoredDeploymentRequestId(grantToken);
    const configRevision = await buildSponsoredConfigRevision(grantToken);
    const effectiveDeployPayload = {
      ...accountIndependentDeployPayload,
      deploymentRequestId,
      configRevision,
    };
    const sensitiveValues = buildSponsoredSensitiveValues({
      body,
      grantRecord,
      effectiveDeployPayload,
    });
    const requestOrigin = normalizeOrigin(request?.headers?.get?.('Origin') || '');
    const requestDigest = await buildSponsoredRequestDigest(
      'deploy',
      effectiveDeployPayload,
      requestOrigin,
    );
    const replayResponse = resolveSponsoredRedemptionReplay({
      grantRecord,
      requestDigest,
      deps,
      headers,
    });
    if (replayResponse) return replayResponse;

    try {
      const executeCoordinatedSponsoredDeploy = (
        deps?.executeCoordinatedSponsoredDeploy || executeCoordinatedSponsoredDeployBoundary
      );
      embeddedResult = await executeCoordinatedSponsoredDeploy({
        env,
        grantToken,
        requestDigest,
        deployBody: {
          ...effectiveDeployPayload,
          apiToken: toTrimmedString(grantRecord?.cloudflareApiToken),
        },
        requestOrigin,
        sensitiveValues,
      });
    } catch (error) {
      embeddedResult = buildDeployExecutionFailure(error);
    }

    if (embeddedResult?.body?.sponsoredGrantPayloadConflict === true) {
      return deps?.json?.(embeddedResult.body, embeddedResult.status || 409, headers);
    }

    if (embeddedResult?.ok || embeddedResult?.body?.deploymentRequestTerminal === true) {
      const receipt = await writeSponsoredGrantReceipt({
        env,
        token: grantToken,
        grantRecord,
        requestDigest,
        response: embeddedResult,
        sensitiveValues,
        nowMs: deps?.now?.() ?? Date.now(),
      });
      return deps?.json?.(receipt.body, receipt.status, headers);
    }

    const safeEmbeddedResult = redactSponsoredDeployFailure(embeddedResult, sensitiveValues);
    return deps?.json?.(
      safeEmbeddedResult?.body && Object.keys(safeEmbeddedResult.body).length
        ? safeEmbeddedResult.body
        : { error: `Worker deploy failed (${embeddedResult?.status || 502}).` },
      embeddedResult?.status || 502,
      headers,
    );
  }

  const recipientAddress = toTrimmedString(body?.to || body?.recipient || body?.address);
  if (!recipientAddress) {
    return buildGrantErrorResponse(deps, headers, 400, 'Missing address.');
  }
  const requestDigest = await buildSponsoredRequestDigest('faucet', {
    recipientAddress: recipientAddress.toLowerCase(),
  });
  const replayResponse = resolveSponsoredRedemptionReplay({
    grantRecord,
    requestDigest,
    deps,
    headers,
  });
  if (replayResponse) return replayResponse;

  // Regression guard: reserve the one-shot grant without its private key
  // before the non-idempotent transfer. An uncertain receipt write must never
  // authorize a second transaction.
  await writeSponsoredGrantRedemptionReservation({
    env,
    token: grantToken,
    grantRecord,
    requestDigest,
    nowMs: deps?.now?.() ?? Date.now(),
  });

  let faucetResponse;
  try {
    faucetResponse = await deps?.faucet?.({
      payload: {
        action: 'request_test_eth',
        to: recipientAddress,
      },
      secrets: {
        faucetPrivateKey: toTrimmedString(grantRecord?.faucetPrivateKey),
      },
      config: sourceConfig,
      baseHeaders: headers,
      slug: toTrimmedString(grantRecord?.sourceSessionSlug),
      requesterAddress: recipientAddress,
      tokenHasFaucetScope: true,
    });
  } catch (error) {
    return buildGrantErrorResponse(
      deps,
      headers,
      502,
      toTrimmedString(error?.message || error) || 'Failed to redeem sponsored faucet grant.',
    );
  }

  if (Number(faucetResponse?.status || 0) < 200 || Number(faucetResponse?.status || 0) >= 300) {
    return faucetResponse;
  }

  const receiptResponse = await readReceiptResponse(faucetResponse);
  const receipt = await writeSponsoredGrantReceipt({
    env,
    token: grantToken,
    grantRecord,
    requestDigest,
    response: receiptResponse,
    nowMs: deps?.now?.() ?? Date.now(),
  });
  return deps?.json?.(receipt.body, receipt.status, headers);
};
