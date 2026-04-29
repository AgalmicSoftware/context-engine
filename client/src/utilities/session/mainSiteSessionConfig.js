import {
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionChainId as resolveSessionChainId,
  getSessionNetwork as resolveSessionNetwork,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { resolveStrictSessionValue } from '../../utilities/survey/questionRouting.js';

export const getSessionCfg = (slugIn) => {
  const normalized = normalizeSessionSlug(slugIn ?? '');
  if (!normalized) return getSessionConfigBySlugOrDefault('');
  return resolveStrictSessionValue(
    normalized,
    getSessionConfigBySlug,
    (slug) => getSessionConfigBySlug(slug)
  );
};

export const getSessionChainId = (slugIn) => {
  return resolveStrictSessionValue(
    normalizeSessionSlug(slugIn ?? ''),
    getSessionConfigBySlug,
    resolveSessionChainId
  );
};

export const getSessionNetwork = (slugIn) => {
  return resolveStrictSessionValue(
    normalizeSessionSlug(slugIn ?? ''),
    getSessionConfigBySlug,
    resolveSessionNetwork
  );
};
