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
});
