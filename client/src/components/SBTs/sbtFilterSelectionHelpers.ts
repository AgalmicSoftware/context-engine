export type UnknownRecord = Record<string, unknown>;

export type SbtFilterSelectionState = {
  selectedSBTGroupsCreator: unknown[];
  excludedSBTGroupsCreator: unknown[];
  selectedSBTGroupsResponder: unknown[];
  excludedSBTGroupsResponder: unknown[];
  selectedSBTGroups: unknown[];
  excludedSBTGroups: unknown[];
  onlyVerifiedHumans: boolean;
};

export type SbtFilterSbtOption = UnknownRecord & {
  address?: unknown;
};

export type SbtFilterSelectedSbtEntry = SbtFilterSbtOption & {
  chainID?: unknown;
  chainId?: unknown;
  group?: unknown;
  sessionName?: unknown;
  sessionSlug?: unknown;
  slug?: unknown;
};

export type SbtFilterSnapshotArgs = {
  filterStateSignature: unknown;
  itemCount: unknown;
  itemsSourceSignature: unknown;
  mode: unknown;
  networkID: unknown;
  passive?: boolean;
  sbtCacheRevision: unknown;
};

export type ResolveSbtFilterGroupSlugArgs = {
  fallbackSlug?: unknown;
  getSessionSlugByName?: ((sessionName: string) => unknown) | null;
  normalizeSessionSlug?: ((slug: unknown) => string) | null;
  sbtInput?: unknown;
};

export type ResolveSbtFilterChainIdArgs = {
  getSessionChainId?: ((slug: unknown) => unknown) | null;
  networkID?: unknown;
  sbtInput?: unknown;
  sbtSlug?: unknown;
};

