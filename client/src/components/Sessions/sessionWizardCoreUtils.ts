import { ethers } from 'ethers';
import { getChainById } from '../../variables/chains.js';
import { createLogger } from '../../utilities/logging';
import { toStr } from '../../utilities/shared/primitives.js';
import { t } from '../../utilities/ui/terminology.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import type { AnyRecord, ChainIdLike } from '../shellTypes';

const log = createLogger('general');

const CONTRACT_LABELS: Record<string, string> = {
  surveys: 'Surveys',
  sbtFactory: `${t('sbt')} Factory`,
  sessionRegistry: 'Session Registry',
};

export const generateSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  let bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    try {
      bytes = new Uint8Array(ethers.utils.randomBytes(16));
    } catch (_) {
      log.warn('[SessionWizard] crypto.getRandomValues unavailable; using Math.random fallback for session ID');
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
  }
  // RFC 4122 version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return sessionRegistryUtils.formatSessionId(`0x${hex}`) || '';
};

export const getChainName = (value: ChainIdLike): string => {
  const id = Number(value || 0);
  if (!id) return '';
  const chain = getChainById(id);
  return chain?.name || '';
};

export const getSessionWizardErrorMessage = (error: unknown, fallback = ''): string => {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === 'object') {
    if ('message' in error) {
      return toStr((error as { message?: unknown }).message) || fallback;
    }
    return fallback;
  }
  return toStr(error) || fallback;
};

export const formatContractLabel = (key: string): string => {
  if (CONTRACT_LABELS[key]) return CONTRACT_LABELS[key];
  if (!key) return '';
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const buildSponsoredSbtLookupContextKey = ({
  address = '',
  slug = '',
  sessionName = '',
  networkChainId = null,
  contracts = {},
  registry = {},
}: {
  address?: unknown;
  slug?: unknown;
  sessionName?: unknown;
  networkChainId?: ChainIdLike;
  contracts?: AnyRecord;
  registry?: AnyRecord;
} = {}): string => {
  const payload = {
    address: toStr(address).trim().toLowerCase(),
    slug: toStr(slug).trim(),
    sessionName: toStr(sessionName).trim(),
    networkChainId: Number(networkChainId || 0) || 0,
    contracts: contracts && typeof contracts === 'object' ? contracts : {},
    registry: registry && typeof registry === 'object' ? registry : {},
  };
  try {
    return JSON.stringify(payload);
  } catch (_) {
    return [payload.address, payload.slug, payload.sessionName, payload.networkChainId].join('|');
  }
};

export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj ?? {}));

export const mergeDeep = (target: AnyRecord, source: AnyRecord): AnyRecord => {
  const out: AnyRecord = { ...(target || {}) };
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(out[key] || {}, value as AnyRecord);
    } else {
      out[key] = value;
    }
  });
  return out;
};
