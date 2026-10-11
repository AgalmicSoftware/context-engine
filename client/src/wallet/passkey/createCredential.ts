import type { PasskeyWalletConfig } from '../types.js';
import type { PasskeyCredentialClient } from '../types.js';
import { buildPrfExtension, getCredentialPrfEnabled } from './prf.js';
import { base64URLToBuffer, randomBytes } from './encoding.js';

const credentialClient = (): PasskeyCredentialClient => {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn credentials API is not available.');
  }
  return navigator.credentials;
};

export const formatPasskeyCredentialUserName = (date = new Date()): string => {
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/[:\s]/g, '');
  return `ContextEngine-${month}${day}-${year}-${time}`;
};

const isInvalidStateError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'InvalidStateError';

export const createPasskeyCredential = async ({
  config,
  salt,
  credentials = credentialClient(),
  excludeCredentialIds = [],
}: {
  config: PasskeyWalletConfig;
  salt: Uint8Array;
  credentials?: PasskeyCredentialClient;
  excludeCredentialIds?: string[];
}): Promise<PublicKeyCredential> => {
  if (typeof PublicKeyCredential === 'undefined') {
    throw new Error('WebAuthn is not supported in this browser.');
  }
  const userName = formatPasskeyCredentialUserName();
  const excludeCredentials = excludeCredentialIds.map((id) => ({
    id: base64URLToBuffer(id),
    type: 'public-key' as const,
  }));
  let credential: PublicKeyCredential | null;
  try {
    credential = (await credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: config.rpName, id: config.rpId },
        // A random handle per wallet: authenticators replace a passkey whose
        // handle repeats, which would lose the wallet derived from it.
        user: {
          id: randomBytes(32),
          name: userName,
          displayName: userName,
        },
        ...(excludeCredentials.length ? { excludeCredentials } : {}),
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
  } catch (error) {
    if (excludeCredentials.length && isInvalidStateError(error)) {
      throw new Error('This device already holds the passkey for the wallet saved in this browser. Use Login.');
    }
    throw error;
  }
  if (!credential) throw new Error('No passkey credential was created.');
  if (!getCredentialPrfEnabled(credential)) {
    throw new Error('This passkey does not advertise WebAuthn PRF support.');
  }
  return credential;
};
