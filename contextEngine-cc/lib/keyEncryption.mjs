import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname } from 'path';
import { hostname, userInfo } from 'os';

const ENCRYPTED_FILE_VERSION = 1;
const FILE_MODE = 0o600;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function getMachineIdentity(options = {}) {
  if (options.machineIdentity != null) {
    return String(options.machineIdentity);
  }

  const host = options.hostname ?? hostname();
  let username = options.username;
  if (username == null) {
    try {
      username = userInfo().username;
    } catch {
      username = process.env.USER || process.env.USERNAME || 'unknown';
    }
  }

  return `${String(host)}:${String(username)}`;
}

function normalizeBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(String(value ?? ''), 'utf8');
}

function isHexString(value, byteLength) {
  if (typeof value !== 'string') return false;
  if (!/^[0-9a-f]*$/i.test(value)) return false;
  return byteLength == null ? true : value.length === byteLength * 2;
}

function isEncryptedPayloadShape(value) {
  return !!value
    && typeof value === 'object'
    && value.version === ENCRYPTED_FILE_VERSION
    && isHexString(value.salt, SALT_LENGTH)
    && isHexString(value.iv, IV_LENGTH)
    && isHexString(value.tag, 16)
    && isHexString(value.ciphertext);
}

function deriveKey(salt, options = {}) {
  return scryptSync(getMachineIdentity(options), salt, KEY_LENGTH);
}

function toEncryptedPayload(plaintext, options = {}) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(salt, options);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalizeBuffer(plaintext)), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: ENCRYPTED_FILE_VERSION,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

function parseEncryptedFile(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return isEncryptedPayloadShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSecureFile(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, data, { mode: FILE_MODE });
  chmodSync(filePath, FILE_MODE);

  if (process.platform !== 'win32') {
    const mode = statSync(filePath).mode & 0o777;
    if (mode !== FILE_MODE) {
      throw new Error(`Failed to secure permissions for ${filePath} (mode ${mode.toString(8)})`);
    }
  }
}

export function encryptToFile(filePath, plaintext, options = {}) {
  const payload = toEncryptedPayload(plaintext, options);
  writeSecureFile(filePath, JSON.stringify(payload, null, 2));
  return payload;
}

export function decryptFromFile(filePath, options = {}) {
  if (!existsSync(filePath)) return null;

  const payload = parseEncryptedFile(filePath);
  if (!payload) return null;

  try {
    const salt = Buffer.from(payload.salt, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');
    const key = deriveKey(salt, options);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
}

export function isEncryptedFile(filePath) {
  if (!existsSync(filePath)) return false;
  return parseEncryptedFile(filePath) !== null;
}

export function migrateToEncrypted(filePath, options = {}) {
  if (!existsSync(filePath) || isEncryptedFile(filePath)) return false;
  const plaintext = readFileSync(filePath);
  encryptToFile(filePath, plaintext, options);
  return true;
}
