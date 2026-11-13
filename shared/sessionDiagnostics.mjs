// The stored-version count on the first page of GET /admin/diagnostics: the
// question and answer versions, with hidden-question marks, that one AI build
// reads, against its row limit. The Worker writes it and the Admin page reads
// it; both test against this check. null means the Worker couldn't count.
export const STORED_VERSIONS_FIELD = 'storedVersions';

const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

export const isStoredVersionsDiagnostics = (value) => value === null || (
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join() === 'count,limit,overLimit' &&
  isCount(value.count) && isCount(value.limit) && value.limit > 0 &&
  typeof value.overLimit === 'boolean' &&
  // Counting stops one past the limit, so over the limit reads limit + 1.
  (value.overLimit ? value.count === value.limit + 1 : value.count <= value.limit)
);
