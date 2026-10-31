import { stableCanonicalSerialize } from '../shared/deployHelperCore.mjs';
import { normalizePayloadAccessControl } from './payloadAccessControl.js';
import { toStr } from './stringCoercion.js';

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value) => toStr(value).trim();

const parseAccessRecord = (value) => {
  if (isObj(value)) return value;
  const raw = trim(value);
  if (!raw || raw[0] !== '{') return {};
  try {
    const parsed = JSON.parse(raw);
    return isObj(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const resolveConfiguredPayloadAccessValue = (config = {}) => (
  config?.storageProfile?.payloadAccessControl ||
  config?.sessionModeProfile?.storage?.payloadAccessControl ||
  config?.storageProfile?.payloadAccessMode ||
  config?.sessionModeProfile?.storage?.payloadAccessMode
);

const normalizeAccessGroupIds = (value) => {
  const source = Array.isArray(value) ? value : (trim(value) ? [value] : []);
  return source.map((entry) => trim(entry).toLowerCase()).filter(Boolean).sort();
};

const normalizeAccessAudienceExtras = ({ value, metadata } = {}) => {
  const record = parseAccessRecord(value);
  return {
    groupIds: normalizeAccessGroupIds(record.groupIds || metadata?.groupIds),
    role: trim(record.role || metadata?.role).toLowerCase(),
    accessConditions: stableCanonicalSerialize(record.accessConditions || metadata?.accessConditions || null),
  };
};

// True when a stored row is readable by the session's whole published
// audience: the session's own gate, encryption and conditions, nothing narrower.
export const metadataAccessMatchesPublishedAudience = (metadata = {}, config = {}) => {
  if (!isObj(metadata?.payloadAccessControl) && !trim(metadata?.payloadAccessMode)) return true;
  const expectedValue = resolveConfiguredPayloadAccessValue(config);
  const actualValue = metadata.payloadAccessControl || metadata.payloadAccessMode;
  const expected = normalizePayloadAccessControl(expectedValue);
  const actual = normalizePayloadAccessControl(actualValue);
  if (actual.gate !== expected.gate || actual.encryption !== expected.encryption) return false;
  const expectedExtras = normalizeAccessAudienceExtras({ value: expectedValue });
  const actualExtras = normalizeAccessAudienceExtras({ value: actualValue, metadata });
  return stableCanonicalSerialize(actualExtras) === stableCanonicalSerialize(expectedExtras);
};
