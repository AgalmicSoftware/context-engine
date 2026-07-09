import { getChainById } from '../../variables/chains.js';
import { createLogger } from '../../utilities/logging';
import { toStr } from '../../utilities/shared/primitives.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import type { ChainIdLike } from '../shellTypes';

const log = createLogger('general');

export const isSessionWizardArweaveTxId = (value: unknown): boolean => /^[a-z0-9_-]{43}$/i.test(toStr(value).trim());

export const isSessionWizardArweaveGatewayHost = (host: unknown): boolean => {
  const normalized = toStr(host).trim().toLowerCase();
  return normalized.endsWith('arweave.net') || normalized.endsWith('arweave.dev') || normalized.endsWith('arweave.app');
};

export const extractSessionWizardArweaveTxId = (raw: unknown): string => {
  const value = toStr(raw).trim();
  if (!value) return '';
  if (value.startsWith('ar://')) {
    const txId = value.slice(5).trim();
    return isSessionWizardArweaveTxId(txId) ? txId : '';
  }
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split('/').filter(Boolean);
    const candidate = segments[segments.length - 1] || '';
    if (isSessionWizardArweaveGatewayHost(host) && isSessionWizardArweaveTxId(candidate)) {
      return candidate;
    }
  } catch (error) {
    log.warn('SessionWizard: fallback', error);
  }
  return isSessionWizardArweaveTxId(value) ? value : '';
};

export const parseSessionWizardArweaveTxId = (raw: unknown): string => extractSessionWizardArweaveTxId(raw);

export const normalizeSessionWizardArweaveUri = (raw: unknown): string => {
  const value = toStr(raw).trim();
  if (!value) return '';
  if (value.startsWith('ar://')) return value;
  const txId = extractSessionWizardArweaveTxId(value);
  if (txId) return `ar://${txId}`;
  return value;
};

export const getSessionWizardExplorerBaseUrl = (chainId: ChainIdLike): string => {
  const chain = getChainById(Number(chainId || 0));
  return toStr(chain?.blockExplorers?.default?.url).trim();
};

export const normalizeSessionWizardSlug = (slug: unknown): string => sessionRegistryUtils.normalizeSlug(slug);

export const normalizeSessionWizardWorkerUrl = (url: unknown): string => normalizeWorkerAuthUrl(toStr(url).trim());

const resolveBrowserOrigin = (): string =>
  typeof window !== 'undefined' && window.location ? toStr(window.location.origin).trim() : '';

export const buildSessionWizardSessionUrl = ({ slug, origin }: { slug?: unknown; origin?: string }): string => {
  const normalizedSlug = normalizeSessionWizardSlug(slug);
  if (!normalizedSlug) return '';
  const base = toStr(origin).trim() || resolveBrowserOrigin();
  return `${base}/session/${encodeURIComponent(normalizedSlug)}`;
};

export const buildSessionWizardAdminUrl = ({
  sessionId,
  chainId,
  origin,
}: {
  sessionId?: unknown;
  chainId?: unknown;
  origin?: string;
}): string => {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', String(sessionId));
  if (chainId) params.set('chainId', String(chainId));
  const base = toStr(origin).trim() || resolveBrowserOrigin();
  const query = params.toString();
  return `${base}/admin${query ? `?${query}` : ''}`;
};
