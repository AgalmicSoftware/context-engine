/**
 * @file resourceKeys.js
 * @module resourceKeys
 * @description Worker KV resource key management — stores and resolves per-session RPC keys,
 *              Arweave JWKs, and faucet configuration from local storage and on-chain registry.
 *
 * Key exports: getEffectiveArweaveKey, getEffectiveRpcKey, getEffectiveFaucetConfig, resourceKeysUtils, getLocalResourceKeys
 */
import { sessionRegistryStore } from '../web3/sessionRegistry.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { getGlobalLitHooks } from '../crypto/litProtocol.js';
import { toStr } from '../shared/primitives.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import store from '../../store.js';
import { createLogger } from '../logging.js';
import {
  canonicalizeSessionSlug,
  isReservedSessionSlugKey,
  resolveCanonicalSessionConfig,
  resolveSessionConfigFromSources,
} from './canonicalSessionContext.js';
import { getDemoSessionConfigForDisplay } from './sessionSourceResolver.js';

const log = createLogger('resourceKeys');


const STORAGE_KEY = 'ce:resourceKeys:v1';
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const DEFAULT_SETTINGS = Object.freeze({
  rpc: { useLocal: false, apiKey: '' },
  arweave: { useLocal: false, jwk: '' },
  faucet: { useLocal: false, privateKey: '', rpcUrl: '', amountEth: '', balanceThresholdEth: '' },
});

const buildWorkerKeyMeta = (keyName) => ({
  [keyName]: '',
  status: 'worker',
  encryptedAvailable: false,
});

const normalizeSlug = (raw) => canonicalizeSessionSlug(raw);

const normalizeJwkValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '';
  }
};

const normalizeSettings = (raw = {}) => {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const rpc = obj.rpc && typeof obj.rpc === 'object' ? obj.rpc : {};
  const arweave = obj.arweave && typeof obj.arweave === 'object' ? obj.arweave : {};
  const faucet = obj.faucet && typeof obj.faucet === 'object' ? obj.faucet : {};
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

const normalizeStore = (raw = null) => {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const bySessionRaw =
    obj.bySession && typeof obj.bySession === 'object'
      ? obj.bySession
      : (obj.byGroup && typeof obj.byGroup === 'object' ? obj.byGroup : {});
  const bySession = {};
  Object.entries(bySessionRaw).forEach(([slug, entry]) => {
    const key = normalizeSlug(slug);
    if (isReservedSessionSlugKey(slug) || RESERVED_KEYS.has(key)) return;
    bySession[key] = normalizeSettings(entry);
  });
  return { v: 1, bySession, byGroup: bySession };
};

const readStore = () => {
  if (typeof window === 'undefined') return normalizeStore(null);
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return normalizeStore(parsed);
  } catch (_) {
    return normalizeStore(null);
  }
};

const writeStore = (payload) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) { log.warn('resourceKeys: fallback', e); }
};

export const getLocalResourceKeys = (slugIn = '') => {
  const slug = normalizeSlug(slugIn);
  const stored = readStore();
  const entry = stored.bySession[slug] || null;
  return entry ? normalizeSettings(entry) : normalizeSettings(DEFAULT_SETTINGS);
};

export const saveLocalResourceKeys = (slugIn = '', updates = {}) => {
  const slug = normalizeSlug(slugIn);
  const stored = readStore();
  const current = stored.bySession[slug] || normalizeSettings(DEFAULT_SETTINGS);
  const next = normalizeSettings({ ...current, ...(updates || {}) });
  stored.bySession[slug] = next;
  stored.byGroup = stored.bySession;
  writeStore(stored);
  return next;
};

export const clearLocalResourceKeys = (slugIn = '') => {
  const slug = normalizeSlug(slugIn);
  const stored = readStore();
  if (stored.bySession[slug]) {
    delete stored.bySession[slug];
    stored.byGroup = stored.bySession;
    writeStore(stored);
  }
};

export const getLocalSessionResourceKeys = getLocalResourceKeys;
export const saveLocalSessionResourceKeys = saveLocalResourceKeys;
export const clearLocalSessionResourceKeys = clearLocalResourceKeys;

const resolveSessionConfig = (slugIn = '') => {
  const normalizedSlug = canonicalizeSessionSlug(slugIn);
  const allowDemoFallback = normalizedSlug === '' ? true : defaultStrictAllowDemoFallback();
  const resolved = resolveSessionConfigFromSources({
    sessionSlug: normalizedSlug,
    getRegistrySessionConfig: (slug) => sessionRegistryStore.getSessionConfig(slug),
    preferRegistry: true,
    allowDemoFallback: false,
  });
  if (resolved.sessionConfig || !allowDemoFallback) return resolved.sessionConfig;
  return getDemoSessionConfigForDisplay(resolved.sessionSlug);
};

// Legacy alias removed — function is now resolveSessionConfig directly.

const getWalletContext = (override = {}) => {
  try {
    const state = store?.getState?.();
    const profile = state?.profile || {};
    const network = profile.network || {};
    const chainId =
      override.chainId ||
      network.id ||
      network.chainId ||
      null;
    return {
      account: override.account || profile.account || '',
      providerLike: override.providerLike || profile.provider || 'wagmi',
      chainId,
    };
  } catch {
    return {
      account: override.account || '',
      providerLike: override.providerLike || 'wagmi',
      chainId: override.chainId || null,
    };
  }
};

const getLitHooks = (override = {}) => {
  if (override.lit) return override.lit;
  return getGlobalLitHooks();
};

const resolveEncryptedValue = async (encrypted, context = {}) => {
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

const resolveSessionRpcKey = async (sessionCfg, context = {}) => {
  return buildWorkerKeyMeta('apiKey');
};

const resolveSessionArweaveKey = async (sessionCfg, context = {}) => {
  return buildWorkerKeyMeta('jwk');
};

const resolveSessionFaucetKey = async (sessionCfg, context = {}) => {
  return buildWorkerKeyMeta('privateKey');
};

export const getEffectiveRpcKey = async ({
  sessionSlug,
  sessionConfig,
  preferLocal,
  context,
} = {}) => {
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
  };

  let selected = sessionResolved;
  let source = 'session';
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
} = {}) => {
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
  };

  let selected = sessionResolved;
  let source = 'session';
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
} = {}) => {
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
  };

  let selected = sessionResolved;
  let source = 'session';
  if (preferLocalResolved) {
    selected = localResolved;
    source = 'local';
  }

  const faucetCfg = cfg?.faucet && typeof cfg.faucet === 'object' ? cfg.faucet : {};
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

export const getEffectiveSessionRpcKey = getEffectiveRpcKey;
export const getEffectiveSessionArweaveKey = getEffectiveArweaveKey;
export const getEffectiveSessionFaucetConfig = getEffectiveFaucetConfig;

export const resourceKeysUtils = {
  getLocalResourceKeys,
  saveLocalResourceKeys,
  clearLocalResourceKeys,
  getEffectiveRpcKey,
  getEffectiveArweaveKey,
  getEffectiveFaucetConfig,
};
