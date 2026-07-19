export const toChainId = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (typeof normalized === 'number') {
    return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
  }
  if (typeof normalized !== 'string' && typeof normalized !== 'bigint') return 0;
  if (
    typeof normalized === 'string' &&
    !/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(normalized)
  ) {
    return 0;
  }
  try {
    const numeric = BigInt(normalized);
    if (numeric <= 0n || numeric > BigInt(Number.MAX_SAFE_INTEGER)) return 0;
    return Number(numeric);
  } catch {
    return 0;
  }
};

const isLegacyUnsetChainId = (value) => {
  if (value == null || value === 0 || value === 0n) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized === '' || /^(?:0+|0x0+)$/i.test(normalized);
};

export const resolveChainIdWithLegacyFallback = (value, fallback = 0) => (
  toChainId(isLegacyUnsetChainId(value) ? fallback : value)
);

export const resolveRegistryChainId = (config, fallback = 0) => {
  // Regression guard: malformed explicit values are authoritative failures;
  // only the historical absent/zero sentinel may advance through the fallback chain.
  const networkChainId = resolveChainIdWithLegacyFallback(config?.networkChainId, fallback);
  return resolveChainIdWithLegacyFallback(config?.registryChainId, networkChainId);
};
