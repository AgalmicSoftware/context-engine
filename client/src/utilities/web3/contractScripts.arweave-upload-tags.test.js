import { getChainById } from '../../variables/chains.js';
import { ethers } from 'ethers';
import { getEffectiveArweaveKey } from '../session/resourceKeys.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { buildSiweMessage } from '../worker/workerAuth.js';
import { __test__contractScriptsArweaveUploads } from './chainGateway.js';

jest.mock('../session/resourceKeys.js', () => ({
  getEffectiveArweaveKey: jest.fn(),
}));

jest.mock('../worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
}));

jest.mock('../worker/workerAuth.js', () => {
  const actual = jest.requireActual('../worker/workerAuth.js');
  return {
    ...actual,
    fetchWorkerWithAuth: jest.fn(),
  };
});

describe('contractScripts Arweave upload tags', () => {
  const { buildArweaveUploadTags, resolveArweaveUploadOpts } = __test__contractScriptsArweaveUploads;
  const surveyAddress = '0x0000000000000000000000000000000000000001';

  beforeEach(() => {
    getEffectiveArweaveKey.mockReset();
    getCorsProxyUrlOrThrow.mockReset();
  });

  it('builds worker-compatible CE tags from canonical session config fields', () => {
    const cfg = {
      slug: 'demo-session',
      networkChainId: 84532,
      contracts: {
        surveys: {
          address: surveyAddress,
        },
      },
    };

    expect(buildArweaveUploadTags(cfg, cfg.slug)).toEqual([
      { name: 'CE-SessionSlug', value: 'demo-session' },
      { name: 'CE-ChainId', value: '84532' },
      { name: 'CE-ContractAddress', value: surveyAddress },
      { name: 'CE-Network', value: getChainById(84532)?.name || '' },
    ]);
  });

  it('omits invalid or reserved tag names when session metadata is incomplete', () => {
    const tags = buildArweaveUploadTags(
      {
        networkChainId: 0,
        contracts: {
          surveys: {
            address: 'not-an-address',
          },
        },
        network: {
          name: '   ',
        },
      },
      '',
    );

    expect(tags).toEqual([]);
    expect(tags.find((tag) => tag.name === 'App-Name')).toBeUndefined();
  });

  it('keeps CE tags intact when Arweave key resolution fails', async () => {
    getEffectiveArweaveKey.mockRejectedValue(new Error('missing key'));
    const cfg = {
      slug: 'demo-session',
      networkChainId: 84532,
      contracts: {
        surveys: {
          address: surveyAddress,
        },
      },
    };

    const result = await resolveArweaveUploadOpts(cfg);

    expect(result).toEqual(
      expect.objectContaining({
        arweaveJwk: '',
        sessionSlug: 'demo-session',
        sessionConfig: cfg,
        tags: [
          { name: 'CE-SessionSlug', value: 'demo-session' },
          { name: 'CE-ChainId', value: '84532' },
          { name: 'CE-ContractAddress', value: surveyAddress },
          { name: 'CE-Network', value: getChainById(84532)?.name || '' },
        ],
      }),
    );
    expect(result.tags.every((tag) => tag.name.startsWith('CE-'))).toBe(true);
  });

  it('adds signed bootstrap auth when a local arweaveJwk is available and a signer is provided', async () => {
    const cfg = {
      slug: 'demo-session',
      networkChainId: 84532,
      contracts: {
        surveys: {
          address: surveyAddress,
        },
      },
    };
    const signer = ethers.Wallet.createRandom();
    const originalFetch = global.fetch;

    getEffectiveArweaveKey.mockResolvedValue({ arweaveJwk: '{"kty":"RSA"}' });
    getCorsProxyUrlOrThrow.mockResolvedValue('https://worker.example');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'nonce-1' }),
    });

    try {
      const result = await resolveArweaveUploadOpts(cfg, {
        providerLike: 'wagmi',
        signer,
      });

      expect(result).toEqual(
        expect.objectContaining({
          arweaveJwk: '{"kty":"RSA"}',
          sessionSlug: 'demo-session',
          skipAuth: true,
          adminAuth: {
            address: signer.address,
            message: expect.stringContaining('Admin request: bootstrap arweave upload'),
            signature: expect.any(String),
            sessionSlug: 'demo-session',
          },
        }),
      );
      expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionSlug: 'demo-session',
          sessionConfig: cfg,
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://worker.example/auth/nonce',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('forces direct Arweave upload when the effective key is explicitly local', async () => {
    const cfg = {
      slug: 'demo-session',
      networkChainId: 84532,
      contracts: {
        surveys: {
          address: surveyAddress,
        },
      },
    };
    const signer = ethers.Wallet.createRandom();

    getEffectiveArweaveKey.mockResolvedValue({
      arweaveJwk: '{"kty":"RSA"}',
      source: 'local',
    });

    const result = await resolveArweaveUploadOpts(cfg, {
      providerLike: 'wagmi',
      signer,
    });

    expect(result).toEqual(
      expect.objectContaining({
        arweaveJwk: '{"kty":"RSA"}',
        sessionSlug: 'demo-session',
        skipAuth: true,
        forceDirectArweaveUpload: true,
      }),
    );
    expect(result.adminAuth).toBeUndefined();
    expect(getCorsProxyUrlOrThrow).not.toHaveBeenCalled();
  });
});
