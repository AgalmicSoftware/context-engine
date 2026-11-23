import { Wallet } from 'ethers';
import type { HexString, LoginFileWalletRecord, PasskeyWalletConfig } from '../types.js';
import { base64URLToBuffer, bufferSourceToWebCryptoBufferSource, bufferToBase64URL } from '../passkey/encoding.js';
import {
  LOGIN_FILE_DUE_TEXT,
  LOGIN_FILE_OTHER_ACCOUNT_TEXT,
  LOGIN_FILE_PASSWORD_NEEDED_TEXT,
  LOGIN_FILE_PASSWORD_WRONG_TEXT,
  LOGIN_FILE_UNREADABLE_TEXT,
} from '../../utilities/session/loginFileTexts';

// A login file signs someone in where no passkey can: it holds a 12-word recovery phrase, the standard kind, and
// the account is the first Ethereum address of that phrase. Whoever holds the file holds the account.
const LOGIN_FILE_TYPE = 'context-engine-login-file';
/** How long a browser signs with a login file before it asks for the file again. */
export const LOGIN_FILE_HOURS = 6;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export {
  LOGIN_FILE_OTHER_ACCOUNT_TEXT,
  LOGIN_FILE_PASSWORD_NEEDED_TEXT,
  LOGIN_FILE_PASSWORD_WRONG_TEXT,
  LOGIN_FILE_UNREADABLE_TEXT,
};

export class LoginFileUnreadableError extends Error {
  constructor() {
    super(LOGIN_FILE_UNREADABLE_TEXT);
    this.name = 'LoginFileUnreadableError';
  }
}

export class LoginFileExpiredError extends Error {
  constructor() {
    // A page that was open when the hours ran out still shows the account, and that window has no file to
    // choose. A reload shows signed out, keeps the tab's unsent answers, and offers the file.
    super(`${LOGIN_FILE_DUE_TEXT} Reload the page, then log in with your file. Unsent answers are kept.`);
    this.name = 'LoginFileExpiredError';
  }
}

/** The file opens another account than the one it was asked to sign back in. */
export class LoginFileOtherAccountError extends Error {
  constructor() {
    super(LOGIN_FILE_OTHER_ACCOUNT_TEXT);
    this.name = 'LoginFileOtherAccountError';
  }
}

/** The chosen file has a password, and none was given. */
export class LoginFilePasswordNeededError extends Error {
  constructor() {
    super(LOGIN_FILE_PASSWORD_NEEDED_TEXT);
    this.name = 'LoginFilePasswordNeededError';
  }
}

/** The password did not open the file. A file whose protected part was changed fails the same way. */
export class LoginFilePasswordWrongError extends Error {
  constructor() {
    super(LOGIN_FILE_PASSWORD_WRONG_TEXT);
    this.name = 'LoginFilePasswordWrongError';
  }
}

export type LoginFile = { name: string; text: string; address: HexString };

const FILE_WARNING = 'Anyone who has this file can sign in as you. Keep it private. It cannot be replaced if lost.';
const fileName = (address: string): string => `context-engine-login-${address.slice(2, 8).toLowerCase()}.json`;

export const createLoginFile = (now: Date = new Date()): LoginFile => {
  const wallet = Wallet.createRandom();
  const address = wallet.address as HexString;
  const text = JSON.stringify(
    {
      type: LOGIN_FILE_TYPE,
      version: 1,
      warning: FILE_WARNING,
      address,
      recoveryPhrase: wallet.mnemonic.phrase,
      createdAt: now.toISOString(),
    },
    null,
    2,
  );
  return { name: fileName(address), text, address };
};

// A login file with a password (version 2) holds its 12 words encrypted: the password is stretched with
// PBKDF2-SHA256 into an AES-GCM-256 key. The file records the method and its numbers, so they can be raised
// later and old files still open. The password is never stored: without it the words cannot be had from the file.
const PASSWORD_KDF = 'PBKDF2-SHA256';
const PASSWORD_CIPHER = 'AES-GCM-256';
/** OWASP's 2023 figure for PBKDF2-HMAC-SHA256. A tenth of a second on a fast laptop, more on a phone. */
export const LOGIN_FILE_PASSWORD_ITERATIONS = 600_000;
// A file's own figure is honoured within these: below, it would be no protection; above, it only stalls a phone.
const MIN_PASSWORD_ITERATIONS = 100_000;
const MAX_PASSWORD_ITERATIONS = 5_000_000;

