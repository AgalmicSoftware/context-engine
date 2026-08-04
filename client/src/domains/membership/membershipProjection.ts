type UnknownRecord = Record<string, unknown>;

export type CanonicalMembershipKind = 'sbt_onchain' | 'worker_group';
export type CanonicalMembershipStatus = 'member' | 'not_member' | 'unknown';
export type CanonicalMembershipProvenance =
  | 'complete_counts'
  | 'partial_counts'
  | 'legacy_history'
  | 'worker_authoritative'
  | 'none';

export type CanonicalMembershipIdentity = {
  kind: CanonicalMembershipKind;
  key: string;
  sessionSlug: string;
  chainId: string;
  resourceId: string;
};

export type CanonicalMembershipProjection = {
  identity: CanonicalMembershipIdentity;
  status: CanonicalMembershipStatus;
  provenance: CanonicalMembershipProvenance;
  authoritative: boolean;
  blockNumber: number;
  mintedCount: number;
  burnedCount: number;
  label: string;
  image: string | null;
};

type OnchainMembershipCountMaps = {
  mintedCountMap: UnknownRecord | null;
  burnedCountMap: UnknownRecord | null;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const normalizeIdentityValue = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized || fallback;
};

const buildIdentityKey = (kind: CanonicalMembershipKind, ...segments: string[]): string =>
  `${kind}:${segments.map((segment) => encodeURIComponent(segment)).join(':')}`;

const normalizeAddress = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const countAddressOccurrences = (addresses: unknown, subjectAddress: string): number =>
  (Array.isArray(addresses) ? addresses : []).reduce(
    (count, value) => count + (normalizeAddress(value) === subjectAddress ? 1 : 0),
    0,
  );

export const buildOnchainSbtMembershipIdentity = ({
  chainId,
  contractAddress,
  sessionSlug,
}: {
  chainId?: unknown;
  contractAddress?: unknown;
  sessionSlug?: unknown;
} = {}): CanonicalMembershipIdentity => {
  const normalizedSession = normalizeIdentityValue(sessionSlug, 'general');
  const normalizedChain = normalizeIdentityValue(chainId, 'unknown-chain');
  const normalizedContract = normalizeIdentityValue(contractAddress, 'unknown-contract');
  return {
    kind: 'sbt_onchain',
    key: buildIdentityKey('sbt_onchain', normalizedSession, normalizedChain, normalizedContract),
    sessionSlug: normalizedSession,
    chainId: normalizedChain,
    resourceId: normalizedContract,
  };
};

export const buildWorkerGroupMembershipIdentity = ({
  groupId,
  sessionSlug,
}: {
  groupId?: unknown;
  sessionSlug?: unknown;
} = {}): CanonicalMembershipIdentity => {
  const normalizedSession = normalizeIdentityValue(sessionSlug, 'general');
  const normalizedGroup = normalizeIdentityValue(groupId, 'unknown-group');
  return {
    kind: 'worker_group',
    key: buildIdentityKey('worker_group', normalizedSession, normalizedGroup),
    sessionSlug: normalizedSession,
    chainId: '',
    resourceId: normalizedGroup,
  };
};

const getOnchainMembershipCountMaps = (entry: unknown = {}): OnchainMembershipCountMaps => {
  const source = toRecord(entry);
  return {
    mintedCountMap: isRecord(source.mintedCountByAddress) ? source.mintedCountByAddress : null,
    burnedCountMap: isRecord(source.burnedCountByAddress) ? source.burnedCountByAddress : null,
  };
};

const findOnchainMembershipCount = (
  countMap: UnknownRecord | null,
  subjectAddress: unknown,
): { found: boolean; count: number } => {
  if (!countMap) return { found: false, count: 0 };
  const address = normalizeAddress(subjectAddress);
  if (!address) return { found: false, count: 0 };
  const directKey = Object.prototype.hasOwnProperty.call(countMap, address)
    ? address
    : Object.keys(countMap).find((key) => normalizeAddress(key) === address);
  if (!directKey) return { found: false, count: 0 };
  const value = Number(countMap[directKey] || 0);
  return {
    found: true,
    count: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0,
  };
};

