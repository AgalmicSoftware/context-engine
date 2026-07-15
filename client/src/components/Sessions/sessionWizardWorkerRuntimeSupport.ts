import { getDefaultHttpRpc } from '../../variables/chains.js';
import { DEFAULT_WORKER_ALLOWED_ORIGINS } from '../../utilities/worker/workerCorsOrigins.js';
import { normalizeOriginList } from '../../utilities/urlUtils.js';
import { toStr } from '../../utilities/shared/primitives.js';
import {
  buildSessionWizardWorkerRpcUrlMap,
  resolveFallbackRpcUrl,
  resolveSessionWizardWorkerRpcUrl,
} from './sessionWizardWorkerRpc';
import {
  getSessionWizardDefaultWorkerUrl,
  isSessionWizardDefaultWorkerPlaceholderUrl,
} from './sessionWizardWorkerDefaults';
import { resolveSessionWizardWorkerBaseUrl } from './sessionWizardWorkerState';
import type { AnyRecord } from '../shellTypes';

type WorkerBaseUrlParams = {
  draft?: AnyRecord | null;
  wizardMode?: string;
  deployComplete?: boolean;
  deployWorkerUrl?: string;
  workerMode?: string;
  registryChainId?: unknown;
  networkId?: unknown;
  allowNormalModeSharedHostedWorker?: boolean;
};
type ResolveSessionWizardWorkerUrlSourceStateArgs = {
  defaultWorkerUrl?: unknown;
  deployedWorkerUrl?: unknown;
  deployVerifiedInUi?: unknown;
  resolvedWorkerBaseUrl?: unknown;
  visibleConfiguredWorkerUrl?: unknown;
  workerMode?: unknown;
};
export type SessionWizardWorkerUrlSourceState = {
  deployWorkerMatchesConfiguredUrl: boolean;
  usesDefaultWorkerUrl: boolean;
  workerUrlSource: string;
};

export const resolveSessionWizardWorkerBaseUrlFromDraft = ({
  draft,
  wizardMode = 'normal',
  deployComplete = false,
  deployWorkerUrl = '',
  workerMode = 'custom',
  allowNormalModeSharedHostedWorker = false,
}: WorkerBaseUrlParams = {}): string => {
  const fallbackWorkerUrl = getSessionWizardDefaultWorkerUrl();
  const configuredWorkerUrl = toStr(draft?.corsWorkerUrl).trim();
  const effectiveConfiguredWorkerUrl =
    wizardMode === 'normal' &&
    !allowNormalModeSharedHostedWorker &&
    !deployComplete &&
    isSessionWizardDefaultWorkerPlaceholderUrl(configuredWorkerUrl, fallbackWorkerUrl)
      ? ''
      : configuredWorkerUrl;
  return resolveSessionWizardWorkerBaseUrl({
    configuredWorkerUrl: effectiveConfiguredWorkerUrl,
    deployWorkerUrl: deployComplete ? deployWorkerUrl : '',
    fallbackWorkerUrl,
    workerMode: wizardMode === 'normal' && !allowNormalModeSharedHostedWorker ? 'custom' : workerMode,
  });
};

export const resolveSessionWizardWorkerUrlSourceState = ({
  defaultWorkerUrl = '',
  deployedWorkerUrl = '',
  deployVerifiedInUi = false,
  resolvedWorkerBaseUrl = '',
  visibleConfiguredWorkerUrl = '',
  workerMode = '',
}: ResolveSessionWizardWorkerUrlSourceStateArgs = {}): SessionWizardWorkerUrlSourceState => {
  const usesDefaultWorkerUrl =
    workerMode === 'default' &&
    !!visibleConfiguredWorkerUrl &&
    !!defaultWorkerUrl &&
    visibleConfiguredWorkerUrl === defaultWorkerUrl;
  const deployWorkerMatchesConfiguredUrl =
    !!visibleConfiguredWorkerUrl && !!deployedWorkerUrl && visibleConfiguredWorkerUrl === deployedWorkerUrl;
  const workerUrlSource = !resolvedWorkerBaseUrl
    ? 'missing (set worker URL)'
    : workerMode === 'default' || usesDefaultWorkerUrl
      ? 'default worker'
      : deployVerifiedInUi && deployWorkerMatchesConfiguredUrl
        ? 'deployed worker URL (verified this run)'
        : deployVerifiedInUi && !deployWorkerMatchesConfiguredUrl
          ? 'custom worker URL changed after deploy (re-deploy to verify)'
          : 'custom worker URL (not verified in this run)';

  return {
    deployWorkerMatchesConfiguredUrl,
    usesDefaultWorkerUrl,
    workerUrlSource,
  };
};

