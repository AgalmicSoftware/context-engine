import type { PasskeyWalletConfig } from '../types.js';
import { authenticatePasskeyCredential } from './authenticateCredential.js';

const config = { rpId: 'contextengine.sh' } as PasskeyWalletConfig;
const assertion = { getClientExtensionResults: () => ({ prf: { results: { first: new ArrayBuffer(32) } } }) };

describe('authenticatePasskeyCredential with the browser’s passkeys', () => {
  const get = jest.fn(async () => assertion);
  const original = Object.getOwnPropertyDescriptor(navigator, 'credentials');
  beforeEach(() => {
    (globalThis as any).PublicKeyCredential = function PublicKeyCredential() {};
    get.mockClear();
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get, create: jest.fn() } });
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'credentials', original);
    else delete (navigator as any).credentials;
    jest.restoreAllMocks();
  });

  it('waits for the page to be in front before asking for a passkey', async () => {
    jest.spyOn(document, 'hasFocus').mockReturnValue(false);
    const result = authenticatePasskeyCredential({ config, salt: new Uint8Array(32) });
    await Promise.resolve();
    expect(get).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('focus'));
    await expect(result).resolves.toMatchObject({ credential: assertion });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('asks at once when the page is already in front', async () => {
    jest.spyOn(document, 'hasFocus').mockReturnValue(true);
    await authenticatePasskeyCredential({ config, salt: new Uint8Array(32) });
    expect(get).toHaveBeenCalledTimes(1);
  });

  // A passkey kept on a phone still signs in, through the browser's own "use a phone" choice: Login names no kind of
  // device, and a saved passkey is asked for over the phone's transport as well as this device's.
  it('leaves a passkey kept on a phone reachable from the browser’s prompt', async () => {
    jest.spyOn(document, 'hasFocus').mockReturnValue(true);
    await authenticatePasskeyCredential({ config, salt: new Uint8Array(32) });
    await authenticatePasskeyCredential({ config, salt: new Uint8Array(32), credentialId: 'AQID' });
    const [[any], [saved]] = get.mock.calls as unknown as Array<[CredentialRequestOptions]>;
    expect(any.publicKey).not.toHaveProperty('allowCredentials');
    expect(any.publicKey).not.toHaveProperty('hints');
    expect(saved.publicKey?.allowCredentials?.map(({ transports }) => transports)).toEqual([['internal', 'hybrid']]);
  });
});
