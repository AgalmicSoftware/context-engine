/**
 * @file resourceKeys.js
 * @module resourceKeys
 * @description Worker KV resource key management — keeps per-session RPC keys,
 *              Arweave JWKs, and faucet configuration in memory and resolves session defaults.
 *
 * Key exports: getEffectiveArweaveKey, getEffectiveRpcKey, getEffectiveFaucetConfig, resourceKeysUtils, getLocalResourceKeys
 */
import { sessionRegistryStore } from '../web3/sessionRegistry.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { getGlobalLitHooks } from '../crypto/litProtocol.js';
import { toStr } from '../shared/primitives.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import store from '../../store.js';
import {
  canonicalizeSessionSlug,
  isReservedSessionSlugKey,
  resolveCanonicalSessionConfig,
  resolveSessionConfigFromSources,
} from './canonicalSessionContext.js';
import { getDemoSessionConfigForDisplay } from './sessionSourceResolver.js';
import type { SessionConfig, UnknownRecord } from './sessionTypes.js';

type ResourceKeyProviderLike = string | UnknownRecord | null | undefined;
type FaucetConfig = {
  useLocal: boolean;
  privateKey: string;
  rpcUrl: string;
  amountEth: string;
  balanceThresholdEth: string;
};
type ResourceKeys = {
  rpc: { useLocal: boolean; apiKey: string };
  arweave: { useLocal: boolean; jwk: string };
  faucet: FaucetConfig;
};
type ResourceKeyStore = {
  v: number;
  bySession: Record<string, ResourceKeys>;
  byGroup: Record<string, ResourceKeys>;
};
type ResourceKeyResolutionContext = {
  account?: string;
  chainId?: number | string | null;
  providerLike?: ResourceKeyProviderLike;
  lit?: UnknownRecord | null;
};
type WorkerKeyMeta<TKey extends 'apiKey' | 'jwk' | 'privateKey'> = Record<TKey, string> & {
  status: string;
  encryptedAvailable: boolean;
};
type EffectiveResourceKeyOptions = {
  sessionSlug?: string;
  sessionConfig?: SessionConfig | null;
  preferLocal?: boolean;
  context?: ResourceKeyResolutionContext;
};
type EffectiveRpcKeyResult = {
  apiKey: string;
  source: 'session' | 'local';
  sessionConfigSource: string;
  status: string;
  preferLocal: boolean;
  sessionStatus: string;
  groupStatus: string;
  localStatus: string;
};
type EffectiveArweaveKeyResult = {
  arweaveJwk: string;
  source: 'session' | 'local';
  sessionConfigSource: string;
  status: string;
  preferLocal: boolean;
  sessionStatus: string;
  groupStatus: string;
  localStatus: string;
};
type EffectiveFaucetConfigResult = {
  privateKey: string;
  source: 'session' | 'local';
  sessionConfigSource: string;
  status: string;
  preferLocal: boolean;
  sessionStatus: string;
  groupStatus: string;
  localStatus: string;
  rpcUrl: string;
  amountEth: string;
  balanceThresholdEth: string;
  encryptedAvailable: boolean;
};

const STORAGE_KEY = 'ce:resourceKeys:v1';
const RESERVED_KEYS = new Set<string>(['__proto__', 'constructor', 'prototype']);
const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);

const DEFAULT_SETTINGS = Object.freeze<ResourceKeys>({
  rpc: { useLocal: false, apiKey: '' },
  arweave: { useLocal: false, jwk: '' },
  faucet: { useLocal: false, privateKey: '', rpcUrl: '', amountEth: '', balanceThresholdEth: '' },
});

const buildWorkerKeyMeta = <TKey extends 'apiKey' | 'jwk' | 'privateKey'>(keyName: TKey): WorkerKeyMeta<TKey> =>
  ({
    [keyName]: '',
    status: 'worker',
    encryptedAvailable: false,
  }) as Record<TKey, string> & { status: string; encryptedAvailable: boolean };

const normalizeSlug = (raw: unknown): string => canonicalizeSessionSlug(raw);

const normalizeJwkValue = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '';
  }
};

