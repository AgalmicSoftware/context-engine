// Questions and surveys are addressed by an id inside their payload, and many
// uploads can share one id. Every reader picks the same upload as the real one.

const trim = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
const compareStorageIds = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const compareVersionAge = (left, right) => (
  (Number(left.createdAtMs) || 0) - (Number(right.createdAtMs) || 0) ||
  compareStorageIds(trim(left.storageRefId), trim(right.storageRefId))
);

// Only the server's upload-time stamp grants admin precedence. Current roles
// and old derived flags cannot promote an ordinary upload or withdraw a correction.
export const isAdminStorageVersion = (candidate) => candidate.uploadAuthority === 'admin';

// The newest authorized admin upload wins, otherwise the earliest upload.
// The client's hydration merge applies the same precedence.
export const isPreferredStorageVersion = (candidate, current) => {
  if (!current) return true;
  const candidateAdmin = isAdminStorageVersion(candidate);
  const currentAdmin = isAdminStorageVersion(current);
  if (candidateAdmin !== currentAdmin) return candidateAdmin;
  const age = compareVersionAge(candidate, current);
  return candidateAdmin ? age > 0 : age < 0;
};

// candidates: [{ resourceId, createdAtMs, storageRefId, uploader, uploadAuthority, ... }].
// Returns one candidate per id, oldest first.
export const selectCanonicalStorageVersions = (candidates = []) => {
  const chosen = new Map();
  (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
    const id = trim(candidate?.resourceId).toLowerCase();
    if (!id) return;
    if (isPreferredStorageVersion(candidate, chosen.get(id))) chosen.set(id, candidate);
  });
  return [...chosen.values()].sort(compareVersionAge);
};
