import type { PasskeyCredentialClient, PasskeyWalletConfig } from '../types.js';
import { PasskeysUnavailableError } from './unavailable.js';
import { base64URLToBuffer, randomBytes } from './encoding.js';
import { buildPrfExtension, getCredentialPrfOutput } from './prf.js';

// Browsers refuse a passkey prompt from a page that is not in front (WebKit: "The document is not focused."), as a
// page opened in a new tab can be when its sign-in starts on load. Wait until it is in front, rather than fail.
const whenDocumentFocused = (): Promise<void> =>
  document.hasFocus()
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener('focus', () => resolve(), { once: true }));

const credentialClient = (): PasskeyCredentialClient => {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new PasskeysUnavailableError();
  }
  const { credentials } = navigator;
  return {
    create: (options) => credentials.create(options),
    get: async (options) => {
      await whenDocumentFocused();
      return credentials.get(options);
    },
  };
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
    throw new PasskeysUnavailableError();
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
