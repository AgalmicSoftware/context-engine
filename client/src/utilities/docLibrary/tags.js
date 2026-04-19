/** @file tags.js */

import { ethers } from 'ethers';
import { toStr } from '../shared/primitives.js';

export const DOC_LIBRARY_DOC_ROLES = Object.freeze({
  PHOTO: 'photo',
  PHOTO_ANALYSIS: 'photo-analysis',
});

export const normalizeSessionIdHex = (raw) => {
  const value = toStr(raw).trim();
  if (!value) return '';
  if (value.startsWith('0x') && value.length === 34) {
    const rest = value.slice(2);
    if (/^[0-9a-fA-F]{32}$/.test(rest)) return `0x${rest.toLowerCase()}`;
  }
  const compact = value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (compact.length === 32) return `0x${compact}`;
  return '';
};

export const normalizeSbtAddress = (raw) => {
  const addr = toStr(raw).trim().toLowerCase();
  if (!addr) return '';
  if (!ethers.utils.isAddress(addr)) return '';
  return addr;
};

export const buildDocLibraryCommonTags = ({ kind, storage } = {}) => ([
  { name: 'CE-DocLibrary', value: '1' },
  { name: 'CE-DocKind', value: toStr(kind || '').trim() },
  { name: 'CE-DocStorage', value: toStr(storage || '').trim() },
].filter((t) => t && t.name && t.value));

export const buildDocLibrarySessionTags = ({ sessionIdHex } = {}) => {
  const normalized = normalizeSessionIdHex(sessionIdHex);
  if (!normalized) return [];
  return [{ name: 'CE-SessionId', value: normalized }];
};

export const buildDocLibrarySbtTags = ({ chainId, sbtAddress } = {}) => {
  const id = Number(chainId || 0) || 0;
  const addr = normalizeSbtAddress(sbtAddress);
  if (!id || !addr) return [];
  return [
    { name: 'CE-SbtChainId', value: String(id) },
    { name: 'CE-SbtAddress', value: addr },
  ];
};

const truncateTagValue = (value, maxLen) => {
  const v = toStr(value).trim();
  if (!maxLen || v.length <= maxLen) return v;
  return v.slice(0, Math.max(0, maxLen - 1)).trim();
};

export const buildDocLibraryPlaintextFileMetaTags = ({ name, mime, size } = {}) => {
  const out = [];
  const safeName = truncateTagValue(name, 180);
  const safeMime = truncateTagValue(mime, 120);
  const safeSize = truncateTagValue(size != null ? String(size) : '', 40);
  if (safeName) out.push({ name: 'CE-DocName', value: safeName });
  if (safeMime) out.push({ name: 'CE-DocMime', value: safeMime });
  if (safeSize) out.push({ name: 'CE-DocSize', value: safeSize });
  return out;
};

export const buildDocLibraryRoleTags = ({ role, derivedFromTxId } = {}) => {
  const out = [];
  const safeRole = truncateTagValue(role, 60).toLowerCase();
  const safeDerivedFromTxId = truncateTagValue(derivedFromTxId, 80);
  if (safeRole) out.push({ name: 'CE-DocRole', value: safeRole });
  if (safeDerivedFromTxId) out.push({ name: 'CE-DocDerivedFromTx', value: safeDerivedFromTxId });
  return out;
};

export const mergeTags = (...lists) => (
  lists
    .flatMap((list) => (Array.isArray(list) ? list : []))
    .filter((t) => t && typeof t === 'object' && typeof t.name === 'string' && typeof t.value === 'string')
    .map((t) => ({ name: t.name.trim(), value: t.value.trim() }))
    .filter((t) => t.name && t.value !== '')
);
