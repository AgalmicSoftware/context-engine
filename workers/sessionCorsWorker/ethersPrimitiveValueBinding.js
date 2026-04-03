const toStr = (value, deps) => (
  typeof deps?.toStr === 'function'
    ? deps.toStr(value)
    : typeof value === 'string'
      ? value
      : value == null
        ? ''
        : String(value)
);

const getEthersFn = (primary, fallback) => (
  typeof primary === 'function' ? primary : typeof fallback === 'function' ? fallback : null
);

const getEthersUtils = (deps) => (deps?.ethers && deps.ethers.utils ? deps.ethers.utils : {});

export const createEthersPrimitiveValueHelpersWithWorkerDeps = ({
  deps,
} = {}) => {
  const normalizeSessionIdHex = (raw) => {
    const value = toStr(raw, deps).trim();
    if (!value) return '';
    if (value.startsWith('0x') && value.length === 34) {
      const rest = value.slice(2);
      if (/^[0-9a-fA-F]{32}$/.test(rest)) return `0x${rest.toLowerCase()}`;
    }
    const compact = value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (compact.length === 32) return `0x${compact}`;
    return '';
  };

  const toBigInt = (val) => {
    if (typeof val === 'bigint') return val;
    if (typeof val === 'number' && Number.isFinite(val)) return BigInt(Math.trunc(val));
    if (typeof val === 'string') {
      try {
        return BigInt(val);
      } catch {
        return 0n;
      }
    }
    if (val && typeof val.toString === 'function') {
      try {
        return BigInt(val.toString());
      } catch {
        return 0n;
      }
    }
    return 0n;
  };

  const isAddress = (value) => {
    const utils = getEthersUtils(deps);
    const fn = getEthersFn(deps?.ethers?.isAddress, utils?.isAddress);
    return fn ? fn(value) : false;
  };

  const getAddress = (value) => {
    const utils = getEthersUtils(deps);
    const fn = getEthersFn(deps?.ethers?.getAddress, utils?.getAddress);
    return fn ? fn(value) : value;
  };

  const verifyMessage = (message, signature) => {
    const utils = getEthersUtils(deps);
    const fn = getEthersFn(deps?.ethers?.verifyMessage, utils?.verifyMessage);
    if (!fn) throw new Error('verifyMessage unavailable');
    return fn(message, signature);
  };

  const getBytes = (value) => {
    const utils = getEthersUtils(deps);
    const fn = getEthersFn(deps?.ethers?.getBytes, utils?.arrayify);
    if (!fn) throw new Error('getBytes unavailable');
    return fn(value);
  };

  const solidityKeccak256 = (types, values) => {
    const utils = getEthersUtils(deps);
    const fn = getEthersFn(deps?.ethers?.solidityPackedKeccak256, utils?.solidityKeccak256);
    if (!fn) throw new Error('solidityKeccak256 unavailable');
    return fn(types, values);
  };

  const parseEther = (value) => {
    const utils = getEthersUtils(deps);
    const fn = getEthersFn(deps?.ethers?.parseEther, utils?.parseEther);
    if (!fn) throw new Error('parseEther unavailable');
    return fn(value);
  };

  const formatEther = (value) => {
    const utils = getEthersUtils(deps);
    const fn = getEthersFn(deps?.ethers?.formatEther, utils?.formatEther);
    if (!fn) throw new Error('formatEther unavailable');
    return fn(value);
  };

  return {
    normalizeSessionIdHex,
    toBigInt,
    isAddress,
    getAddress,
    verifyMessage,
    getBytes,
    solidityKeccak256,
    parseEther,
    formatEther,
  };
};
