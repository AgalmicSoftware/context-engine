const SECRET_FIELD_RE = /(?:privatekey|private_key|worker.?token|bearer|jwt|authorization|secret|signature|mnemonic|seed|password|signingmaterial|rootsecret|demo.?key)/i;
const SECRET_VALUE_RE = /(?:bearer\s+[a-z0-9._:-]+|\bceagt_[A-Za-z0-9_-]{20,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b|eyj[a-z0-9_-]*\.[a-z0-9_-]*\.|0x[0-9a-f]{64}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;
const SAFE_HASH_VALUE_KEYS = new Set([
  'questionid',
  'statement_id',
  'statementid',
  'contenthash',
  'hash',
  'txhash',
  'payloadhash',
  'responsehash',
  'surveyresponsehash',
]);
const SAFE_HASH_VALUE_CONTAINER_KEYS = new Set([
  'numbertoquestionid',
  'legacycursorstatementids',
]);
const SAFE_AUTHORITY_METADATA_KEYS = new Set([
  'privatekeyauthority',
  'workertokenauthority',
  'longlivedbearerauthority',
  'signingauthority',
]);

const lower = (value) => String(value || '').trim().toLowerCase();

function isSafeHashValuePath(path = []) {
  const key = lower(path[path.length - 1]);
  if (SAFE_HASH_VALUE_KEYS.has(key)) return true;
  const parentKey = lower(path[path.length - 2]);
  return SAFE_HASH_VALUE_CONTAINER_KEYS.has(parentKey);
}

export function hasSecretShape(value, path = []) {
  if (Array.isArray(value)) {
    return value.some((entry, index) => hasSecretShape(entry, [...path, String(index)]));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, entry]) => {
      const normalizedKey = lower(key);
      if (SECRET_FIELD_RE.test(key) && !(SAFE_AUTHORITY_METADATA_KEYS.has(normalizedKey) && entry === false)) {
        return true;
      }
      return hasSecretShape(entry, [...path, key]);
    });
  }
  if (typeof value === 'string') {
    return !isSafeHashValuePath(path) && SECRET_VALUE_RE.test(value);
  }
  return false;
}

export function redactSecrets(value, path = []) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => redactSecrets(entry, [...path, String(index)]));
  }
  if (typeof value === 'string') {
    return !isSafeHashValuePath(path) && SECRET_VALUE_RE.test(value) ? '[redacted]' : value;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    SECRET_FIELD_RE.test(key) && !(SAFE_AUTHORITY_METADATA_KEYS.has(lower(key)) && entry === false)
      ? '[redacted]'
      : redactSecrets(entry, [...path, key]),
  ]));
}

export function assertNoSecretShape(value, message = 'Agent bridge records must not serialize secrets.') {
  if (hasSecretShape(value)) {
    throw new Error(message);
  }
  return value;
}

export function sanitizeForGroup(value) {
  const sanitized = redactSecrets(value);
  assertNoSecretShape(sanitized, 'Group-safe summaries must not contain secrets.');
  return sanitized;
}

export function safeJson(value) {
  return JSON.stringify(redactSecrets(value));
}
