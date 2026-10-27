const encoder = new TextEncoder();

// Domain-separated proof of key continuity; never return or log key material.
export const recoveryKeyFingerprint = async (secret) => {
  const raw = typeof secret === 'string' ? secret.trim() : '';
  const material = /^[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : raw;
  if (!material) throw new Error('Recovery key is missing.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('ce-kek-fingerprint-v1')));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
