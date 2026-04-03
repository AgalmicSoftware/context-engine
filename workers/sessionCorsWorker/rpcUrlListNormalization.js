const fallbackToString = (value) => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

export const normalizeRpcUrlList = (value) => {
  if (Array.isArray(value)) {
    return value.map((url) => fallbackToString(url).trim()).filter(Boolean);
  }
  const str = fallbackToString(value).trim();
  return str ? [str] : [];
};

export const mergeRpcUrlLists = (...lists) => {
  const seen = new Set();
  const merged = [];
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((url) => {
      const trimmed = fallbackToString(url).trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      merged.push(trimmed);
    });
  });
  return merged;
};
