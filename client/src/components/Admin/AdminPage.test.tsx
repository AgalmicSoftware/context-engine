/** @file AdminPage.test.tsx */
import AdminPage, { __adminPageTestUtils } from './AdminPage';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { getDefaultHttpRpc, getSessionRegistryAddress } from '../../variables/chains.js';

const DEFAULT_CONFIG_CHAIN_ID = DEFAULT_CHAIN_ID;
const adminPageTestUtils = __adminPageTestUtils as any;

describe('AdminPage', () => {
  it('exports a component', () => {
    expect(typeof AdminPage).toBe('function');
  });
  it('keeps the open-session display URL when group metadata is available without a selected config', () => {
    expect(
      adminPageTestUtils.getAdminSessionDisplayUrl({
        selectedSlug: 'debate',
        selectedConfig: null,
        groupMetadata: { slug: 'rxc', sessionName: 'Debate Session' },
      }),
    ).toBe('http://localhost/session/rxc');
    expect(
      adminPageTestUtils.getAdminSessionDisplayUrl({
        selectedSlug: '',
        selectedConfig: null,
        groupMetadata: { slug: '', sessionName: 'Context Engine' },
      }),
    ).toBe('http://localhost/session');

    expect(
      adminPageTestUtils.getAdminSessionDisplayUrl({
        selectedSlug: 'missing-session-slug',
        selectedConfig: null,
        groupMetadata: null,
      }),
    ).toBe('');
  });

  it('builds worker config payload with registry/rpc fallbacks from chain defaults', () => {
    const payload = adminPageTestUtils.buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'test-3',
        networkChainId: DEFAULT_CONFIG_CHAIN_ID,
        __registry: {
          chainId: DEFAULT_CONFIG_CHAIN_ID,
          adminAddress: '0x7384f81c5505Cb11F69607e3b293AD7AAf1b1119',
        },
      },
      account: '0x7384f81c5505Cb11F69607e3b293AD7AAf1b1119',
      fallbackChainId: DEFAULT_CONFIG_CHAIN_ID,
    });

    expect(payload.registryAddress).toBe(getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID));
    expect(payload.rpcUrl).toBe(getDefaultHttpRpc(DEFAULT_CONFIG_CHAIN_ID));
    expect(payload.rpcUrlsByChainId).toEqual(
      expect.objectContaining({
        [String(DEFAULT_CONFIG_CHAIN_ID)]: [getDefaultHttpRpc(DEFAULT_CONFIG_CHAIN_ID)],
      }),
    );
  });

  it('includes normalized blockLimits in worker config payload', () => {
    const payload = adminPageTestUtils.buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'test-8',
        networkChainId: 84532,
        blockLimits: {
          start: '12345',
          end: '13000',
        },
      },
      account: '0x7384f81c5505Cb11F69607e3b293AD7AAf1b1119',
      fallbackChainId: 84532,
    });

    expect(payload.blockLimits).toEqual({
      start: 12345,
      end: 13000,
    });
  });

  it('resolves the faucet resource RPC from the session chain instead of the registry chain', () => {
    const rpcConfig = adminPageTestUtils.getSessionReadRpcConfig({
      sessionConfig: {
        slug: 'test-resource-rpc',
        networkChainId: 8453,
        __registry: {
          chainId: 84532,
          registryChainId: 84532,
        },
        rpcUrlsByChainId: {
          8453: ['https://base-mainnet.example'],
          84532: ['https://base-sepolia.example'],
        },
      },
      fallbackChainId: 84532,
    });

    expect(rpcConfig).toEqual({
      chainId: 8453,
      rpcUrl: 'https://base-mainnet.example',
    });
  });

  it('falls back to the first non-empty rpcUrlsByChainId map after sanitization', () => {
    const rpcConfig = adminPageTestUtils.getSessionReadRpcConfig({
      sessionConfig: {
        slug: 'test-resource-rpc-fallback',
        networkChainId: 8453,
        rpc: {
          providers: {
            path: {
              rpcUrlsByChainId: {},
            },
          },
          rpcUrlsByChainId: {
            8453: ['https://base-mainnet-root.example'],
          },
        },
        rpcUrlsByChainId: {
          8453: ['https://base-mainnet-config.example'],
        },
      },
      fallbackChainId: 84532,
    });

    expect(rpcConfig).toEqual({
      chainId: 8453,
      rpcUrl: 'https://base-mainnet-root.example',
    });
  });

  it('classifies gated health + unsupported auth login route as an explicit compatibility mismatch', () => {
    const mismatch = adminPageTestUtils.buildHealthAuthMismatchState({
      unauthStatus: 401,
      unauthError: 'Unauthorized',
      authError: 'Worker auth login route not supported (404).',
    });

    expect(mismatch).toEqual({
      healthLabel: 'Auth required: Unauthorized; /auth/login unsupported (404)',
      statusMessage: 'Health endpoint is gated, but this worker URL does not expose /auth/login.',
    });
  });

  it('does not classify unrelated auth failures as route compatibility mismatches', () => {
    const mismatch = adminPageTestUtils.buildHealthAuthMismatchState({
      unauthStatus: 401,
      unauthError: 'Unauthorized',
      authError: 'Worker login failed (500).',
    });

    expect(mismatch).toBeNull();
  });
});
