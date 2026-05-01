export const normalizeSbtCountMap = (value = null) => {
  const out = {};
  Object.entries(value || {}).forEach(([addrRaw, countRaw]) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};


export const sumSbtCountMap = (value = null) => (
  Object.values(normalizeSbtCountMap(value)).reduce((sum, count) => (
    sum + Math.max(0, Math.floor(Number(count || 0)))
  ), 0)
);


export const mergeSbtCountMaps = (base = {}, delta = {}) => {
  const out = { ...(base || {}) };
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


export const mergeSbtCountsPayload = (base = {}, delta = {}) => {
  const mintedCountByAddress = mergeSbtCountMaps(
    base.mintedCountByAddress || {},
    delta.mintedCountByAddress || {}
  );
  const burnedCountByAddress = mergeSbtCountMaps(
    base.burnedCountByAddress || {},
    delta.burnedCountByAddress || {}
  );
  return {
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount:
      (Number(base.mintedEventCount) || 0) +
      (Number(delta.mintedEventCount) || 0),
    burnedEventCount:
      (Number(base.burnedEventCount) || 0) +
      (Number(delta.burnedEventCount) || 0),
  };
};


export const seedSbtCountMapFromLegacyAddresses = (countMapIn = null, addresses = []) => {
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


export const hydrateLegacySbtCountState = (entry = {}) => {
  if (!entry || typeof entry !== 'object') return entry;
  const normalizeAddressList = (value = []) => Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((addrRaw) => String(addrRaw || '').toLowerCase())
        .filter(Boolean)
    )
  );
  const mintedAddresses = normalizeAddressList(entry.mintedAddresses);
  const burnedAddresses = normalizeAddressList(entry.burnedAddresses);
  const mintedCountByAddress = seedSbtCountMapFromLegacyAddresses(
    entry.mintedCountByAddress,
    mintedAddresses
  );
  const burnedCountByAddress = seedSbtCountMapFromLegacyAddresses(
    entry.burnedCountByAddress,
    burnedAddresses
  );
  const mintedEventCount = Math.max(
    0,
    Math.floor(Number(entry.mintedEventCount || 0)),
    sumSbtCountMap(mintedCountByAddress)
  );
  const burnedEventCount = Math.max(
    0,
    Math.floor(Number(entry.burnedEventCount || 0)),
    sumSbtCountMap(burnedCountByAddress)
  );

  entry.mintedAddresses = mintedAddresses;
  entry.burnedAddresses = burnedAddresses;
  entry.mintedCountByAddress = mintedCountByAddress;
  entry.burnedCountByAddress = burnedCountByAddress;
  entry.mintedEventCount = mintedEventCount;
  entry.burnedEventCount = burnedEventCount;
  return entry;
};


export const getCurrentHolderAddressesFromCounts = (counts = {}) => {
  const mintedCountByAddress = normalizeSbtCountMap(counts?.mintedCountByAddress);
  const burnedCountByAddress = normalizeSbtCountMap(counts?.burnedCountByAddress);
  const holders = [];
  Object.keys(mintedCountByAddress).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedCountByAddress?.[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedCountByAddress?.[addr] || 0)));
    if ((minted - burned) > 0) {
      holders.push(addr);
    }
  });
  return holders;
};
