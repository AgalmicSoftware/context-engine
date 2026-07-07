import type { PasskeyCredentialClient, PasskeyWalletConfig } from '../types.js';
import { base64URLToBuffer, randomBytes } from './encoding.js';
import { buildPrfExtension, getCredentialPrfOutput } from './prf.js';

const credentialClient = (): PasskeyCredentialClient => {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn credentials API is not available.');
  }
  return navigator.credentials;
};

export const authenticatePasskeyCredential = async ({
  config,
  credentialId,
  salt,
  credentials = credentialClient(),
}: {
  config: PasskeyWalletConfig;
  credentialId?: string;
  salt: Uint8Array;
  credentials?: PasskeyCredentialClient;
}): Promise<{ credential: PublicKeyCredential; prfOutput: ArrayBuffer }> => {
  if (typeof PublicKeyCredential === 'undefined') {
    throw new Error('WebAuthn is not supported in this browser.');
  }
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: randomBytes(32),
    rpId: config.rpId,
    userVerification: 'required',
    timeout: 60000,
    extensions: buildPrfExtension(salt),
  };
  if (credentialId) {
    publicKey.allowCredentials = [
      {
        id: base64URLToBuffer(credentialId),
        type: 'public-key',
        transports: ['internal', 'hybrid'],
      },
    ];
  }
  const credential = (await credentials.get({
    publicKey,
  } as CredentialRequestOptions)) as PublicKeyCredential | null;
  if (!credential) throw new Error('No passkey assertion was returned.');
  return { credential, prfOutput: getCredentialPrfOutput(credential) };
};
