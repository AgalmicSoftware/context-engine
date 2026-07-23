import { normalizeSessionSlug } from './sessionNaming.js';
import { normalizeBaseUrl } from '../urlUtils.js';
import { toStr } from '../shared/primitives.js';

type SponsoredBootstrapFundingInput = Record<string, unknown>;
type SponsoredBootstrapFundingContext = {
  sessionSlug: string;
  workerUrl: string;
  targetSessionSlug: string;
  faucetGrantToken?: string;
};

export const SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY = 'ce:sponsoredBootstrapFunding:v1';

const hasFundingContext = (value: Partial<SponsoredBootstrapFundingContext> = {}): boolean =>
  !!toStr(value?.sessionSlug).trim() || !!toStr(value?.workerUrl).trim();

const isObj = (value: unknown): value is SponsoredBootstrapFundingInput =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let memoryFundingContext: SponsoredBootstrapFundingContext | null = null;

const purgeLegacySponsoredBootstrapFundingContext = (): void => {
  if (typeof window === 'undefined') return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      storage?.removeItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY);
    } catch (_) {}
  }
};

export const normalizeSponsoredBootstrapFundingContext = (value: unknown = {}): SponsoredBootstrapFundingContext => {
  const source = isObj(value) ? value : {};
  const faucetGrantToken = toStr(source.faucetGrantToken ?? '').trim();
  return {
    sessionSlug: normalizeSessionSlug(source.sessionSlug ?? source.sourceSessionSlug ?? ''),
    workerUrl: normalizeBaseUrl(
      toStr(source.bootstrapWorkerUrl ?? source.workerUrl ?? source.sourceWorkerUrl ?? '').trim(),
    ),
    targetSessionSlug: normalizeSessionSlug(source.targetSessionSlug ?? source.requestedSessionSlug ?? ''),
    ...(faucetGrantToken ? { faucetGrantToken } : {}),
  };
};

export const readSponsoredBootstrapFundingContext = (): SponsoredBootstrapFundingContext | null => {
  purgeLegacySponsoredBootstrapFundingContext();
  const normalized = normalizeSponsoredBootstrapFundingContext(memoryFundingContext);
  return hasFundingContext(normalized) ? normalized : null;
};

export const writeSponsoredBootstrapFundingContext = (value: unknown = {}): SponsoredBootstrapFundingContext => {
  purgeLegacySponsoredBootstrapFundingContext();
  const normalized = normalizeSponsoredBootstrapFundingContext(value);
  memoryFundingContext = hasFundingContext(normalized) ? normalized : null;
  return normalized;
};

export const clearSponsoredBootstrapFaucetGrantToken = (): SponsoredBootstrapFundingContext => {
  const current = readSponsoredBootstrapFundingContext();
  const normalized = normalizeSponsoredBootstrapFundingContext({
    ...(current && typeof current === 'object' ? current : {}),
    faucetGrantToken: '',
  });
  memoryFundingContext = hasFundingContext(normalized) ? normalized : null;
  purgeLegacySponsoredBootstrapFundingContext();
  return normalized;
};

export const clearSponsoredBootstrapFundingContext = (): void => {
  memoryFundingContext = null;
  purgeLegacySponsoredBootstrapFundingContext();
};