const normalizeSettings = (raw: unknown = {}): ResourceKeys => {
  const obj = isObj(raw) ? raw : {};
  const rpc = isObj(obj.rpc) ? obj.rpc : {};
  const arweave = isObj(obj.arweave) ? obj.arweave : {};
  const faucet = isObj(obj.faucet) ? obj.faucet : {};
  return {
    rpc: {
      useLocal: !!rpc.useLocal,
      apiKey: toStr(rpc.apiKey).trim(),
    },
    arweave: {
      useLocal: !!arweave.useLocal,
      jwk: normalizeJwkValue(arweave.jwk),
    },
    faucet: {
      useLocal: !!faucet.useLocal,
      privateKey: toStr(faucet.privateKey).trim(),
      rpcUrl: toStr(faucet.rpcUrl).trim(),
      amountEth: toStr(faucet.amountEth).trim(),
      balanceThresholdEth: toStr(faucet.balanceThresholdEth).trim(),
    },
  };
};

const normalizeStore = (raw: unknown = null): ResourceKeyStore => {
  const obj = isObj(raw) ? raw : {};
  const bySessionRaw = isObj(obj.bySession) ? obj.bySession : isObj(obj.byGroup) ? obj.byGroup : {};
  const bySession: Record<string, ResourceKeys> = {};
  Object.entries(bySessionRaw).forEach(([slug, entry]) => {
    const key = normalizeSlug(slug);
    if (isReservedSessionSlugKey(slug) || RESERVED_KEYS.has(key)) return;
    bySession[key] = normalizeSettings(entry);
  });
  return { v: 1, bySession, byGroup: bySession };
};

let memoryStore = normalizeStore(null);

const purgeLegacyStore = (): void => {
  if (typeof window === 'undefined') return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch (_) {}
  }
};

const readStore = (): ResourceKeyStore => {
  purgeLegacyStore();
  return normalizeStore(memoryStore);
};

const writeStore = (payload: ResourceKeyStore): void => {
  purgeLegacyStore();
  memoryStore = normalizeStore(payload);
};

export const getLocalResourceKeys = (slugIn = ''): ResourceKeys => {
  const slug = normalizeSlug(slugIn);
  const stored = readStore();
  const entry = stored.bySession[slug] || null;
  return entry ? normalizeSettings(entry) : normalizeSettings(DEFAULT_SETTINGS);
};

export const saveLocalResourceKeys = (slugIn = '', updates: Partial<ResourceKeys> = {}): ResourceKeys => {
  const slug = normalizeSlug(slugIn);
  const stored = readStore();
  const current = stored.bySession[slug] || normalizeSettings(DEFAULT_SETTINGS);
  const next = normalizeSettings({ ...current, ...(updates || {}) });
  stored.bySession[slug] = next;
  stored.byGroup = stored.bySession;
  writeStore(stored);
  return next;
};

export const clearLocalResourceKeys = (slugIn = ''): void => {
  const slug = normalizeSlug(slugIn);
  const stored = readStore();
  if (stored.bySession[slug]) {
    delete stored.bySession[slug];
    stored.byGroup = stored.bySession;
    writeStore(stored);
  }
};

/** @type {typeof getLocalResourceKeys} */
export const getLocalSessionResourceKeys = getLocalResourceKeys;
/** @type {typeof saveLocalResourceKeys} */
export const saveLocalSessionResourceKeys = saveLocalResourceKeys;
/** @type {typeof clearLocalResourceKeys} */
export const clearLocalSessionResourceKeys = clearLocalResourceKeys;

const resolveSessionConfig = (slugIn = ''): SessionConfig | null => {
  const normalizedSlug = canonicalizeSessionSlug(slugIn);
  const allowDemoFallback = normalizedSlug === '' ? true : defaultStrictAllowDemoFallback();
  const resolved = resolveSessionConfigFromSources({
    sessionSlug: normalizedSlug,
    getRegistrySessionConfig: (slug) => sessionRegistryStore.getSessionConfig(slug),
    preferRegistry: true,
    allowDemoFallback: false,
  });
  if (resolved.sessionConfig || !allowDemoFallback) return resolved.sessionConfig;
  const demoConfig = getDemoSessionConfigForDisplay(resolved.sessionSlug);
  return isObj(demoConfig) ? (demoConfig as SessionConfig) : null;
};

// Legacy alias removed — function is now resolveSessionConfig directly.

const getWalletContext = (
  override: ResourceKeyResolutionContext = {},
): {
  account: string;
  providerLike: ResourceKeyProviderLike;
  chainId: number | string | null;
} => {
  try {
    const state = store?.getState?.();
    const profile: UnknownRecord = isObj(state?.profile) ? state.profile : {};
    const network: UnknownRecord = isObj(profile.network) ? profile.network : {};
    const chainId = override.chainId || network.id || network.chainId || null;
    const providerLike = typeof profile.provider === 'string' || isObj(profile.provider) ? profile.provider : 'wagmi';
    return {
      account: override.account || toStr(profile.account),
      providerLike: override.providerLike || providerLike,
      chainId: typeof chainId === 'string' || typeof chainId === 'number' ? chainId : null,
    };
  } catch {
    return {
      account: override.account || '',
      providerLike: override.providerLike || 'wagmi',
      chainId: override.chainId || null,
    };
  }
};

