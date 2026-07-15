import { getKvJson, putKvJson } from './responseKvHelpers.js';

const DEFAULT_TOKEN_BYTE_LENGTH = 24;

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

export const SPONSORED_GRANT_TYPES = Object.freeze({
  deploy: 'deploy-worker',
  faucet: 'faucet-tx',
});

export const buildSponsoredGrantKvKey = (token = '') => (
  `sponsoredGrant:${toTrimmedString(token)}`
);

export const buildSponsoredGrantToken = ({
  byteLength = DEFAULT_TOKEN_BYTE_LENGTH,
  cryptoImpl = globalThis.crypto,
} = {}) => {
  if (!cryptoImpl?.getRandomValues) {
    throw new Error('Secure random generator unavailable.');
  }
  const bytes = new Uint8Array(Number(byteLength || 0) || DEFAULT_TOKEN_BYTE_LENGTH);
  cryptoImpl.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

export const computeSponsoredGrantExpirationTtl = (expiresAt = '', nowMs = Date.now()) => {
  const normalized = toTrimmedString(expiresAt);
  if (!normalized) return null;
  const expirationMs = Date.parse(normalized);
  if (!Number.isFinite(expirationMs)) {
    throw new Error('Sponsored bootstrap grant expiry must be a valid date/time.');
  }
  const ttlSeconds = Math.ceil((expirationMs - Number(nowMs || 0)) / 1000);
  if (ttlSeconds <= 0) {
    throw new Error('Sponsored bootstrap grant expiry must be in the future.');
  }
  return ttlSeconds;
};

export const readSponsoredGrantRecord = async (env, token, deps = {}) => {
  const getKvJsonFn = typeof deps.getKvJson === 'function' ? deps.getKvJson : getKvJson;
  return getKvJsonFn(env, buildSponsoredGrantKvKey(token));
};

export const writeSponsoredGrantRecord = async (env, token, record, ttlSeconds = null, deps = {}) => {
  const putKvJsonFn = typeof deps.putKvJson === 'function' ? deps.putKvJson : putKvJson;
  return putKvJsonFn(env, buildSponsoredGrantKvKey(token), record, ttlSeconds || undefined);
};

export const deleteSponsoredGrantRecord = async (env, token) => (
  env?.GROUP_KV?.delete?.(buildSponsoredGrantKvKey(token))
);

const buildSafeSponsoredReceiptBody = (incoming = {}) => {
  const body = {};
  [
    'ok',
    'error',
    'workerName',
    'workerUrl',
    'resolvedSlug',
    'kvNamespaceId',
    'deploymentId',
    'sessionConfigKey',
    'sessionSecretsKey',
    'sessionKvPrefix',
    'writesSessionConfig',
    'writesSessionSecrets',
    'tokenSecretSet',
    'tokenSecretPreserved',
    'envelopeKekSecretSet',
    'envelopeKekSecretPreserved',
    'subdomain',
    'subdomainStatus',
    'subdomainEnabled',
    'subdomainError',
    'scriptSubdomainEnabled',
    'scriptSubdomainError',
    'configVerified',
    'deploymentRequestPending',
    'deploymentRequestTerminal',
    'txHash',
    'status',
    'to',
    'amountEth',
    'chainId',
  ].forEach((key) => {
    const value = incoming?.[key];
    if (typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) {
      body[key] = value;
    }
  });
  return body;
};

const buildSponsoredGrantContinuationRecord = ({
  grantRecord,
  requestDigest,
  state,
} = {}) => {
  const expiresAt = toTrimmedString(grantRecord?.expiresAt);
  const sourceAllowOrigins = Array.isArray(grantRecord?.sourceConfig?.allowOrigins)
    ? grantRecord.sourceConfig.allowOrigins
      .map((value) => toTrimmedString(value))
      .filter(Boolean)
    : [];
  return {
    type: toTrimmedString(grantRecord?.type),
    sourceSessionSlug: toTrimmedString(grantRecord?.sourceSessionSlug),
    sourceConfig: sourceAllowOrigins.length ? { allowOrigins: sourceAllowOrigins } : {},
    ...(expiresAt ? { expiresAt } : {}),
    state,
    requestDigest: toTrimmedString(requestDigest),
  };
};

export const writeSponsoredGrantRedemptionReservation = async ({
  env,
  token,
  grantRecord,
  requestDigest,
  nowMs = Date.now(),
} = {}) => {
  const expiresAt = toTrimmedString(grantRecord?.expiresAt);
  const ttlSeconds = expiresAt
    ? computeSponsoredGrantExpirationTtl(expiresAt, nowMs)
    : null;
  const reservation = buildSponsoredGrantContinuationRecord({
    grantRecord,
    requestDigest,
    state: 'redeeming',
  });
  await writeSponsoredGrantRecord(env, token, reservation, ttlSeconds);
  return reservation;
};

export const writeSponsoredGrantReceipt = async ({
  env,
  token,
  grantRecord,
  requestDigest,
  response,
  nowMs = Date.now(),
} = {}) => {
  const expiresAt = toTrimmedString(grantRecord?.expiresAt);
  const ttlSeconds = expiresAt
    ? computeSponsoredGrantExpirationTtl(expiresAt, nowMs)
    : null;
  const safeRecord = {
    ...buildSponsoredGrantContinuationRecord({
      grantRecord,
      requestDigest,
      state: 'redeemed',
    }),
    receipt: {
      status: Number(response?.status || 0) || 200,
      body: buildSafeSponsoredReceiptBody(response?.body),
    },
  };
  await writeSponsoredGrantRecord(env, token, safeRecord, ttlSeconds);
  return safeRecord.receipt;
};