export type SbtFilterSelectionPatchArgs = {
  address?: unknown;
  sbtObject?: unknown;
  state?: unknown;
  stateKey?: unknown;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asCacheObject = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

export const buildSbtFilterSelectionStateFromState = (state: unknown = {}): SbtFilterSelectionState => {
  const source = isRecord(state) ? state : {};
  return {
    selectedSBTGroupsCreator: source.selectedSBTGroupsCreator as unknown[],
    excludedSBTGroupsCreator: source.excludedSBTGroupsCreator as unknown[],
    selectedSBTGroupsResponder: source.selectedSBTGroupsResponder as unknown[],
    excludedSBTGroupsResponder: source.excludedSBTGroupsResponder as unknown[],
    selectedSBTGroups: source.selectedSBTGroups as unknown[],
    excludedSBTGroups: source.excludedSBTGroups as unknown[],
    onlyVerifiedHumans: source.onlyVerifiedHumans as boolean,
  };
};

export const buildSbtFilterSnapshot = ({
  filterStateSignature,
  mode,
  itemCount,
  networkID,
  itemsSourceSignature,
  sbtCacheRevision,
  passive = false,
}: SbtFilterSnapshotArgs): string =>
  [
    String(filterStateSignature || ''),
    String(mode || ''),
    String(itemCount),
    String(networkID || '__no-network__'),
    String(itemsSourceSignature || ''),
    String(sbtCacheRevision || 0),
    ...(passive ? ['passive'] : []),
  ].join('|');

export const readSbtOptionAddress = (sbtObject: unknown): unknown =>
  isRecord(sbtObject) ? sbtObject.address : undefined;

export const asSelectedSbtEntry = (value: unknown): SbtFilterSelectedSbtEntry =>
  isRecord(value) ? (value as SbtFilterSelectedSbtEntry) : {};

export const hasMatchingSbtOptionAddress = (list: unknown, address: unknown): boolean =>
  Array.isArray(list) && list.some((sbt) => readSbtOptionAddress(sbt) === address);

export const appendSbtFilterOption = (list: unknown, sbtObject: unknown): unknown[] => [
  ...(Array.isArray(list) ? list : []),
  sbtObject,
];

export const removeMatchingSbtOptionAddress = (list: unknown, address: unknown): unknown[] =>
  (Array.isArray(list) ? list : []).filter((sbt) => readSbtOptionAddress(sbt) !== address);

export const shouldAppendSbtFilterSelection = ({
  address,
  state = {},
  stateKey = '',
}: SbtFilterSelectionPatchArgs = {}): boolean => {
  const key = String(stateKey || '');
  const source = asCacheObject(state);
  return !hasMatchingSbtOptionAddress(source[key], address);
};

export const buildSbtFilterSelectionAddPatch = ({
  sbtObject,
  state = {},
  stateKey = '',
}: SbtFilterSelectionPatchArgs = {}): Record<string, unknown[]> => {
  const key = String(stateKey || '');
  const source = asCacheObject(state);
  return {
    [key]: appendSbtFilterOption(source[key], sbtObject),
  };
};

export const buildSbtFilterSelectionRemovePatch = ({
  address,
  state = {},
  stateKey = '',
}: SbtFilterSelectionPatchArgs = {}): Record<string, unknown[]> => {
  const key = String(stateKey || '');
  const source = asCacheObject(state);
  return {
    [key]: removeMatchingSbtOptionAddress(source[key], address),
  };
};

export const buildSbtFilterQuickChipSelectedAddressSet = (selectedSBTs: unknown): Set<string> =>
  new Set<string>(
    (Array.isArray(selectedSBTs) ? selectedSBTs : [])
      .map((entry) =>
        String(readSbtOptionAddress(entry) || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

export const resolveSbtFilterGroupSlug = ({
  fallbackSlug = '',
  getSessionSlugByName,
  normalizeSessionSlug,
  sbtInput,
}: ResolveSbtFilterGroupSlugArgs = {}): string => {
  if (!sbtInput) return String(fallbackSlug || '');
  const sbt = asSelectedSbtEntry(sbtInput);
  const normalizeSlug =
    typeof normalizeSessionSlug === 'function' ? normalizeSessionSlug : (value: unknown) => String(value || '');
  const direct = sbt.sessionSlug || sbt.slug || sbt.group;
  if (direct != null && String(direct).trim() !== '') return normalizeSlug(direct);
  if (sbt.sessionName && typeof getSessionSlugByName === 'function') {
    const byName = getSessionSlugByName(String(sbt.sessionName).trim());
    if (byName != null) return byName as string;
  }
  return String(fallbackSlug || '');
};

export const resolveSbtFilterChainId = ({
  getSessionChainId,
  networkID,
  sbtInput,
  sbtSlug,
}: ResolveSbtFilterChainIdArgs = {}): number | null => {
  const sbt = asSelectedSbtEntry(sbtInput);
  const fromEntry = sbt.chainId || sbt.chainID;
  const sessionChainId = typeof getSessionChainId === 'function' ? getSessionChainId(sbtSlug) : null;
  const chainId = sessionChainId || fromEntry || networkID || null;
  return chainId != null ? Number(chainId) : null;
};

export const normalizeIncomingFilterState = (state: unknown = {}): SbtFilterSelectionState => {
  const record = isRecord(state) ? state : {};
  return {
    selectedSBTGroupsCreator: Array.isArray(record.selectedSBTGroupsCreator) ? record.selectedSBTGroupsCreator : [],
    excludedSBTGroupsCreator: Array.isArray(record.excludedSBTGroupsCreator) ? record.excludedSBTGroupsCreator : [],
    selectedSBTGroupsResponder: Array.isArray(record.selectedSBTGroupsResponder)
      ? record.selectedSBTGroupsResponder
      : [],
    excludedSBTGroupsResponder: Array.isArray(record.excludedSBTGroupsResponder)
      ? record.excludedSBTGroupsResponder
      : [],
    selectedSBTGroups: Array.isArray(record.selectedSBTGroups) ? record.selectedSBTGroups : [],
    excludedSBTGroups: Array.isArray(record.excludedSBTGroups) ? record.excludedSBTGroups : [],
    onlyVerifiedHumans: !!record.onlyVerifiedHumans,
  };
};

export const hasActiveSbtFilterState = (state: unknown = {}): boolean => {
  const normalized = normalizeIncomingFilterState(state);
  return (
    normalized.selectedSBTGroupsCreator.length > 0 ||
    normalized.excludedSBTGroupsCreator.length > 0 ||
    normalized.selectedSBTGroupsResponder.length > 0 ||
    normalized.excludedSBTGroupsResponder.length > 0 ||
    normalized.selectedSBTGroups.length > 0 ||
    normalized.excludedSBTGroups.length > 0 ||
    normalized.onlyVerifiedHumans
  );
};

export const buildSbtEntrySignature = (entry: unknown): string => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim().toLowerCase();
  if (!isRecord(entry))
    return String(entry || '')
      .trim()
      .toLowerCase();
  const addr = String(entry.address || entry.sbtAddress || '')
    .trim()
    .toLowerCase();
  const slug = String(entry.sessionSlug || entry.slug || entry.group || '')
    .trim()
    .toLowerCase();
  const chain = String(entry.chainId || entry.chainID || '').trim();
  return `${addr}|${slug}|${chain}`;
};

export const buildSbtListSignature = (list: unknown): string =>
  Array.isArray(list) ? list.map(buildSbtEntrySignature).filter(Boolean).sort().join(',') : '';

export const buildSbtFilterStateSignature = (state: unknown = {}): string => {
  const normalized = normalizeIncomingFilterState(state);
  return [
    buildSbtListSignature(normalized.selectedSBTGroupsCreator),
    buildSbtListSignature(normalized.excludedSBTGroupsCreator),
    buildSbtListSignature(normalized.selectedSBTGroupsResponder),
    buildSbtListSignature(normalized.excludedSBTGroupsResponder),
    buildSbtListSignature(normalized.selectedSBTGroups),
    buildSbtListSignature(normalized.excludedSBTGroups),
    normalized.onlyVerifiedHumans ? '1' : '0',
  ].join('|');
};