const getLitHooks = (override: ResourceKeyResolutionContext = {}): UnknownRecord | null => {
  if (override.lit) return override.lit;
  const hooks = getGlobalLitHooks();
  return isObj(hooks) ? hooks : null;
};

const resolveEncryptedValue = async (
  encrypted: unknown,
  context: ResourceKeyResolutionContext = {},
): Promise<{ value: unknown; status: string; encryptedAvailable: boolean }> => {
  if (!encrypted) {
    return { value: '', status: 'missing', encryptedAvailable: false };
  }
  const envelopeJson = typeof encrypted === 'string' ? encrypted : JSON.stringify(encrypted);
  if (!envelopeJson || envelopeJson === 'null') {
    return { value: '', status: 'missing', encryptedAvailable: false };
  }

  const wallet = getWalletContext(context);
  const lit = getLitHooks(context);
  if (!wallet.account) {
    return { value: '', status: 'wallet-required', encryptedAvailable: true };
  }
  if (!lit || typeof lit.getKey !== 'function') {
    return { value: '', status: 'lit-unavailable', encryptedAvailable: true };
  }

  try {
    const value = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
      account: wallet.account,
      chainId: wallet.chainId,
      providerLike: wallet.providerLike,
      litOpts: { getKey: lit.getKey },
    });
    const stringValue = value == null ? '' : value;
    return {
      value: stringValue,
      status: stringValue ? 'encrypted' : 'locked',
      encryptedAvailable: true,
    };
  } catch (_) {
    return { value: '', status: 'locked', encryptedAvailable: true };
  }
};

const resolveSessionRpcKey = async (
  sessionCfg: SessionConfig | null,
  context: ResourceKeyResolutionContext = {},
): Promise<WorkerKeyMeta<'apiKey'>> => {
  void sessionCfg;
  void context;
  return buildWorkerKeyMeta('apiKey');
};

const resolveSessionArweaveKey = async (
  sessionCfg: SessionConfig | null,
  context: ResourceKeyResolutionContext = {},
): Promise<WorkerKeyMeta<'jwk'>> => {
  void sessionCfg;
  void context;
  return buildWorkerKeyMeta('jwk');
};

const resolveSessionFaucetKey = async (
  sessionCfg: SessionConfig | null,
  context: ResourceKeyResolutionContext = {},
): Promise<WorkerKeyMeta<'privateKey'>> => {
  void sessionCfg;
  void context;
  return buildWorkerKeyMeta('privateKey');
};

export const getEffectiveRpcKey = async ({
  sessionSlug,
  sessionConfig,
  preferLocal,
  context,
}: EffectiveResourceKeyOptions = {}): Promise<EffectiveRpcKeyResult> => {
  const resolved = resolveCanonicalSessionConfig({
    source: { sessionSlug, sessionConfig },
    resolveBySlug: resolveSessionConfig,
  });
  const slug = resolved.sessionSlug;
  const cfg = resolved.sessionConfig;
  const local = getLocalResourceKeys(slug);
  const preferLocalResolved = typeof preferLocal === 'boolean' ? preferLocal : !!local.rpc.useLocal;

  const sessionResolved = await resolveSessionRpcKey(cfg, context);
  const localKey = toStr(local.rpc.apiKey).trim();
  const localResolved = {
    apiKey: localKey,
    status: localKey ? 'local' : 'missing',
    encryptedAvailable: false,
  };

  let selected = sessionResolved;
  let source: 'session' | 'local' = 'session';
  if (preferLocalResolved) {
    selected = localResolved;
    source = 'local';
  }

  return {
    apiKey: toStr(selected.apiKey || '').trim(),
    source,
    sessionConfigSource: resolved.sessionConfigSource,
    status: selected.status,
    preferLocal: preferLocalResolved,
    sessionStatus: sessionResolved.status,
    groupStatus: sessionResolved.status,
    localStatus: localResolved.status,
  };
};

