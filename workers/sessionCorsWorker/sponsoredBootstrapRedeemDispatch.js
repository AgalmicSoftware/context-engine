import {
  deleteSponsoredGrantRecord,
  readSponsoredGrantRecord,
  SPONSORED_GRANT_TYPES,
} from './sponsoredBootstrapGrantStore.js';
import {
  executeDeployHelperRequest as executeDeployHelperRequestBoundary,
  normalizeEmbeddedDeployHelperEnabled,
} from '../shared/deployHelperCore.mjs';

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
    const executeDeployHelperRequest = (
      deps?.executeDeployHelperRequest || executeDeployHelperRequestBoundary
    );
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

    try {
      embeddedResult = await executeDeployHelperRequest({
        body: {
          ...deployPayload,
          apiToken: toTrimmedString(grantRecord?.cloudflareApiToken),
        },
        env,
        requestOrigin: request?.headers?.get?.('Origin') || '',
        consoleImpl: deps?.console || console,
      });
    } catch (error) {
      embeddedResult = buildDeployExecutionFailure(error);
    }

    if (embeddedResult?.ok) {
      await deleteSponsoredGrantRecord(env, grantToken);
      return deps?.json?.(embeddedResult.body, embeddedResult.status || 200, headers);
    }

    return deps?.json?.(
      embeddedResult?.body && Object.keys(embeddedResult.body).length
        ? embeddedResult.body
        : { error: `Worker deploy failed (${embeddedResult?.status || 502}).` },
      embeddedResult?.status || 502,
      headers,
    );
  }

  const recipientAddress = toTrimmedString(body?.to || body?.recipient || body?.address);
  if (!recipientAddress) {
    return buildGrantErrorResponse(deps, headers, 400, 'Missing address.');
  }

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

  await deleteSponsoredGrantRecord(env, grantToken);
  return faucetResponse;
};
