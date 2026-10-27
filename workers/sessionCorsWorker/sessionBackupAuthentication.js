const encoder = new TextEncoder();
const pageBytes = (page) => encoder.encode(JSON.stringify({ ...page, authentication: undefined }, (_, value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value));

const backupKey = async (secret, label) => {
  const raw = String(secret || '').trim();
  if (!raw) throw new Error('Backup recovery key is missing.');
  const material = /^[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : raw;
  const deploymentKey = await crypto.subtle.importKey('raw', encoder.encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const derived = await crypto.subtle.sign('HMAC', deploymentKey, encoder.encode(label));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
};

export const signBackupPage = async (page, env) => {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await backupKey(env.CE_STORAGE_ENVELOPE_KEK, 'ce-backup-page-v1'), pageBytes(page)));
  return { ...page, authentication: { version: 1, mac: [...mac].map((byte) => byte.toString(16).padStart(2, '0')).join('') } };
};

export const verifyBackupPage = async (page, env) => {
  const authentication = page?.authentication;
  if (authentication?.version !== 1 || !/^[a-f0-9]{64}$/.test(authentication.mac || '')) return false;
  const mac = Uint8Array.from(authentication.mac.match(/../g), (pair) => parseInt(pair, 16));
  const bytes = pageBytes(page);
  for (const secret of [env.CE_STORAGE_ENVELOPE_KEK, env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK].filter(Boolean)) {
    if (await crypto.subtle.verify('HMAC', await backupKey(secret, 'ce-backup-page-v1'), mac, bytes)) return true;
  }
  return false;
};

export const signBackupCursor = async (cursor, env) => {
  const key = await backupKey(env.CE_STORAGE_ENVELOPE_KEK, 'ce-backup-cursor-v1');
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(cursor)));
  return `${cursor}.${[...mac].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
};

export const authenticateBackupCursor = async (cursor, env) => {
  const match = typeof cursor === 'string' && cursor.length <= 8257
    ? cursor.match(/^([A-Za-z0-9_-]{1,8192})\.([a-f0-9]{64})$/) : null;
  if (match) {
    const mac = Uint8Array.from(match[2].match(/../g), (pair) => parseInt(pair, 16));
    const key = await backupKey(env.CE_STORAGE_ENVELOPE_KEK, 'ce-backup-cursor-v1');
    if (await crypto.subtle.verify('HMAC', key, mac, encoder.encode(match[1]))) return match[1];
  }
  throw Object.assign(new Error('Backup cursor authentication failed. Restart the export.'),
    { status: 403, reason: 'backup_cursor_authentication_failed' });
};