type ProtectedPhrase = {
  kdf: typeof PASSWORD_KDF;
  iterations: number;
  salt: string;
  cipher: typeof PASSWORD_CIPHER;
  iv: string;
  ciphertext: string;
};

// The same password typed on another keyboard: composed and decomposed letters count as one.
const passwordBytes = (password: string): Uint8Array => textEncoder.encode(String(password).normalize('NFKC'));

const passwordKey = async (password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> => {
  if (!crypto.subtle) throw new Error('WebCrypto subtle API is not available.');
  const material = await crypto.subtle.importKey(
    'raw',
    bufferSourceToWebCryptoBufferSource(passwordBytes(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bufferSourceToWebCryptoBufferSource(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

/** A new login file whose 12 words are encrypted under `password`. An empty password is refused. */
export const createProtectedLoginFile = async (password: string, now: Date = new Date()): Promise<LoginFile> => {
  if (!passwordBytes(password).length) throw new Error('Enter a password for the login file.');
  const wallet = Wallet.createRandom();
  const address = wallet.address as HexString;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordKey(password, salt, LOGIN_FILE_PASSWORD_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bufferSourceToWebCryptoBufferSource(iv) },
    key,
    bufferSourceToWebCryptoBufferSource(textEncoder.encode(wallet.mnemonic.phrase)),
  );
  const encryptedRecoveryPhrase: ProtectedPhrase = {
    kdf: PASSWORD_KDF,
    iterations: LOGIN_FILE_PASSWORD_ITERATIONS,
    salt: bufferToBase64URL(salt),
    cipher: PASSWORD_CIPHER,
    iv: bufferToBase64URL(iv),
    ciphertext: bufferToBase64URL(ciphertext),
  };
  const text = JSON.stringify(
    {
      type: LOGIN_FILE_TYPE,
      version: 2,
      warning: `${FILE_WARNING} Its password cannot be recovered if forgotten.`,
      address,
      encryptedRecoveryPhrase,
      createdAt: now.toISOString(),
    },
    null,
    2,
  );
  return { name: fileName(address), text, address };
};

type ParsedLoginFile = {
  type?: unknown;
  address?: unknown;
  recoveryPhrase?: unknown;
  encryptedRecoveryPhrase?: unknown;
};

const parseLoginFile = (text: string): ParsedLoginFile | null => {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('{')) return null;
  const parsed = JSON.parse(trimmed) as ParsedLoginFile;
  if (!parsed || parsed.type !== LOGIN_FILE_TYPE) throw new Error('not a login file');
  return parsed;
};

const protectedPhraseOf = (parsed: ParsedLoginFile | null): ProtectedPhrase | null => {
  const part = parsed?.encryptedRecoveryPhrase as Partial<ProtectedPhrase> | undefined;
  if (!part || typeof part !== 'object') return null;
  const { kdf, iterations, salt, cipher, iv, ciphertext } = part;
  if (kdf !== PASSWORD_KDF || cipher !== PASSWORD_CIPHER) throw new Error('unknown protection');
  if (!Number.isInteger(iterations) || Number(iterations) < MIN_PASSWORD_ITERATIONS) throw new Error('weak protection');
  if (Number(iterations) > MAX_PASSWORD_ITERATIONS) throw new Error('unreasonable protection');
  if (typeof salt !== 'string' || typeof iv !== 'string' || typeof ciphertext !== 'string')
    throw new Error('incomplete');
  return { kdf, iterations: Number(iterations), salt, cipher, iv, ciphertext };
};

/** Whether the text is a login file that asks for a password. Anything unreadable is not. */
export const isLoginFileProtected = (text: string): boolean => {
  try {
    return !!protectedPhraseOf(parseLoginFile(text));
  } catch (_) {
    return false;
  }
};

const keyOfPhrase = (phrase: string): { privateKey: HexString; address: HexString } => {
  const wallet = Wallet.fromMnemonic(phrase.trim().toLowerCase().split(/\s+/).join(' '));
  return { privateKey: wallet.privateKey as HexString, address: wallet.address as HexString };
};

const phraseOf = (text: string): string => {
  const parsed = parseLoginFile(text);
  if (!parsed) return String(text || '');
  if (typeof parsed.recoveryPhrase !== 'string') throw new Error('not a login file');
  return parsed.recoveryPhrase;
};

/** Reads a login file without a password, or the 12 words alone, into the account's key. */
export const readLoginFileKey = (text: string): { privateKey: HexString; address: HexString } => {
  try {
    return keyOfPhrase(phraseOf(text));
  } catch (_) {
    throw new LoginFileUnreadableError();
  }
};

/**
 * Opens any login file into the account's key: one without a password as `readLoginFileKey` does, one with a
 * password by that password. A wrong password and a protected part that was changed fail alike, as the cipher
 * cannot tell them apart; a file that opens to another account than the one it names is refused as unreadable.
 */
export const openLoginFile = async (
  text: string,
  password?: string,
): Promise<{ privateKey: HexString; address: HexString }> => {
  let parsed: ParsedLoginFile | null;
  let part: ProtectedPhrase | null;
  try {
    parsed = parseLoginFile(text);
    part = protectedPhraseOf(parsed);
  } catch (_) {
    throw new LoginFileUnreadableError();
  }
  if (!part) return readLoginFileKey(text);
  if (!passwordBytes(password || '').length) throw new LoginFilePasswordNeededError();
  let phrase: string;
  try {
    const key = await passwordKey(password || '', new Uint8Array(base64URLToBuffer(part.salt)), part.iterations);
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bufferSourceToWebCryptoBufferSource(base64URLToBuffer(part.iv)) },
      key,
      bufferSourceToWebCryptoBufferSource(base64URLToBuffer(part.ciphertext)),
    );
    phrase = textDecoder.decode(opened);
  } catch (_) {
    throw new LoginFilePasswordWrongError();
  }
  try {
    const opened = keyOfPhrase(phrase);
    const named = typeof parsed?.address === 'string' ? parsed.address.toLowerCase() : '';
    if (named && named !== opened.address.toLowerCase()) throw new Error('names another account');
    return opened;
  } catch (_) {
    throw new LoginFileUnreadableError();
  }
};

// Between uploads the key rests in the browser's database, encrypted under a key the browser will not export
// (non-extractable), and it is wiped once `expiresAt` passes. That keeps the key and the 12 words out of anything
// that reads storage as text. It is no guard against a script running in this origin: the sealing key sits
// beside the sealed key, so such a script can ask the browser to open it and take the account's key for good,
// where with a passkey it could only ask for signatures while the wallet is unlocked. Nor is it a guard against
// a copy of the browser's profile.
export const sealLoginFileKey = async ({
  privateKey,
  address,
  config,
  now,
}: {
  privateKey: HexString;
  address: HexString;
  config: PasskeyWalletConfig;
  now: number;
}): Promise<LoginFileWalletRecord> => {
  if (!crypto.subtle) throw new Error('WebCrypto subtle API is not available.');
  const sealKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bufferSourceToWebCryptoBufferSource(iv) },
    sealKey,
    bufferSourceToWebCryptoBufferSource(textEncoder.encode(privateKey)),
  );
  const timestamp = new Date(now).toISOString();
  return {
    id: `login-file:${config.rpId}:${address.toLowerCase()}`,
    rpId: config.rpId,
    credentialId: '',
    evmAddress: address,
    keyMode: 'login-file',
    sealKey,
    sealedKey: bufferToBase64URL(sealed),
    iv: bufferToBase64URL(iv),
    expiresAt: now + LOGIN_FILE_HOURS * 60 * 60 * 1000,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

/** Whether the record still holds a key that may be used at `now`. */
export const isLoginFileKeyUsable = (record: LoginFileWalletRecord, now: number): boolean =>
  !!record.sealKey && !!record.sealedKey && !!record.iv && record.expiresAt > now;

/** The record with its key gone: what is left says only that this browser's account was a login file's. */
export const wipeLoginFileKey = (record: LoginFileWalletRecord, now: number): LoginFileWalletRecord => {
  const { sealKey: _sealKey, sealedKey: _sealedKey, iv: _iv, ...rest } = record;
  return { ...rest, updatedAt: new Date(now).toISOString() };
};

export const openLoginFileKey = async (record: LoginFileWalletRecord): Promise<HexString> => {
  if (!crypto.subtle) throw new Error('WebCrypto subtle API is not available.');
  if (!record.sealKey || !record.sealedKey || !record.iv) throw new LoginFileExpiredError();
  const opened = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bufferSourceToWebCryptoBufferSource(base64URLToBuffer(record.iv)) },
    record.sealKey,
    bufferSourceToWebCryptoBufferSource(base64URLToBuffer(record.sealedKey)),
  );
  return textDecoder.decode(opened) as HexString;
};
