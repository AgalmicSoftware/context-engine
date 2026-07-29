import { toStr } from '../../utilities/shared/primitives.js';
import { normalizePendingSbtDrafts } from './hooks/usePendingSbtDrafts.js';
import type { AnyRecord, ChainIdLike } from '../shellTypes';

export type SbtSelection = AnyRecord & {
  address?: string;
  sbtAddress?: string;
  value?: string;
  name?: string;
  label?: string;
  pending?: boolean;
  metadataPreview?: AnyRecord | null;
};

export type PendingSbtDraftLike = AnyRecord & {
  predictedAddress?: string;
  deployedAddress?: string;
  address?: string;
  displayName?: string;
  name?: string;
  metadataPreview?: AnyRecord | null;
  authoringPayload?: AnyRecord | null;
  sessionConfigOverride?: AnyRecord | null;
  tokenURI?: string;
  contractName?: string;
  symbol?: string;
  limitedNumber?: number | string;
  adminAddress?: string;
  mintingEndTimeUnix?: number | string;
  mintModeOnChain?: number | string;
  hasPasswordMintOnChain?: boolean;
  burnAuthEnum?: number | string;
  hashedPasswords?: string[];
  finalGroupPasswordHash?: string;
  create2Salt?: string;
  createOptions?: AnyRecord;
  usesInviteCodes?: boolean;
  groupPassword?: string;
  passwordList?: string[];
  networkChainId?: ChainIdLike;
};

export const normalizeSbtSelection = (value: unknown): SbtSelection[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') {
          const address = entry.trim();
          if (!address) return null;
          return { address, name: address };
        }
        if (typeof entry === 'object') {
          const address = toStr(entry.address || entry.sbtAddress || entry.value).trim();
          if (!address) return null;
          return { ...entry, address, name: entry.name || entry.label || address } as SbtSelection;
        }
        return null;
      })
      .filter((entry): entry is SbtSelection => !!entry);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[\n,]+/)
      .map((addr) => addr.trim())
      .filter(Boolean)
      .map((addr) => ({ address: addr, name: addr }));
  }
  return [];
};

export const serializeDefaultFeaturedSbtSelections = (value: unknown = []): Array<string | AnyRecord> => {
  const seen = new Set();
  // A public placeholder may remain selected, but the pending draft that can
  // authorize its deployment exists only in the mounted wizard's memory.
  return normalizeSbtSelection(value)
    .map((entry) => {
      const address = toStr(entry?.address).trim();
      if (!address) return null;
      const lower = address.toLowerCase();
      if (seen.has(lower)) return null;
      seen.add(lower);
      if (entry?.pending === true) {
        return {
          address,
          name: toStr(entry?.name || entry?.label || address).trim() || address,
          pending: true,
        };
      }
      return address;
    })
    .filter(Boolean) as Array<string | AnyRecord>;
};

export const dedupeSbtSelection = (value: unknown = []): SbtSelection[] => {
  const seen = new Set();
  return normalizeSbtSelection(value).filter((entry) => {
    const address = toStr(entry?.address).trim();
    if (!address) return false;
    const lower = address.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
};

export const buildPendingSbtSelection = (draftEntry: PendingSbtDraftLike = {}): SbtSelection | null => {
  const address = toStr(draftEntry?.predictedAddress || draftEntry?.address).trim();
  if (!address) return null;
  const displayName = toStr(draftEntry?.displayName || draftEntry?.name || address).trim() || address;
  return {
    address,
    name: `${displayName} (Pending)`,
    pending: true,
    metadataPreview: draftEntry?.metadataPreview || null,
  };
};

const buildDeployedSbtSelection = (draftEntry: PendingSbtDraftLike = {}): SbtSelection | null => {
  const address = toStr(draftEntry?.deployedAddress || draftEntry?.predictedAddress || draftEntry?.address).trim();
  if (!address) return null;
  const displayName = toStr(draftEntry?.displayName || draftEntry?.name || address).trim() || address;
  return {
    address,
    name: displayName,
    metadataPreview: draftEntry?.metadataPreview || null,
  };
};

export const promotePendingSbtSelectionsAfterDeploy = ({
  selections = [],
  deployedDrafts = [],
}: {
  selections?: unknown;
  deployedDrafts?: unknown;
} = {}): SbtSelection[] => {
  const promotedByAddress = new Map<string, SbtSelection>();
  normalizePendingSbtDrafts(deployedDrafts).forEach((draftEntry: PendingSbtDraftLike) => {
    const selection = buildDeployedSbtSelection(draftEntry);
    const addressLower = toStr(selection?.address).trim().toLowerCase();
    if (!addressLower || !selection) return;
    promotedByAddress.set(addressLower, selection);
  });
  if (!promotedByAddress.size) {
    return dedupeSbtSelection(normalizeSbtSelection(selections));
  }
  return dedupeSbtSelection(
    normalizeSbtSelection(selections).map((entry) => {
      const addressLower = toStr(entry?.address).trim().toLowerCase();
      if (!addressLower || entry?.pending !== true) return entry;
      return promotedByAddress.get(addressLower) || entry;
    }),
  );
};
