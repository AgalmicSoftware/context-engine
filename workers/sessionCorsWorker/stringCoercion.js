export const toStr = (value) => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

export const trimIfString = (value) => (
  typeof value === 'string' ? value.trim() : value
);

export const toTrimmedString = (value, deps) => {
  const stringify = typeof deps?.toStr === 'function' ? deps.toStr : toStr;
  return stringify(value).trim();
};
