import { normalizeSessionSlug } from './sessionNaming.js';
import { normalizeBaseUrl } from '../urlUtils.js';
import { toStr } from '../shared/primitives.js';

export const SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY = 'ce:sponsoredBootstrapFunding:v1';

const canUseSessionStorage = () => (
  typeof window !== 'undefined' &&
  typeof window.sessionStorage !== 'undefined'
);

const hasFundingContext = (value = {}) => (
  !!toStr(value?.sessionSlug).trim() || !!toStr(value?.workerUrl).trim()
);

const persistSponsoredBootstrapFundingContext = (normalized = {}) => {
  if (!canUseSessionStorage()) return normalized;
  try {
    if (!hasFundingContext(normalized)) {
      sessionStorage.removeItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY);
      return normalized;
    }
    sessionStorage.setItem(
      SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY,
      JSON.stringify(normalized)
    );
  } catch (_) {}
  return normalized;
};

export const normalizeSponsoredBootstrapFundingContext = (value = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  const faucetGrantToken = toStr(
    source.faucetGrantToken ??
    ''
  ).trim();
  return {
    sessionSlug: normalizeSessionSlug(
      source.sessionSlug ??
      source.sourceSessionSlug ??
      ''
    ),
    workerUrl: normalizeBaseUrl(toStr(
      source.bootstrapWorkerUrl ??
      source.workerUrl ??
      source.sourceWorkerUrl ??
      ''
    ).trim()),
    targetSessionSlug: normalizeSessionSlug(
      source.targetSessionSlug ??
      source.requestedSessionSlug ??
      ''
    ),
    ...(faucetGrantToken ? { faucetGrantToken } : {}),
  };
};

export const readSponsoredBootstrapFundingContext = () => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY);
    if (!raw) return null;
    const normalized = normalizeSponsoredBootstrapFundingContext(JSON.parse(raw));
    return hasFundingContext(normalized) ? normalized : null;
  } catch {
    return null;
  }
};

export const writeSponsoredBootstrapFundingContext = (value = {}) => {
  const normalized = normalizeSponsoredBootstrapFundingContext(value);
  return persistSponsoredBootstrapFundingContext(normalized);
};

export const clearSponsoredBootstrapFaucetGrantToken = () => {
  const current = readSponsoredBootstrapFundingContext();
  const normalized = normalizeSponsoredBootstrapFundingContext({
    ...(current && typeof current === 'object' ? current : {}),
    faucetGrantToken: '',
  });
  return persistSponsoredBootstrapFundingContext(normalized);
};

export const clearSponsoredBootstrapFundingContext = () => {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY);
  } catch (_) {}
};