export const getEffectiveArweaveKey = async ({
  sessionSlug,
  sessionConfig,
  preferLocal,
  context,
}: EffectiveResourceKeyOptions = {}): Promise<EffectiveArweaveKeyResult> => {
  const resolved = resolveCanonicalSessionConfig({
    source: { sessionSlug, sessionConfig },
    resolveBySlug: resolveSessionConfig,
  });
  const slug = resolved.sessionSlug;
  const cfg = resolved.sessionConfig;
  const local = getLocalResourceKeys(slug);
  const preferLocalResolved = typeof preferLocal === 'boolean' ? preferLocal : !!local.arweave.useLocal;

  const sessionResolved = await resolveSessionArweaveKey(cfg, context);
  const localKey = normalizeJwkValue(local.arweave.jwk);
  const localResolved = {
    jwk: localKey,
    status: localKey ? 'local' : 'missing',
    encryptedAvailable: false,
  };

  let selected = sessionResolved;
  let source: 'session' | 'local' = 'session';
  if (preferLocalResolved) {
    selected = localResolved;
    source = 'local';
  }

  return {
    arweaveJwk: normalizeJwkValue(selected.jwk || ''),
    source,
    sessionConfigSource: resolved.sessionConfigSource,
    status: selected.status,
    preferLocal: preferLocalResolved,
    sessionStatus: sessionResolved.status,
    groupStatus: sessionResolved.status,
    localStatus: localResolved.status,
  };
};

export const getEffectiveFaucetConfig = async ({
  sessionSlug,
  sessionConfig,
  preferLocal,
  context,
}: EffectiveResourceKeyOptions = {}): Promise<EffectiveFaucetConfigResult> => {
  const resolved = resolveCanonicalSessionConfig({
    source: { sessionSlug, sessionConfig },
    resolveBySlug: resolveSessionConfig,
  });
  const slug = resolved.sessionSlug;
  const cfg = resolved.sessionConfig;
  const local = getLocalResourceKeys(slug);
  const preferLocalResolved = typeof preferLocal === 'boolean' ? preferLocal : !!local.faucet.useLocal;

  const sessionResolved = await resolveSessionFaucetKey(cfg, context);
  const localKey = toStr(local.faucet.privateKey).trim();
  const localResolved = {
    privateKey: localKey,
    status: localKey ? 'local' : 'missing',
    encryptedAvailable: false,
  };

  let selected = sessionResolved;
  let source: 'session' | 'local' = 'session';
  if (preferLocalResolved) {
    selected = localResolved;
    source = 'local';
  }

  const faucetCfg = isObj(cfg?.faucet) ? cfg.faucet : {};
  const localFaucetCfg = local?.faucet || {};

  const rpcUrl = preferLocalResolved
    ? toStr(localFaucetCfg.rpcUrl || faucetCfg.rpcUrl || '')
    : toStr(faucetCfg.rpcUrl || localFaucetCfg.rpcUrl || '');

  const amountEth = preferLocalResolved
    ? toStr(localFaucetCfg.amountEth || faucetCfg.amountEth || '')
    : toStr(faucetCfg.amountEth || localFaucetCfg.amountEth || '');

  const balanceThresholdEth = preferLocalResolved
    ? toStr(localFaucetCfg.balanceThresholdEth || faucetCfg.balanceThresholdEth || '')
    : toStr(faucetCfg.balanceThresholdEth || localFaucetCfg.balanceThresholdEth || '');

  return {
    privateKey: toStr(selected.privateKey || '').trim(),
    source,
    sessionConfigSource: resolved.sessionConfigSource,
    status: selected.status,
    preferLocal: preferLocalResolved,
    sessionStatus: sessionResolved.status,
    groupStatus: sessionResolved.status,
    localStatus: localResolved.status,
    rpcUrl: toStr(rpcUrl || '').trim(),
    amountEth: toStr(amountEth || '').trim(),
    balanceThresholdEth: toStr(balanceThresholdEth || '').trim(),
    encryptedAvailable: !!sessionResolved.encryptedAvailable,
  };
};

/** @type {typeof getEffectiveRpcKey} */
export const getEffectiveSessionRpcKey = getEffectiveRpcKey;
/** @type {typeof getEffectiveArweaveKey} */
export const getEffectiveSessionArweaveKey = getEffectiveArweaveKey;
/** @type {typeof getEffectiveFaucetConfig} */
export const getEffectiveSessionFaucetConfig = getEffectiveFaucetConfig;

export const resourceKeysUtils = {
  getLocalResourceKeys,
  saveLocalResourceKeys,
  clearLocalResourceKeys,
  getEffectiveRpcKey,
  getEffectiveArweaveKey,
  getEffectiveFaucetConfig,
};
