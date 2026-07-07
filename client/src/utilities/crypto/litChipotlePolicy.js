import { ethers } from 'ethers';

export const CHIPOTLE_WRAPPED_KEY_VERSION = 2;
export const CHIPOTLE_POLICY_VERSION = 'chipotle-sbt-v2';

const ethersUtils = ethers?.utils || ethers;

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

export const normalizeChipotleGateMode = (value) => (toStr(value).trim().toLowerCase() === 'all' ? 'all' : 'any');

export const normalizeChipotleChainId = (value) => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export const normalizeChipotleSbtAddresses = (values = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : [values]).forEach((raw) => {
    const value = toStr(raw).trim();
    if (!value) return;
    if (!ethersUtils.isAddress(value)) {
      throw new Error('Lit Chipotle policy contains an invalid SBT address.');
    }
    const normalized = ethersUtils.getAddress(value).toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  out.sort();
  return out;
};

export const stableChipotleStringify = (value) => {
  const walk = (entry) => {
    if (entry == null) return entry;
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      return entry;
    }
    if (Array.isArray(entry)) return entry.map(walk);
    if (typeof entry === 'object') {
      const out = {};
      Object.keys(entry)
        .sort()
        .forEach((key) => {
          out[key] = walk(entry[key]);
        });
      return out;
    }
    return toStr(entry);
  };
  return JSON.stringify(walk(value));
};

export const buildLitChipotlePolicy = ({
  chainId,
  gateMode = 'any',
  sbtAddresses = [],
  litActionCid = '',
  litPkpId = '',
} = {}) => {
  const normalizedChainId = normalizeChipotleChainId(chainId);
  if (!normalizedChainId) {
    throw new Error('Lit Chipotle policy requires a chain ID.');
  }
  const normalizedSbtAddresses = normalizeChipotleSbtAddresses(sbtAddresses);
  if (!normalizedSbtAddresses.length) {
    throw new Error('Lit Chipotle policy requires at least one SBT address.');
  }
  const normalizedLitActionCid = toStr(litActionCid).trim();
  if (!normalizedLitActionCid) {
    throw new Error('Lit Chipotle policy requires a Lit Action CID.');
  }
  const normalizedLitPkpId = toStr(litPkpId).trim();
  if (!normalizedLitPkpId) {
    throw new Error('Lit Chipotle policy requires a Lit PKP ID.');
  }

  return {
    version: CHIPOTLE_POLICY_VERSION,
    chainId: normalizedChainId,
    gateMode: normalizeChipotleGateMode(gateMode),
    sbtAddresses: normalizedSbtAddresses,
    litActionCid: normalizedLitActionCid,
    litPkpId: normalizedLitPkpId,
  };
};

export const fingerprintLitChipotlePolicy = (policy = {}) => {
  const canonicalPolicy = buildLitChipotlePolicy(policy);
  return ethersUtils.keccak256(ethersUtils.toUtf8Bytes(stableChipotleStringify(canonicalPolicy)));
};

export const normalizeChipotleCekHex = (value) => {
  const raw = toStr(value).trim();
  if (!/^0x[0-9a-f]{64}$/i.test(raw)) {
    throw new Error('Lit Chipotle CEK must be a 32-byte hex string.');
  }
  return ethersUtils.hexlify(ethersUtils.arrayify(raw));
};

export const buildLitChipotleWrappedPlaintext = ({ cekHex, policy } = {}) => {
  const canonicalPolicy = buildLitChipotlePolicy(policy);
  return {
    v: CHIPOTLE_WRAPPED_KEY_VERSION,
    cekHex: normalizeChipotleCekHex(cekHex),
    policyFingerprint: fingerprintLitChipotlePolicy(canonicalPolicy),
    policy: canonicalPolicy,
  };
};

export const parseLitChipotleWrappedPlaintext = (value) => {
  let parsed;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('Lit Chipotle wrapped key is not valid v2 JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || parsed.v !== CHIPOTLE_WRAPPED_KEY_VERSION) {
    throw new Error('Lit Chipotle legacy wrapped keys are not supported.');
  }
  const policy = buildLitChipotlePolicy(parsed.policy || {});
  const expectedFingerprint = fingerprintLitChipotlePolicy(policy);
  const actualFingerprint = toStr(parsed.policyFingerprint).trim().toLowerCase();
  if (!actualFingerprint || actualFingerprint !== expectedFingerprint.toLowerCase()) {
    throw new Error('Lit Chipotle wrapped key policy fingerprint mismatch.');
  }
  return {
    v: CHIPOTLE_WRAPPED_KEY_VERSION,
    cekHex: normalizeChipotleCekHex(parsed.cekHex),
    policyFingerprint: expectedFingerprint,
    policy,
  };
};

export const normalizeLitChipotleMetadataVersion = (chipotle = {}) => {
  const raw = chipotle && typeof chipotle === 'object' ? (chipotle.version ?? chipotle.v) : null;
  const parsed = Number(raw || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};
