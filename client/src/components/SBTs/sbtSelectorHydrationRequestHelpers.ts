import { ethers } from 'ethers';

type SbtSelectorHydrationAddressEntry = Record<string, unknown> & {
  address?: unknown;
};

export type BuildSelectedSbtHydrationSignatureArgs = {
  addresses?: unknown;
  networkID?: unknown;
  slug?: unknown;
};

export type ResolveSbtSelectorTargetedHydrationDecisionArgs = {
  addresses?: unknown;
  hits?: unknown;
  targetedLookupEnabled?: unknown;
};

export type ResolveSbtSelectorLoadOptionsRequestDecisionArgs = {
  forceReload?: unknown;
  inflightRequest?: unknown;
  inflightSig?: unknown;
  lastRequestSig?: unknown;
  requestSig?: unknown;
};

export type SbtSelectorTargetedHydrationDecision = {
  hasHits: boolean;
  hasUnresolvedAddresses: boolean;
  shouldClearRetry: boolean;
  shouldReloadOptions: boolean;
  shouldRetry: boolean;
};

export type SbtSelectorLoadOptionsRequestDecision = {
  shouldQueueRerun: boolean;
  shouldReturnInflight: boolean;
  shouldSkipUnchanged: boolean;
};

const isSbtSelectorHydrationRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export const buildSelectedSbtHydrationAddresses = (selectedSBTs: unknown): string[] => {
  const selected = Array.isArray(selectedSBTs) ? selectedSBTs : [];
  return Array.from(
    new Set(
      selected
        .map((entry: unknown) => {
          const record = isSbtSelectorHydrationRecord(entry) ? (entry as SbtSelectorHydrationAddressEntry) : {};
          return String(record.address || '').trim();
        })
        .filter((value: string) => ethers.utils.isAddress(value))
        .map((value: string) => ethers.utils.getAddress(value)),
    ),
  );
};

export const buildSelectedSbtHydrationSignature = ({
  addresses = [],
  networkID = null,
  slug = '',
}: BuildSelectedSbtHydrationSignatureArgs = {}): string =>
  `${String(slug || '')}|${Number(networkID || 0)}|${(Array.isArray(addresses) ? addresses : []).join(',')}`;

export const resolveSbtSelectorTargetedHydrationDecision = ({
  addresses = [],
  hits = [],
  targetedLookupEnabled = false,
}: ResolveSbtSelectorTargetedHydrationDecisionArgs = {}): SbtSelectorTargetedHydrationDecision => {
  const addressList = Array.isArray(addresses) ? addresses : [];
  const hitList = Array.isArray(hits) ? hits : [];
  const hasHits = hitList.length > 0;
  const resolvedAddresses = new Set<string>(
    hitList
      .map((entry: unknown) => {
        const record = isSbtSelectorHydrationRecord(entry) ? entry : {};
        return String(record.address || '')
          .trim()
          .toLowerCase();
      })
      .filter(Boolean),
  );
  const hasUnresolvedAddresses = addressList.some(
    (address: unknown) =>
      !resolvedAddresses.has(
        String(address || '')
          .trim()
          .toLowerCase(),
      ),
  );
  if (!hasHits) {
    return {
      hasHits: false,
      hasUnresolvedAddresses,
      shouldClearRetry: !targetedLookupEnabled,
      shouldReloadOptions: false,
      shouldRetry: !!targetedLookupEnabled,
    };
  }
  return {
    hasHits: true,
    hasUnresolvedAddresses,
    shouldClearRetry: !hasUnresolvedAddresses || !targetedLookupEnabled,
    shouldReloadOptions: true,
    shouldRetry: hasUnresolvedAddresses && !!targetedLookupEnabled,
  };
};

export const resolveSbtSelectorLoadOptionsRequestDecision = ({
  forceReload = false,
  inflightRequest = null,
  inflightSig = '',
  lastRequestSig = '',
  requestSig = '',
}: ResolveSbtSelectorLoadOptionsRequestDecisionArgs = {}): SbtSelectorLoadOptionsRequestDecision => {
  const hasInflight = !!inflightRequest;
  const forced = !!forceReload;
  const currentRequestSig = String(requestSig || '');
  const currentInflightSig = String(inflightSig || '');
  return {
    shouldQueueRerun: hasInflight && (forced || currentRequestSig !== currentInflightSig),
    shouldReturnInflight: hasInflight,
    shouldSkipUnchanged: !forced && !hasInflight && currentRequestSig === String(lastRequestSig || ''),
  };
};
