import { getChainById } from '../../variables/chains.js';
import { normalizeSlug as canonicalizeSlug, toStr } from '../../utilities/shared/primitives.js';
import { normalizeWorkerUrl as normalizeWorkerBaseUrl } from '../../utilities/worker/workerUrl.js';

export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  const message =
    error && typeof error === 'object' && 'message' in error ? (error as { message?: unknown }).message : null;
  return typeof message === 'string' && message.trim() ? message : fallback;
};

export const getChainName = (value: unknown): string => {
  const id = Number(value || 0);
  if (!id) return '';
  const chain = getChainById(id);
  return toStr(chain?.name).trim();
};

export const normalizeSlug = (raw: unknown): string => {
  const slug = canonicalizeSlug(raw);
  return slug === 'general' ? '' : slug;
};

export const countSessionsForChain = (entries: unknown = [], chainId: unknown = null): number => {
  const list = Array.isArray(entries) ? entries : [];
  if (!chainId) return list.length;
  return list.filter((entry) => {
    const [, cfg] = Array.isArray(entry) ? entry : [];
    const cfgRecord = cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>) : {};
    const registry =
      cfgRecord.__registry && typeof cfgRecord.__registry === 'object'
        ? (cfgRecord.__registry as Record<string, unknown>)
        : {};
    const cfgChainId = Number(registry.registryChainId || registry.chainId || 0) || 0;
    return cfgChainId === chainId;
  }).length;
};

export const normalizeWorkerUrl = (url: unknown): string => normalizeWorkerBaseUrl(url);

export const normalizeAiProvider = (raw: unknown, fallback: unknown = 'openai'): string => {
  const provider = toStr(raw).trim().toLowerCase();
  if (['openai', 'anthropic', 'openrouter', 'custom'].includes(provider)) return provider;
  return String(fallback || '');
};

export const inferAiProviderFromModel = (modelRaw: unknown): string => {
  const model = toStr(modelRaw).trim().toLowerCase();
  if (!model) return '';
  if (model.startsWith('claude')) return 'anthropic';
  if (/^(gpt-|o[1-9]|chatgpt)/.test(model)) return 'openai';
  if (model.includes('/')) return 'openrouter';
  return '';
};

export const buildTxExplorerUrl = (hash: unknown, chainId: unknown): string => {
  const base = toStr(getChainById(chainId)?.blockExplorers?.default?.url).trim();
  if (!base || !hash) return '';
  return `${base.replace(/\/+$/, '')}/tx/${hash}`;
};
