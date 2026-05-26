import { ethers } from 'ethers';

export const CHIPOTLE_WRAPPED_KEY_VERSION = 2;
export const CHIPOTLE_POLICY_VERSION = 'chipotle-sbt-v2';

type ChipotleGateMode = 'any' | 'all';
type UnknownRecord = Record<string, unknown>;

export interface LitChipotlePolicy extends UnknownRecord {
  version: typeof CHIPOTLE_POLICY_VERSION;
  chainId: number;
  gateMode: ChipotleGateMode;
  sbtAddresses: string[];
  litActionCid: string;
  litPkpId: string;
}

export interface LitChipotleWrappedPlaintext {
  v: typeof CHIPOTLE_WRAPPED_KEY_VERSION;
  cekHex: string;
  policyFingerprint: string;
  policy: LitChipotlePolicy;
}

interface BuildLitChipotlePolicyOptions extends UnknownRecord {
  chainId?: unknown;
  gateMode?: unknown;
  sbtAddresses?: unknown;
  litActionCid?: unknown;
  litPkpId?: unknown;
}

interface BuildLitChipotleWrappedPlaintextOptions {
  cekHex?: unknown;
  policy?: BuildLitChipotlePolicyOptions;
}

const ethersUtils = (ethers?.utils || ethers) as typeof ethers.utils;

const toStr = (value: unknown): string => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

export const normalizeChipotleGateMode = (value: unknown): ChipotleGateMode => (
  toStr(value).trim().toLowerCase() === 'all' ? 'all' : 'any'
);

export const normalizeChipotleChainId = (value: unknown): number => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export const normalizeChipotleSbtAddresses = (values: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
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

export const stableChipotleStringify = (value: unknown): string => {
  const walk = (entry: unknown): unknown => {
    if (entry == null) return entry;
    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      return entry;
    }
    if (Array.isArray(entry)) return entry.map(walk);
    if (typeof entry === 'object') {
      const source = entry as UnknownRecord;
      const out: UnknownRecord = {};
      Object.keys(source).sort().forEach((key) => {
        out[key] = walk(source[key]);
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
}: BuildLitChipotlePolicyOptions = {}): LitChipotlePolicy => {
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

export const fingerprintLitChipotlePolicy = (
  policy: BuildLitChipotlePolicyOptions = {}
): string => {
  const canonicalPolicy = buildLitChipotlePolicy(policy);
  return ethersUtils.keccak256(
    ethersUtils.toUtf8Bytes(stableChipotleStringify(canonicalPolicy))
  );
};

export const normalizeChipotleCekHex = (value: unknown): string => {
  const raw = toStr(value).trim();
  if (!/^0x[0-9a-f]{64}$/i.test(raw)) {
    throw new Error('Lit Chipotle CEK must be a 32-byte hex string.');
  }
  return ethersUtils.hexlify(ethersUtils.arrayify(raw));
};

export const buildLitChipotleWrappedPlaintext = ({
  cekHex,
  policy,
}: BuildLitChipotleWrappedPlaintextOptions = {}): LitChipotleWrappedPlaintext => {
  const canonicalPolicy = buildLitChipotlePolicy(policy);
  return {
    v: CHIPOTLE_WRAPPED_KEY_VERSION,
    cekHex: normalizeChipotleCekHex(cekHex),
    policyFingerprint: fingerprintLitChipotlePolicy(canonicalPolicy),
    policy: canonicalPolicy,
  };
};

export const parseLitChipotleWrappedPlaintext = (value: unknown): LitChipotleWrappedPlaintext => {
  let parsed: unknown;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('Lit Chipotle wrapped key is not valid v2 JSON.');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as UnknownRecord).v !== CHIPOTLE_WRAPPED_KEY_VERSION
  ) {
    throw new Error('Lit Chipotle legacy wrapped keys are not supported.');
  }
  const parsedRecord = parsed as UnknownRecord;
  const policy = buildLitChipotlePolicy(
    (parsedRecord.policy || {}) as BuildLitChipotlePolicyOptions
  );
  const expectedFingerprint = fingerprintLitChipotlePolicy(policy);
  const actualFingerprint = toStr(parsedRecord.policyFingerprint).trim().toLowerCase();
  if (!actualFingerprint || actualFingerprint !== expectedFingerprint.toLowerCase()) {
    throw new Error('Lit Chipotle wrapped key policy fingerprint mismatch.');
  }
  return {
    v: CHIPOTLE_WRAPPED_KEY_VERSION,
    cekHex: normalizeChipotleCekHex(parsedRecord.cekHex),
    policyFingerprint: expectedFingerprint,
    policy,
  };
};

export const normalizeLitChipotleMetadataVersion = (chipotle: unknown = {}): number => {
  const raw = chipotle && typeof chipotle === 'object'
    ? (chipotle as UnknownRecord).version ?? (chipotle as UnknownRecord).v
    : null;
  const parsed = Number(raw || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};
