import { lower } from './runtimePrimitives.mjs';

const SECRET_FIELD_RE = /(?:privatekey|private_key|worker.?token|bearer|jwt|authorization|secret|signature|mnemonic|seed|password|signingmaterial|rootsecret|demo.?key)/i;
const SECRET_VALUE_RE = /(?:bearer\s+[a-z0-9._:-]+|\bceagt_[A-Za-z0-9_-]{20,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b|eyj[a-z0-9_-]*\.[a-z0-9_-]*\.|0x[0-9a-f]{64}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;
const SAFE_HASH_VALUE_KEYS = new Set([
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
  'runstatementids',
]);
const SAFE_AUTHORITY_METADATA_KEYS = new Set([
  'privatekeyauthority',
  'workertokenauthority',
  'longlivedbearerauthority',
  'signingauthority',
]);

const QUESTION_ID_RE = /^0x[0-9a-f]{64}$/i;
const STORAGE_ID_RE = /^[A-Za-z0-9_-]{43}$/;
const STORAGE_URI_RE = /^(?:\/storage\/read\?id=|ar:\/\/|lit-arweave:\/\/)[A-Za-z0-9_-]{43}$/;

// Question ids are public bytes32 hashes, the same shape as a private key, so
// fields named for them (lastQuestionId, servedQuestionIds) may hold exactly
// that shape, and nothing else that looks like a secret.
function isSafeHashValue(value, path = []) {
  const key = lower(path[path.length - 1]);
  const parentKey = lower(path[path.length - 2]);
  if (SAFE_HASH_VALUE_KEYS.has(key) || SAFE_HASH_VALUE_CONTAINER_KEYS.has(parentKey)) return true;
  // A storage id, like an Arweave transaction id, is 32 random bytes in
  // base64url, which now and then spell `sk-` and 20 more characters, an API
  // key's shape. A stored answer's reference may hold exactly that id, which
  // is shorter than such a key.
  if (key === 'storageid' || key === 'arweavetxid' || (parentKey === 'storageref' && key === 'id')) return STORAGE_ID_RE.test(value);
  if (parentKey === 'storageref' && key === 'uri') return STORAGE_URI_RE.test(value);
  return (key.endsWith('questionid') || parentKey.endsWith('questionids')) && QUESTION_ID_RE.test(value);
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
    return !isSafeHashValue(value, path) && SECRET_VALUE_RE.test(value);
  }
  return false;
}

export function redactSecrets(value, path = []) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => redactSecrets(entry, [...path, String(index)]));
  }
  if (typeof value === 'string') {
    return !isSafeHashValue(value, path) && SECRET_VALUE_RE.test(value) ? '[redacted]' : value;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    SECRET_FIELD_RE.test(key) && !(SAFE_AUTHORITY_METADATA_KEYS.has(lower(key)) && entry === false)
      ? '[redacted]'
      : redactSecrets(entry, [...path, key]),
  ]));
}

export function assertNoSecretShape(value, message = 'Agent records must not serialize secrets.') {
  if (hasSecretShape(value)) {
    throw new Error(message);
  }
  return value;
}