const resolveSessionWizardWorkerRuntimeChainId = ({
  draft,
  registryChainId,
  networkId,
}: {
  draft?: AnyRecord | null;
  registryChainId?: unknown;
  networkId?: unknown;
} = {}): number | null => Number(registryChainId || draft?.networkChainId || networkId || 0) || null;

export const resolveSessionWizardWorkerRpcUrlFromDraft = ({
  draft,
  registryChainId,
  networkId,
  workerSecrets = null,
}: {
  draft?: AnyRecord | null;
  registryChainId?: unknown;
  networkId?: unknown;
  workerSecrets?: AnyRecord | null;
} = {}): string => {
  const secretRpcUrl = toStr(workerSecrets?.customRpcUrl).trim();
  if (secretRpcUrl) return secretRpcUrl;
  const chainId = resolveSessionWizardWorkerRuntimeChainId({ draft, registryChainId, networkId });
  const providers = draft?.rpc?.providers || {};
  const pathProvider = providers.path || draft?.rpc?.path || {};
  return resolveSessionWizardWorkerRpcUrl({
    chainId,
    pathProvider,
    faucetRpcUrl: draft?.faucet?.rpcUrl,
  });
};

export const resolveSessionWizardWorkerRpcUrlMapFromDraft = ({
  draft,
  registryChainId,
  networkId,
  workerSecrets = null,
}: {
  draft?: AnyRecord | null;
  registryChainId?: unknown;
  networkId?: unknown;
  workerSecrets?: AnyRecord | null;
} = {}): Record<string, string[]> => {
  const providers = draft?.rpc?.providers || {};
  const pathProvider = providers.path || draft?.rpc?.path || {};
  const chainId = resolveSessionWizardWorkerRuntimeChainId({ draft, registryChainId, networkId });
  const map = buildSessionWizardWorkerRpcUrlMap({ chainId, pathProvider });
  const secretRpcUrl = toStr(workerSecrets?.customRpcUrl).trim();
  if (!secretRpcUrl || !chainId) return map;
  const key = String(chainId);
  const existing = Array.isArray(map[key]) ? map[key] : [];
  const seen = new Set<string>();
  const merged = [secretRpcUrl, ...existing].filter((url) => {
    const cleaned = toStr(url).trim();
    if (!cleaned || seen.has(cleaned)) return false;
    seen.add(cleaned);
    return true;
  });
  return {
    ...map,
    [key]: merged,
  };
};

export const resolveSessionWizardWorkerFaucetConfigFromDraft = ({
  draft,
  registryChainId,
  networkId,
  workerSecrets = null,
}: {
  draft?: AnyRecord | null;
  registryChainId?: unknown;
  networkId?: unknown;
  workerSecrets?: AnyRecord | null;
} = {}): {
  rpcUrl: string;
  amountEth: string;
  balanceThresholdEth: string;
} => {
  const faucetCfg = draft?.faucet || {};
  const fallbackIfUnset = (value: unknown, fallback: unknown): string => {
    const cleaned = toStr(value).trim();
    return cleaned ? cleaned : toStr(fallback).trim();
  };
  const chainId = resolveSessionWizardWorkerRuntimeChainId({ draft, registryChainId, networkId });
  const defaultRpcUrl =
    resolveSessionWizardWorkerRpcUrlFromDraft({ draft, registryChainId, networkId, workerSecrets }) ||
    getDefaultHttpRpc(chainId) ||
    resolveFallbackRpcUrl(chainId);
  return {
    rpcUrl: fallbackIfUnset(faucetCfg.rpcUrl, defaultRpcUrl),
    amountEth: fallbackIfUnset(faucetCfg.amountEth, '0.0002'),
    balanceThresholdEth: fallbackIfUnset(faucetCfg.balanceThresholdEth, '0.001'),
  };
};

export const parseSessionWizardAllowOriginsInput = (value: unknown): string[] => {
  const raw = toStr(value).trim();
  if (!raw) return [];
  const entries = raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const normalized = normalizeOriginList(entries);
  return normalized.length ? normalized : normalizeOriginList(DEFAULT_WORKER_ALLOWED_ORIGINS);
};
