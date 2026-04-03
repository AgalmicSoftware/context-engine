const LOCAL_CHAIN_ID = 31337;

const normalizeInjectedChainId = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const str = String(value).trim();
  if (!str) return null;
  if (/^0x[0-9a-f]+$/i.test(str)) {
    const parsedHex = Number.parseInt(str, 16);
    return Number.isFinite(parsedHex) ? parsedHex : null;
  }
  const parsed = Number(str);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
};

export const readInjectedProviderChainId = (providerLike) => {
  if (!providerLike || typeof providerLike !== 'object') return null;
  return (
    normalizeInjectedChainId(providerLike.chainId) ??
    normalizeInjectedChainId(providerLike.networkVersion)
  );
};

export const shouldUseInjectedReadProviderForChain = ({
  targetChainId,
  injectedProvider,
} = {}) => {
  const normalizedTarget = normalizeInjectedChainId(targetChainId);
  if (normalizedTarget !== LOCAL_CHAIN_ID) return false;
  return readInjectedProviderChainId(injectedProvider) === LOCAL_CHAIN_ID;
};

export const providerSelectionUtils = {
  readInjectedProviderChainId,
  shouldUseInjectedReadProviderForChain,
};

export default providerSelectionUtils;
