import type { PasskeyWalletConfig } from '../types.js';
import type { PasskeyCredentialClient } from '../types.js';
import { buildPrfExtension, getCredentialPrfEnabled } from './prf.js';
import { randomBytes } from './encoding.js';

const credentialClient = (): PasskeyCredentialClient => {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn credentials API is not available.');
  }
  return navigator.credentials;
};

const userIdBytes = (value: string): Uint8Array => new TextEncoder().encode(value).slice(0, 64);

export const formatPasskeyCredentialUserName = (date = new Date()): string => {
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/[:\s]/g, '');
  return `ContextEngine-${month}${day}-${year}-${time}`;
};

export const createPasskeyCredential = async ({
  config,
  salt,
  credentials = credentialClient(),
}: {
  config: PasskeyWalletConfig;
  salt: Uint8Array;
  credentials?: PasskeyCredentialClient;
}): Promise<PublicKeyCredential> => {
  if (typeof PublicKeyCredential === 'undefined') {
    throw new Error('WebAuthn is not supported in this browser.');
  }
  const userName = formatPasskeyCredentialUserName();
  const credential = (await credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: config.rpName, id: config.rpId },
      user: {
        id: userIdBytes(userName),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
      extensions: buildPrfExtension(salt),
    },
  } as CredentialCreationOptions)) as PublicKeyCredential | null;
  if (!credential) throw new Error('No passkey credential was created.');
  if (!getCredentialPrfEnabled(credential)) {
    throw new Error('This passkey does not advertise WebAuthn PRF support.');
  }
  return credential;
};
