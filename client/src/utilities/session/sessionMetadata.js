/**
 * @module sessionMetadata
 * @description Session metadata normalization — strips authoritative gate fields from Arweave metadata,
 *              normalizes session naming conventions, and resolves Lit network configuration.
 *
 * Key exports: stripAuthoritativeSessionGateFields, normalizeSessionNaming, normalizeLitMetadataNetwork
 */

/**
 * @typedef {object} SessionMetadata
 * @property {boolean=} sponsored
 * @property {string=} sponsoredSbtAddress
 * @property {Array<Record<string, any>> | Record<string, any>=} gates
 * @property {string=} sessionName
 * @property {string=} orgName
 * @property {string=} sessionInfo
 * @property {string=} orgInfo
 * @property {string | Record<string, any> | null=} sessionInfoEncrypted
 * @property {string | Record<string, any> | null=} encryptedSessionInfo
 * @property {string | Record<string, any> | null=} orgInfoEncrypted
 * @property {string | Record<string, any> | null=} encryptedOrgInfo
 * @property {{ network?: string }=} lit
 * @property {string=} litNetwork
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

/**
 * Removes authoritative gate fields that should come from the registry rather than Arweave metadata.
 * @param {unknown} metadata
 * @returns {unknown}
 */
export const stripAuthoritativeSessionGateFields = (metadata) => {
  if (!isObj(metadata)) return metadata;
  const next = cloneMetadata(metadata);
  delete next.sponsored;
  delete next.sponsoredSbtAddress;
  delete next.gates;
  return next;
};

/**
 * Normalizes session naming fields and drops legacy org-prefixed aliases from persisted metadata.
 * @param {unknown} metadata
 * @returns {unknown}
 */
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

/**
 * Moves legacy Lit network metadata into the nested `lit.network` field using the canonical runtime name.
 * @param {unknown} metadata
 * @returns {unknown}
 */
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
