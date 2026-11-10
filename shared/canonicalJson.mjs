// Canonical JSON: sorted keys, absent members dropped and non-finite numbers
// as null. Request digests and stored signatures hash these bytes.
const canonicalizeJsonValue = (value, arrayEntry = false) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJsonValue(entry, true));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        const entry = value[key];
        if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol') return out;
        out[key] = canonicalizeJsonValue(entry);
        return out;
      }, Object.create(null));
  }
  return arrayEntry ? null : undefined;
};

export const stableCanonicalSerialize = (value) => JSON.stringify(canonicalizeJsonValue(value));
