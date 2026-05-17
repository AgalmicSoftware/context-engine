import { cryptoUtils } from './cryptography.js';

const mockCreatePortoProvider = jest.fn();

jest.mock('../web3/portoFunctions.js', () => ({
  createPortoProviderMock: (...args) => mockCreatePortoProvider(...args),
}));

describe('cryptoUtils Porto provider bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePortoProvider.mockReset();
    try {
      delete window.__portoMockProvider;
      delete window.__ceCreatePortoProviderMock;
    } catch (_) {
      window.__portoMockProvider = undefined;
      window.__ceCreatePortoProviderMock = undefined;
    }
  });

  it('uses the Vite-safe Porto provider factory when one is registered on window', () => {
    const provider = {
      isPorto: true,
      request: jest.fn(),
    };
    window.__ceCreatePortoProviderMock = jest.fn(() => provider);

    const resolved = cryptoUtils._getProvider('porto_passkey');

    expect(resolved).toBe(provider);
    expect(window.__ceCreatePortoProviderMock).toHaveBeenCalledTimes(1);
    expect(mockCreatePortoProvider).not.toHaveBeenCalled();
    expect(window.__portoMockProvider).toBe(provider);
  });

  it('synthesizes the Porto provider on demand for porto_passkey strings', () => {
    const provider = {
      isPorto: true,
      request: jest.fn(),
    };
    mockCreatePortoProvider.mockReturnValue(provider);

    const resolved = cryptoUtils._getProvider('porto_passkey');

    expect(resolved).toBe(provider);
    expect(mockCreatePortoProvider).toHaveBeenCalledTimes(1);
    expect(window.__portoMockProvider).toBe(provider);
  });

  it('reuses the seeded Porto provider when one is already present on window', () => {
    const seededProvider = {
      isPorto: true,
      request: jest.fn(),
    };
    window.__portoMockProvider = seededProvider;

    const resolved = cryptoUtils._getProvider('porto_passkey');

    expect(resolved).toBe(seededProvider);
    expect(mockCreatePortoProvider).not.toHaveBeenCalled();
  });
});
