import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import type { SbtListHelperItem, SbtListHelperRecord } from './sbtListCardDetailsHelpers';

export type SbtCacheMetaSnapshot = {
  lastBlock: number;
  sbtCount: number;
};

const isSbtListItemRecord = (value: unknown): value is SbtListHelperRecord => !!value && typeof value === 'object';

export const readSbtListCacheMetaSnapshot = (slug: unknown, netKey: unknown): SbtCacheMetaSnapshot | null => {
  if (!netKey) return null;
  try {
    const cache = peekCacheSync('sbtCache', String(slug || ''), { clone: false });
    if (!isSbtListItemRecord(cache)) return null;
    const netCache: SbtListHelperRecord = isSbtListItemRecord(cache[String(netKey)])
      ? (cache[String(netKey)] as SbtListHelperRecord)
      : {};
    return {
      lastBlock: Number(netCache.lastBlock || 0),
      sbtCount: Object.keys(isSbtListItemRecord(netCache.sbtList) ? netCache.sbtList : {}).length,
    };
  } catch (_) {
    return null;
  }
};

export const getSbtListNetHolderCount = (item: unknown = {}): number => {
  const record = isSbtListItemRecord(item) ? (item as SbtListHelperItem) : {};
  const summaryCount = Number(record.historySummary?.currentHolderCount);
  if (Number.isFinite(summaryCount) && summaryCount >= 0) {
    return Math.floor(summaryCount);
  }
  return Math.max(
    0,
    Number(Array.isArray(record.mintedAddresses) ? record.mintedAddresses.length : 0) -
      Number(Array.isArray(record.burnedAddresses) ? record.burnedAddresses.length : 0),
  );
};

export const normalizeSbtListItems = (items: unknown = []): SbtListHelperItem[] =>
  (Array.isArray(items) ? items : [])
    .filter((item: unknown): item is SbtListHelperItem => {
      const record = isSbtListItemRecord(item) ? (item as SbtListHelperItem) : null;
      return !!(record && record.sbtAddress && record.sbtInfo);
    })
    .sort((a: SbtListHelperItem, b: SbtListHelperItem) => {
      const netA = getSbtListNetHolderCount(a);
      const netB = getSbtListNetHolderCount(b);
      if (netB !== netA) return netB - netA;
      const addrA = String(a.sbtAddress || '').toLowerCase();
      const addrB = String(b.sbtAddress || '').toLowerCase();
      return addrA.localeCompare(addrB);
    });

export const getSbtListComparableText = (value: unknown): string => String(value ?? '').trim();

export const getSbtListItemSignature = (item: unknown = {}): string => {
  const record = isSbtListItemRecord(item) ? (item as SbtListHelperItem) : {};
  const info = isSbtListItemRecord(record.sbtInfo) ? record.sbtInfo : {};
  return [
    String(record.sbtAddress || '').toLowerCase(),
    normalizeSessionSlug(record.slug || ''),
    Number(record.blockNumber || 0),
    Number(getSbtListNetHolderCount(record)),
    String(record.historySummary?.historicalHolderCount || ''),
    normalizeSessionSlug(info.sessionSlug ?? record.sessionSlug ?? ''),
    getSbtListComparableText(info.name),
    getSbtListComparableText(info.title),
    getSbtListComparableText(info.description),
    getSbtListComparableText(info.image),
    getSbtListComparableText(info.tokenURI ?? info.tokenUri),
  ].join('|');
};

export const areSbtListArraysEqual = (a: unknown = [], b: unknown = []): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (getSbtListItemSignature(a[i]) !== getSbtListItemSignature(b[i])) return false;
  }
  return true;
};