export const projectOnchainSbtMembership = ({
  chainId,
  contractAddress,
  entry = {},
  label = '',
  image = null,
  sessionSlug,
  subjectAddress,
}: {
  chainId?: unknown;
  contractAddress?: unknown;
  entry?: unknown;
  label?: unknown;
  image?: unknown;
  sessionSlug?: unknown;
  subjectAddress?: unknown;
} = {}): CanonicalMembershipProjection => {
  const source = toRecord(entry);
  const address = normalizeAddress(subjectAddress);
  const { mintedCountMap, burnedCountMap } = getOnchainMembershipCountMaps(source);
  const hasStructuredCounts = Boolean(mintedCountMap || burnedCountMap);
  const mintedCount = findOnchainMembershipCount(mintedCountMap, address);
  const burnedCount = findOnchainMembershipCount(burnedCountMap, address);
  const subjectPresent = mintedCount.found || burnedCount.found;
  const completeCounts = source.countsLoaded === true && hasStructuredCounts;
  const partialCounts = source.countsLoaded !== true && hasStructuredCounts && subjectPresent;
  const blockNumberValue = Number(source.blockNumber || toRecord(source.countsScanCheckpoint).lastBlockScanned || 0);
  const blockNumber = Number.isFinite(blockNumberValue) ? Math.max(0, Math.floor(blockNumberValue)) : 0;
  const identity = buildOnchainSbtMembershipIdentity({ chainId, contractAddress, sessionSlug });
  const normalizedLabel = String(label || '').trim();
  const normalizedImage = typeof image === 'string' && image.trim() ? image.trim() : null;

  if (completeCounts || partialCounts) {
    return {
      identity,
      status: mintedCount.count > burnedCount.count ? 'member' : 'not_member',
      provenance: completeCounts ? 'complete_counts' : 'partial_counts',
      authoritative: completeCounts,
      blockNumber,
      mintedCount: mintedCount.count,
      burnedCount: burnedCount.count,
      label: normalizedLabel,
      image: normalizedImage,
    };
  }

  if (address && !isRecord(source.countsScanCheckpoint)) {
    const mintedCount = countAddressOccurrences(source.mintedAddresses, address);
    const burnedCount = countAddressOccurrences(source.burnedAddresses, address);
    if (mintedCount > 0 || burnedCount > 0) {
      return {
        identity,
        status: mintedCount > burnedCount ? 'member' : 'not_member',
        provenance: 'legacy_history',
        authoritative: false,
        blockNumber,
        mintedCount,
        burnedCount,
        label: normalizedLabel,
        image: normalizedImage,
      };
    }
  }

  return {
    identity,
    status: 'unknown',
    provenance: 'none',
    authoritative: false,
    blockNumber,
    mintedCount: 0,
    burnedCount: 0,
    label: normalizedLabel,
    image: normalizedImage,
  };
};

const PROVENANCE_RANK: Record<CanonicalMembershipProvenance, number> = {
  none: 0,
  legacy_history: 1,
  partial_counts: 2,
  complete_counts: 3,
  worker_authoritative: 3,
};

export const selectCanonicalMembershipProjection = (
  current: CanonicalMembershipProjection | null | undefined,
  candidate: CanonicalMembershipProjection,
): CanonicalMembershipProjection => {
  if (!current) return candidate;
  if (current.identity.key !== candidate.identity.key) return candidate;
  const currentRank = PROVENANCE_RANK[current.provenance];
  const candidateRank = PROVENANCE_RANK[candidate.provenance];
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;
  if (candidate.blockNumber !== current.blockNumber) {
    return candidate.blockNumber > current.blockNumber ? candidate : current;
  }
  return candidate;
};

export const projectWorkerGroupMembership = ({
  membership,
  sessionSlug,
}: {
  membership?: unknown;
  sessionSlug?: unknown;
} = {}): CanonicalMembershipProjection | null => {
  const membershipRecord = toRecord(membership);
  const group = toRecord(membershipRecord.group);
  const groupId = String(group.groupId || membershipRecord.groupId || '').trim();
  if (!groupId) return null;
  const resolvedSessionSlug = group.sessionSlug || toRecord(membershipRecord.member).sessionSlug || sessionSlug;
  return {
    identity: buildWorkerGroupMembershipIdentity({ groupId, sessionSlug: resolvedSessionSlug }),
    status: 'member',
    provenance: 'worker_authoritative',
    authoritative: true,
    blockNumber: 0,
    mintedCount: 0,
    burnedCount: 0,
    label: String(group.label || groupId).trim(),
    image: typeof group.imageUrl === 'string' && group.imageUrl.trim() ? group.imageUrl.trim() : null,
  };
};

export const projectWorkerGroupMemberships = (
  memberships: unknown = [],
  sessionSlug: unknown = '',
): CanonicalMembershipProjection[] => {
  const byIdentity = new Map<string, CanonicalMembershipProjection>();
  (Array.isArray(memberships) ? memberships : []).forEach((membership) => {
    const projection = projectWorkerGroupMembership({ membership, sessionSlug });
    if (projection) byIdentity.set(projection.identity.key, projection);
  });
  return Array.from(byIdentity.values());
};
