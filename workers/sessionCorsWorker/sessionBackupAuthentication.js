const encoder = new TextEncoder();
const pageBytes = (page) => encoder.encode(JSON.stringify({ ...page, authentication: undefined }, (_, value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value));

const pageKey = async (secret) => {
  const raw = String(secret || '').trim();
  if (!raw) throw new Error('Backup recovery key is missing.');
  const material = /^[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : raw;
  const deploymentKey = await crypto.subtle.importKey('raw', encoder.encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const derived = await crypto.subtle.sign('HMAC', deploymentKey, encoder.encode('ce-backup-page-v1'));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
};

export const signBackupPage = async (page, env) => {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await pageKey(env.CE_STORAGE_ENVELOPE_KEK), pageBytes(page)));
  return { ...page, authentication: { version: 1, mac: [...mac].map((byte) => byte.toString(16).padStart(2, '0')).join('') } };
};

export const verifyBackupPage = async (page, env) => {
  const authentication = page?.authentication;
  if (authentication?.version !== 1 || !/^[a-f0-9]{64}$/.test(authentication.mac || '')) return false;
  const mac = Uint8Array.from(authentication.mac.match(/../g), (pair) => parseInt(pair, 16));
  const bytes = pageBytes(page);
  for (const secret of [env.CE_STORAGE_ENVELOPE_KEK, env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK].filter(Boolean)) {
    if (await crypto.subtle.verify('HMAC', await pageKey(secret), mac, bytes)) return true;
  }
  return false;
};
