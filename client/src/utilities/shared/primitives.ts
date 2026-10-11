export const toStr = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (val == null) return '';
  // Uploaded JSON can hold objects whose conversion throws ({"toString":1});
  // those read as empty text instead of breaking the caller.
  try {
    return String(val);
  } catch {
    return '';
  }
};
export const normalizeSlug = (raw: unknown): string =>
  toStr(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
export const normalizeSessionIdHex = (hex: unknown): string => {
  const s = toStr(hex).trim().toLowerCase();
  if (!s || s === '0x' || /^0x0+$/.test(s)) return '';
  return s.startsWith('0x') ? s : '0x' + s;
};
export const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
