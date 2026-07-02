jest.mock('../arweave/sponsoredBundles.js', () => ({
  buildSponsoredBundlePlaintext: jest.fn(),
  generateSponsoredBundleSecret: jest.fn(),
  hasSponsoredBundleFields: jest.fn(),
  uploadSponsoredBundle: jest.fn(async () => ({
    txId: 'tx-1',
    envelope: { encryptedData: 'ciphertext' },
    url: 'https://contextengine.xyz/new?sponsored=tx-1#k=secret',
  })),
}));

jest.mock('../web3/sessionRegistry.js', () => ({
  fetchSessionFromRegistry: jest.fn(),
  loadSessionRegistryCache: jest.fn(),
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:sessions-updated',
  sessionRegistryStore: {
    getAllSessionEntries: jest.fn(() => []),
  },
  sessionRegistryUtils: {
    normalizeSessionIdHex: jest.fn((value) => String(value)),
  },
  upsertSessionRegistryCache: jest.fn(),
}));

jest.mock('../worker/corsProxy.js', () => ({
  corsProxyUtils: {
    resolveCorsProxyUrl: jest.fn(async () => ({ url: 'https://worker.example' })),
  },
}));

jest.mock('../worker/workerAuth.js', () => ({
  buildSignedAdminActionAuth: jest.fn(),
  buildSignedBootstrapAdminAuth: jest.fn(async () => ({
    address: '0xabc',
    message: 'sign me',
    signature: '0xsig',
    sessionSlug: 'demo',
  })),
}));

import {
  buildSignedBootstrapAdminAuth,
  uploadSponsoredBundle,
} from './sponsorPageRuntime.js';

const mockedSponsoredBundles = jest.requireMock('../arweave/sponsoredBundles.js') as {
  uploadSponsoredBundle: jest.Mock;
};
const mockedWorkerAuth = jest.requireMock('../worker/workerAuth.js') as {
  buildSignedBootstrapAdminAuth: jest.Mock;
};

describe('sponsorPageRuntime', () => {
  beforeEach(() => {
    mockedWorkerAuth.buildSignedBootstrapAdminAuth.mockClear();
    mockedSponsoredBundles.uploadSponsoredBundle.mockClear();
  });

  it('delegates bootstrap auth and sponsored bundle uploads to the runtime implementations', async () => {
    const authInput = {
      slug: 'demo',
      workerUrl: 'https://worker.example',
      statement: 'Admin request: bootstrap arweave upload',
      context: {
        account: '0xabc',
        chainId: 11155420,
        providerLike: 'wagmi',
      },
    };
    await expect(buildSignedBootstrapAdminAuth(authInput)).resolves.toEqual({
      address: '0xabc',
      message: 'sign me',
      signature: '0xsig',
      sessionSlug: 'demo',
    });
    expect(mockedWorkerAuth.buildSignedBootstrapAdminAuth).toHaveBeenCalledWith(authInput);

    const uploadInput = {
      secret: 'secret',
      label: 'Sponsor bundle',
      workerUrl: 'https://worker.example',
      sessionSlug: 'demo',
      skipAuth: true,
      bundle: { openaiKey: 'sk-test' },
    };
    await expect(uploadSponsoredBundle(uploadInput)).resolves.toEqual({
      txId: 'tx-1',
      envelope: { encryptedData: 'ciphertext' },
      url: 'https://contextengine.xyz/new?sponsored=tx-1#k=secret',
    });
    expect(mockedSponsoredBundles.uploadSponsoredBundle).toHaveBeenCalledWith(uploadInput);
  });
});
