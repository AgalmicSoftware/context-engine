/**
 * @module sessionMetadata
 * @description Session metadata normalization — strips authoritative gate fields from Arweave metadata,
 *              normalizes session naming conventions, and resolves Lit network configuration.
 *
 * Key exports: stripAuthoritativeSessionGateFields, normalizeSessionNaming, normalizeLitMetadataNetwork
 */
import type { SessionMetadata, UnknownRecord } from './sessionTypes.js';

const DEFAULT_LIT_NETWORK = 'chipotle';
const LEGACY_LIT_NETWORK_ALIASES = Object.freeze({
  chipotle: 'chipotle',
  'chipotle-v3': 'chipotle',
  'naga-dev': 'chipotle',
  nagadev: 'chipotle',
  'naga-test': 'chipotle',
  nagatest: 'chipotle',
  'naga-mainnet': 'chipotle',
  naga: 'chipotle',
  datil: 'chipotle',
} as const);

const isObj = (value: unknown): value is SessionMetadata =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const cloneMetadata = <T>(metadata: T): T => (isObj(metadata) ? ({ ...metadata } as T) : metadata);
const readTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const resolveCanonicalLitNetwork = (value: unknown): string => {
  const raw = readTrimmedString(value || DEFAULT_LIT_NETWORK);
  if (!raw) return DEFAULT_LIT_NETWORK;
  const normalized = raw.toLowerCase().replace(/_/g, '-');
  return (LEGACY_LIT_NETWORK_ALIASES as Record<string, string>)[normalized] || raw;
};

/**
 * Removes authoritative gate fields that should come from the registry rather than Arweave metadata.
 * @param {unknown} metadata
 * @returns {unknown}
 */
export const stripAuthoritativeSessionGateFields = (metadata: unknown): unknown => {
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
export const normalizeSessionNaming = (metadata: unknown): unknown => {
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
export const normalizeLitMetadataNetwork = (metadata: unknown): unknown => {
  if (!isObj(metadata)) return metadata;
  const next = cloneMetadata(metadata);

  const litObj = isObj(next.lit) ? next.lit : null;
  const legacyLitNetwork = readTrimmedString(next.litNetwork);
  const litNetwork = readTrimmedString(litObj?.network);
  const hasLitSection = !!litObj || !!legacyLitNetwork;
  if (!hasLitSection) return next;

  const nextLit: UnknownRecord = litObj ? { ...litObj } : {};
  nextLit.network = resolveCanonicalLitNetwork(litNetwork || legacyLitNetwork || DEFAULT_LIT_NETWORK);
  next.lit = nextLit;
  delete next.litNetwork;
  return next;
};
