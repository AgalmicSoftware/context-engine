import {
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionChainId as resolveSessionChainId,
  getSessionNetwork as resolveSessionNetwork,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { resolveStrictSessionValue } from '../../utilities/survey/questionRouting.js';

export const getSessionCfg = (
  slugIn: string | null | undefined
): Record<string, unknown> => {
  const normalized = normalizeSessionSlug(slugIn ?? '');
  if (!normalized) {
    return getSessionConfigBySlugOrDefault('') as Record<string, unknown>;
  }

  return resolveStrictSessionValue(
    normalized,
    getSessionConfigBySlug,
    (slug) => getSessionConfigBySlug(slug)
  ) as Record<string, unknown>;
};

export const getSessionChainId = (
  slugIn: string | null | undefined
): unknown => {
  return resolveStrictSessionValue(
    normalizeSessionSlug(slugIn ?? ''),
    getSessionConfigBySlug,
    resolveSessionChainId
  );
};

export const getSessionNetwork = (
  slugIn: string | null | undefined
): unknown => {
  return resolveStrictSessionValue(
    normalizeSessionSlug(slugIn ?? ''),
    getSessionConfigBySlug,
    resolveSessionNetwork
  );
};
