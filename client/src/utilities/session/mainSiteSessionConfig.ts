import {
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionChainId as resolveSessionChainId,
  getSessionNetwork as resolveSessionNetwork,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { resolveStrictSessionValue } from '../../utilities/survey/questionRouting.js';

type NullableChainIdInput = number | string | null | undefined;

type SessionContractConfigLike = {
  chainId?: NullableChainIdInput;
  [key: string]: unknown;
};

type SessionContractsLike = {
  surveys?: SessionContractConfigLike | null;
  sbtFactory?: SessionContractConfigLike | null;
  [key: string]: unknown;
};

type SessionBlockLimitsLike = {
  start?: NullableChainIdInput;
  end?: NullableChainIdInput;
  [key: string]: unknown;
};

export type MainSiteSessionConfigLike = Record<string, unknown> & {
  slug?: string;
  networkChainId?: NullableChainIdInput;
  blockLimits?: SessionBlockLimitsLike | null;
  contracts?: SessionContractsLike | null;
};

export type MainSiteSessionNetworkLike = Record<string, unknown> & {
  id?: NullableChainIdInput;
  chainId?: NullableChainIdInput;
  name?: string;
};

const asSessionConfigLike = (value: unknown): MainSiteSessionConfigLike | null =>
  value && typeof value === 'object' ? (value as MainSiteSessionConfigLike) : null;

const asSessionNetworkLike = (value: unknown): MainSiteSessionNetworkLike | null =>
  value && typeof value === 'object' ? (value as MainSiteSessionNetworkLike) : null;

export const getSessionCfg = (slugIn: string | null | undefined): MainSiteSessionConfigLike | null => {
  const normalized = normalizeSessionSlug(slugIn ?? '');
  if (!normalized) {
    return asSessionConfigLike(getSessionConfigBySlugOrDefault(''));
  }

  return asSessionConfigLike(
    resolveStrictSessionValue(normalized, getSessionConfigBySlug, (slug) => getSessionConfigBySlug(slug)),
  );
};

export const getSessionChainId = (slugIn: string | null | undefined): number | null => {
  const chainId = Number(
    resolveStrictSessionValue(normalizeSessionSlug(slugIn ?? ''), getSessionConfigBySlug, resolveSessionChainId) || 0,
  );
  return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
};

export const getSessionNetwork = (slugIn: string | null | undefined): MainSiteSessionNetworkLike | null => {
  return asSessionNetworkLike(
    resolveStrictSessionValue(normalizeSessionSlug(slugIn ?? ''), getSessionConfigBySlug, resolveSessionNetwork),
  );
};
