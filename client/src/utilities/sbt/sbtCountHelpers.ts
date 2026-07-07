export type SbtCountMap = Record<string, number>;

export interface SbtCountsPayload {
  mintedCountByAddress: SbtCountMap;
  burnedCountByAddress: SbtCountMap;
  mintedEventCount: number;
  burnedEventCount: number;
}

export interface SbtCountsPayloadInput {
  mintedCountByAddress?: Record<string, unknown> | null;
  burnedCountByAddress?: Record<string, unknown> | null;
  mintedEventCount?: unknown;
  burnedEventCount?: unknown;
}

export interface SbtCountsScanCheckpointInput extends SbtCountsPayloadInput {
  phase?: unknown;
  blockNumber?: unknown;
}

export interface SbtCountsScanCheckpoint extends SbtCountsPayload {
  phase: 'activity';
  blockNumber: number;
  scanStartBlock: number;
  scanToBlock: number;
}

export interface SbtCountState {
  mintedAddresses?: string[];
  burnedAddresses?: string[];
  mintedCountByAddress?: SbtCountMap | null;
  burnedCountByAddress?: SbtCountMap | null;
  mintedEventCount?: number;
  burnedEventCount?: number;
}

export const normalizeSbtCountMap = (value: Record<string, unknown> | null = null): SbtCountMap => {
  const out: SbtCountMap = {};
  Object.entries(value || {}).forEach(([addrRaw, countRaw]) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};

export const sumSbtCountMap = (value: Record<string, unknown> | null = null): number =>
  Object.values(normalizeSbtCountMap(value)).reduce(
    (sum, count) => sum + Math.max(0, Math.floor(Number(count || 0))),
    0,
  );

export const mergeSbtCountMaps = (
  base: Record<string, unknown> | null = {},
  delta: Record<string, unknown> | null = {},
): SbtCountMap => {
  const out: SbtCountMap = { ...((base || {}) as SbtCountMap) };
  Object.entries(delta || {}).forEach(([addr, count]) => {
    const key = String(addr || '').toLowerCase();
    if (!key) return;
    const n = Number(count);
    if (!Number.isFinite(n) || n === 0) return;
    const prev = Number(out[key]) || 0;
    out[key] = prev + n;
  });
  return out;
};

export const mergeSbtCountsPayload = (
  base: Partial<SbtCountsPayloadInput> = {},
  delta: Partial<SbtCountsPayloadInput> = {},
): SbtCountsPayload => {
  const mintedCountByAddress = mergeSbtCountMaps(base.mintedCountByAddress || {}, delta.mintedCountByAddress || {});
  const burnedCountByAddress = mergeSbtCountMaps(base.burnedCountByAddress || {}, delta.burnedCountByAddress || {});
  return {
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount: (Number(base.mintedEventCount) || 0) + (Number(delta.mintedEventCount) || 0),
    burnedEventCount: (Number(base.burnedEventCount) || 0) + (Number(delta.burnedEventCount) || 0),
  };
};

export const seedSbtCountMapFromLegacyAddresses = (
  countMapIn: Record<string, unknown> | null = null,
  addresses: Array<string | null | undefined> | null | undefined = [],
): SbtCountMap => {
  const out = normalizeSbtCountMap(countMapIn);
  (Array.isArray(addresses) ? addresses : []).forEach((addrRaw) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    if (!(Number(out[addr]) > 0)) {
      out[addr] = 1;
    }
  });
  return out;
};

export const hydrateLegacySbtCountState = (entry: SbtCountState | null = {}): SbtCountState | null => {
  if (!entry || typeof entry !== 'object') return entry;
  const normalizeAddressList = (value: unknown = []): string[] =>
    Array.from(
      new Set(
        (Array.isArray(value) ? value : []).map((addrRaw) => String(addrRaw || '').toLowerCase()).filter(Boolean),
      ),
    );
  const mintedAddresses = normalizeAddressList(entry.mintedAddresses);
  const burnedAddresses = normalizeAddressList(entry.burnedAddresses);
  const mintedCountByAddress = seedSbtCountMapFromLegacyAddresses(entry.mintedCountByAddress, mintedAddresses);
  const burnedCountByAddress = seedSbtCountMapFromLegacyAddresses(entry.burnedCountByAddress, burnedAddresses);
  const mintedEventCount = Math.max(
    0,
    Math.floor(Number(entry.mintedEventCount || 0)),
    sumSbtCountMap(mintedCountByAddress),
  );
  const burnedEventCount = Math.max(
    0,
    Math.floor(Number(entry.burnedEventCount || 0)),
    sumSbtCountMap(burnedCountByAddress),
  );

  entry.mintedAddresses = mintedAddresses;
  entry.burnedAddresses = burnedAddresses;
  entry.mintedCountByAddress = mintedCountByAddress;
  entry.burnedCountByAddress = burnedCountByAddress;
  entry.mintedEventCount = mintedEventCount;
  entry.burnedEventCount = burnedEventCount;
  return entry;
};

export const getCurrentHolderAddressesFromCounts = (counts: Partial<SbtCountsPayloadInput> = {}): string[] => {
  const mintedCountByAddress = normalizeSbtCountMap(counts?.mintedCountByAddress);
  const burnedCountByAddress = normalizeSbtCountMap(counts?.burnedCountByAddress);
  const holders: string[] = [];
  Object.keys(mintedCountByAddress).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedCountByAddress?.[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedCountByAddress?.[addr] || 0)));
    if (minted - burned > 0) {
      holders.push(addr);
    }
  });
  return holders;
};

export const normalizeSbtCountsScanCheckpoint = (
  checkpointIn: SbtCountsScanCheckpointInput | null | undefined,
  {
    startBlock,
    toBlock,
  }: {
    startBlock: unknown;
    toBlock: unknown;
  },
): SbtCountsScanCheckpoint | null => {
  if (!checkpointIn || typeof checkpointIn !== 'object') return null;
  const phase = String(checkpointIn.phase || '').trim();
  if (phase !== 'activity') return null;

  const scanStartBlock = Math.floor(Number(startBlock));
  const scanToBlock = Math.floor(Number(toBlock));
  if (!Number.isFinite(scanStartBlock) || !Number.isFinite(scanToBlock)) return null;

  const checkpointFloor = scanStartBlock - 1;
  const blockNumber = Math.max(
    checkpointFloor,
    Math.min(scanToBlock, Math.floor(Number(checkpointIn.blockNumber ?? checkpointFloor))),
  );
  const mintedCountByAddress = normalizeSbtCountMap(checkpointIn.mintedCountByAddress);
  const burnedCountByAddress = normalizeSbtCountMap(checkpointIn.burnedCountByAddress);
  const mintedEventCountRaw = Math.floor(Number(checkpointIn.mintedEventCount || 0));
  const burnedEventCountRaw = Math.floor(Number(checkpointIn.burnedEventCount || 0));

  return {
    phase,
    blockNumber,
    scanStartBlock,
    scanToBlock,
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount: mintedEventCountRaw > 0 ? mintedEventCountRaw : sumSbtCountMap(mintedCountByAddress),
    burnedEventCount: burnedEventCountRaw > 0 ? burnedEventCountRaw : sumSbtCountMap(burnedCountByAddress),
  };
};
