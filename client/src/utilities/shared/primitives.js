export const toStr = (val) => (typeof val === 'string' ? val : val == null ? '' : String(val));
export const normalizeSlug = (raw) => toStr(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
export const normalizeSessionIdHex = (hex) => {
  const s = toStr(hex).trim().toLowerCase();
  if (!s || s === '0x' || /^0x0+$/.test(s)) return '';
  return s.startsWith('0x') ? s : '0x' + s;
};
export const isValidEthAddress = (addr) => /^0x[0-9a-fA-F]{40}$/.test(toStr(addr).trim());
