/**
 * @file corsProxy.js
 * @module corsProxy
 * @description CORS proxy URL resolution — resolves the active Cloudflare Worker URL for a session,
 *              supporting both legacy static URLs and on-chain registry-based worker discovery.
 *
 * Key exports: getCorsProxyUrlOrThrow, resolveCorsProxyUrl, corsProxyUtils
 */
import { resolveEncryptedFieldValue, resolveEncryptedValue } from '../crypto/encryptedFields.js';
import { normalizeBaseUrl } from '../urlUtils.js';
import { normalizeSessionSlug } from '../session/sessionNaming.js';
import { getSessionWorkerConfigReplicaState } from '../session/sessionWorkerConfigCache.js';
import {
  getSharedFallbackWorkerUrl,
  resolveConfiguredSessionWorkerUrlFromConfig,
  shouldUseSharedFallbackWorkerUrl,
} from '../session/sessionWorkerAvailability.js';
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';
import { defaultCorsProxyAllowDemoFallback, resolveWorkerSessionContext } from './workerSessionResolution.js';

const rpcLog = createLogger('rpc');

const looksLikeEnvelope = (value: any): boolean => {
  if (!value) return false;
  const isEnvelopeShape = (obj: any): boolean =>
    !!obj && typeof obj === 'object' && typeof obj.ciphertext === 'string' && typeof obj.iv === 'string' && obj.aad;
  if (typeof value === 'object') return isEnvelopeShape(value);
  if (typeof value === 'string') {
    try {
      return isEnvelopeShape(JSON.parse(value));
    } catch (_) {
      return false;
    }
  }
  return false;
};

export const resolveCorsProxyUrl = async ({
  sessionSlug,
  sessionConfig,
  context,
  allowDemoFallback,
}: any = {}): Promise<any> => {
  const aliases = resolveWorkerSessionContext({
    sessionSlug,
    sessionConfig,
    allowDemoFallback,
    getDefaultAllowDemoFallback: defaultCorsProxyAllowDemoFallback,
  });
  const slug = aliases.sessionSlug;
  const cfg = aliases.sessionConfig;
  const replicaState = getSessionWorkerConfigReplicaState({
    slug,
    sessionConfig: cfg,
  });
  const cachedWorkerConfig = replicaState.cacheApplied ? replicaState.cachedConfig : null;
  const useSharedDefaultWorkerFallback = shouldUseSharedFallbackWorkerUrl({
    slug,
    sessionConfig: cfg,
  });
  const effectiveCfg: any = replicaState.sessionConfig || cfg;
  const cachedRaw = resolveConfiguredSessionWorkerUrlFromConfig(cachedWorkerConfig);
  if (replicaState.cacheApplied && cachedRaw) {
    return {
      url: normalizeBaseUrl(cachedRaw),
      status: 'plain',
      source: 'worker-config-cache',
      session: effectiveCfg,
      group: effectiveCfg,
      workerConfig: cachedWorkerConfig,
    };
  }

  const raw = resolveConfiguredSessionWorkerUrlFromConfig(effectiveCfg);
  if (raw && !useSharedDefaultWorkerFallback) {
    if (looksLikeEnvelope(raw)) {
      const decrypted = await resolveEncryptedValue(raw, context);
      const value = normalizeBaseUrl(toStr(decrypted.value).trim());
      return {
        url: value,
        status: decrypted.status || (value ? 'encrypted' : 'locked'),
        source: 'session',
        session: effectiveCfg,
        group: effectiveCfg,
        encryptedAvailable: true,
      };
    }
    return {
      url: normalizeBaseUrl(raw),
      status: 'plain',
      source: 'session',
      session: effectiveCfg,
      group: effectiveCfg,
    };
  }

  const encrypted = await resolveEncryptedFieldValue(effectiveCfg, 'corsWorkerUrl', context);
  if (encrypted.encryptedAvailable) {
    const value = normalizeBaseUrl(toStr(encrypted.value).trim());
    return {
      url: value,
      status: encrypted.status || (value ? 'encrypted' : 'locked'),
      source: 'session',
      session: effectiveCfg,
      group: effectiveCfg,
      encryptedAvailable: true,
    };
  }

  const allowGlobalFallback = normalizeSessionSlug(slug) === '';
  const fallback = allowGlobalFallback ? getSharedFallbackWorkerUrl() : '';
  if (typeof window !== 'undefined') {
    rpcLog.log('[corsProxy] using fallback worker URL', {
      allowGlobalFallback,
      fallback,
      session: effectiveCfg?.slug || effectiveCfg?.sessionName || slug || '',
    });
  }
  return {
    url: fallback,
    status: fallback ? 'fallback' : 'missing',
    source: fallback ? 'default' : 'missing',
    session: effectiveCfg,
    group: effectiveCfg,
  };
};

export const getCorsProxyUrlOrThrow = async (opts: any = {}): Promise<string> => {
  const resolved = await resolveCorsProxyUrl(opts);
  if (resolved.url) return resolved.url;

  const status = toStr(resolved.status).toLowerCase();
  if (status === 'wallet-required') {
    throw new Error('Connect a wallet to unlock the worker URL.');
  }
  if (status === 'lit-unavailable') {
    throw new Error('Lit hooks not initialized; connect a wallet to unlock the worker URL.');
  }
  if (status === 'locked' || status === 'encrypted') {
    throw new Error('Worker URL is encrypted and locked. Ask an admin to unlock it.');
  }
  throw new Error('Worker URL is not configured.');
};

export const corsProxyUtils = {
  resolveCorsProxyUrl,
  getCorsProxyUrlOrThrow,
};
