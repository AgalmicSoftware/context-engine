/**
 * @module sessionMetadata
 * @description Session metadata normalization — strips authoritative gate fields from Arweave metadata,
 *              normalizes session naming conventions, and resolves Lit network configuration.
 *
 * Key exports: stripAuthoritativeSessionGateFields, normalizeSessionNaming, normalizeLitMetadataNetwork
 */
const DEFAULT_LIT_NETWORK = 'naga-dev';
const LEGACY_LIT_NETWORK_ALIASES = Object.freeze({
  'naga-dev': 'naga-dev',
  nagadev: 'naga-dev',
  'naga-test': 'naga-test',
  nagatest: 'naga-test',
  'naga-mainnet': 'naga',
  datil: 'naga',
});

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const cloneMetadata = (metadata) => (isObj(metadata) ? { ...metadata } : metadata);
const readTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const resolveCanonicalLitNetwork = (value) => {
  const raw = readTrimmedString(value || DEFAULT_LIT_NETWORK);
  if (!raw) return DEFAULT_LIT_NETWORK;
  const normalized = raw.toLowerCase().replace(/_/g, '-');
  return LEGACY_LIT_NETWORK_ALIASES[normalized] || raw;
};

export const stripAuthoritativeSessionGateFields = (metadata) => {
  if (!isObj(metadata)) return metadata;
  const next = cloneMetadata(metadata);
  delete next.sponsored;
  delete next.sponsoredSbtAddress;
  delete next.gates;
  return next;
};

export const normalizeSessionNaming = (metadata) => {
  if (!isObj(metadata)) return metadata;
  const next = cloneMetadata(metadata);

  const sessionName = readTrimmedString(next.sessionName);
  if (sessionName) {
    next.sessionName = sessionName;
  } else {
    delete next.sessionName;
  }
  // Strip pre-v2 org-prefixed fields from Arweave metadata (immutable records may contain these)
  delete next.orgName;

  const sessionInfo = readTrimmedString(next.sessionInfo);
  if (sessionInfo) {
    next.sessionInfo = sessionInfo;
  } else {
    delete next.sessionInfo;
  }
  delete next.orgInfo;

  const sessionInfoEncrypted = next.sessionInfoEncrypted || next.encryptedSessionInfo || null;
  if (sessionInfoEncrypted) {
    next.sessionInfoEncrypted = sessionInfoEncrypted;
  } else {
    delete next.sessionInfoEncrypted;
  }
  delete next.orgInfoEncrypted;
  delete next.encryptedOrgInfo;

  return next;
};

export const normalizeLitMetadataNetwork = (metadata) => {
  if (!isObj(metadata)) return metadata;
  const next = cloneMetadata(metadata);

  const litObj = isObj(next.lit) ? next.lit : null;
  const legacyLitNetwork = readTrimmedString(next.litNetwork);
  const litNetwork = readTrimmedString(litObj?.network);
  const hasLitSection = !!litObj || !!legacyLitNetwork;
  if (!hasLitSection) return next;

  const nextLit = litObj ? { ...litObj } : {};
  nextLit.network = resolveCanonicalLitNetwork(litNetwork || legacyLitNetwork || DEFAULT_LIT_NETWORK);
  next.lit = nextLit;
  delete next.litNetwork;
  return next;
};
