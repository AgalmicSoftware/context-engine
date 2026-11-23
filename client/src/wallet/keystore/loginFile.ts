import { Wallet } from 'ethers';
import type { HexString, LoginFileWalletRecord, PasskeyWalletConfig } from '../types.js';
import { base64URLToBuffer, bufferSourceToWebCryptoBufferSource, bufferToBase64URL } from '../passkey/encoding.js';

// A login file signs someone in where no passkey can: it holds a 12-word recovery phrase, the standard kind, and
// the account is the first Ethereum address of that phrase. Whoever holds the file holds the account.
const LOGIN_FILE_TYPE = 'context-engine-login-file';
/** How long a browser signs with a login file before it asks for the file again. */
export const LOGIN_FILE_HOURS = 6;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class LoginFileUnreadableError extends Error {
  constructor() {
    super('That is not a Context Engine login file.');
    this.name = 'LoginFileUnreadableError';
  }
}

export class LoginFileExpiredError extends Error {
  constructor() {
    // A page that was open when the hours ran out still shows the account, and that window has no file to
    // choose. A reload shows signed out, keeps the tab's unsent answers, and offers the file.
    super('Your login file is needed again. Reload the page, then log in with your file. Unsent answers are kept.');
    this.name = 'LoginFileExpiredError';
  }
}

export type LoginFile = { name: string; text: string; address: HexString };

export const createLoginFile = (now: Date = new Date()): LoginFile => {
  const wallet = Wallet.createRandom();
  const address = wallet.address as HexString;
  const text = JSON.stringify(
    {
      type: LOGIN_FILE_TYPE,
      version: 1,
      warning: 'Anyone who has this file can sign in as you. Keep it private. It cannot be replaced if lost.',
      address,
      recoveryPhrase: wallet.mnemonic.phrase,
      createdAt: now.toISOString(),
    },
    null,
    2,
  );
  return { name: `context-engine-login-${address.slice(2, 8).toLowerCase()}.json`, text, address };
};

const phraseOf = (text: string): string => {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('{')) return trimmed;
  const parsed = JSON.parse(trimmed) as { type?: unknown; recoveryPhrase?: unknown };
  if (parsed.type !== LOGIN_FILE_TYPE || typeof parsed.recoveryPhrase !== 'string') throw new Error('not a login file');
  return parsed.recoveryPhrase.trim();
};

/** Reads a login file, or the 12 words alone, into the account's key. */
export const readLoginFileKey = (text: string): { privateKey: HexString; address: HexString } => {
  try {
    const wallet = Wallet.fromMnemonic(phraseOf(text).toLowerCase().split(/\s+/).join(' '));
    return { privateKey: wallet.privateKey as HexString, address: wallet.address as HexString };
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
