import {
  buildAdminArweaveBalanceResource,
  buildAdminArweaveEmptyResource,
  buildAdminArweaveErrorResource,
  buildAdminArweaveInvalidResource,
  buildAdminArweaveLoadingResource,
  buildAdminFaucetBalanceResource,
  buildAdminFaucetEmptyResource,
  buildAdminFaucetErrorResource,
  buildAdminFaucetInvalidResource,
  buildAdminFaucetLoadingResource,
  buildAdminFaucetRpcUnavailableResource,
  buildAdminLitErrorResource,
  buildAdminLitLoadingResource,
  buildAdminLitNotConfiguredResource,
  buildAdminLitStatusNotLoadedResource,
  buildAdminLitStatusResource,
  buildAdminLitUnavailableResource,
  getAdminLitResourceLabel,
} from './adminPageResourceDisplayHelpers';

const shortAddress = (address: unknown) => {
  const value = String(address || '');
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '';
};

describe('adminPageResourceDisplayHelpers', () => {
  it('builds Arweave resource display states', () => {
    expect(buildAdminArweaveEmptyResource()).toEqual({
      address: '',
      display: 'No JWK entered',
      meta: 'Enter a JWK above to read the public wallet balance.',
      loading: false,
    });
    expect(buildAdminArweaveInvalidResource()).toEqual({
      address: '',
      display: 'Invalid JWK',
      meta: 'The wallet JSON could not be parsed.',
      loading: false,
    });
    expect(buildAdminArweaveLoadingResource()).toEqual({
      address: '',
      display: 'Loading...',
      meta: 'Resolving wallet address and balance…',
      loading: true,
    });
    expect(
      buildAdminArweaveBalanceResource({
        address: 'arweave-address-0001',
        winston: '123456',
        formatWinstonToAr: (winston, precision) => `${winston}:${precision}`,
        shortAddress,
      }),
    ).toEqual({
      address: 'arweave-address-0001',
      display: '123456:6 AR',
      meta: 'arweav…0001',
      loading: false,
    });
    expect(buildAdminArweaveErrorResource({ address: '', shortAddress })).toEqual({
      address: '',
      display: 'Invalid JWK',
      meta: 'The wallet JSON is missing required Arweave key fields.',
      loading: false,
    });
    expect(buildAdminArweaveErrorResource({ address: 'arweave-address-0001', shortAddress })).toEqual({
      address: 'arweave-address-0001',
      display: 'Unable to load balance',
      meta: 'arweav…0001',
      loading: false,
    });
  });

  it('builds faucet resource display states', () => {
    expect(buildAdminFaucetEmptyResource()).toEqual({
      address: '',
      display: 'No faucet key entered',
      meta: 'Enter a faucet private key above to read the wallet balance.',
      loading: false,
    });
    expect(buildAdminFaucetInvalidResource()).toEqual({
      address: '',
      display: 'Invalid key',
      meta: 'The private key could not be parsed.',
      loading: false,
    });
    expect(
      buildAdminFaucetRpcUnavailableResource({
        address: '0x00000000000000000000000000000000000000aa',
        shortAddress,
      }),
    ).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: 'RPC unavailable',
      meta: '0x0000…00aa',
      loading: false,
    });
    expect(
      buildAdminFaucetLoadingResource({
        address: '0x00000000000000000000000000000000000000aa',
        sessionChainLabel: 'Base Sepolia (84532)',
        shortAddress,
      }),
    ).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: 'Loading...',
      meta: 'Reading Base Sepolia (84532)',
      loading: true,
    });
    expect(
      buildAdminFaucetBalanceResource({
        address: '0x00000000000000000000000000000000000000aa',
        balanceWei: '184200000000000000',
        sessionChainLabel: 'Base Sepolia (84532)',
        formatEther: () => '0.1842',
        shortAddress,
      }),
    ).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: '0.1842 ETH',
      meta: '0x0000…00aa • Base Sepolia (84532)',
      loading: false,
    });
    expect(
      buildAdminFaucetErrorResource({
        address: '0x00000000000000000000000000000000000000aa',
        shortAddress,
      }),
    ).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: 'Unable to load balance',
      meta: '0x0000…00aa',
      loading: false,
    });
  });

  it('builds Lit Chipotle resource status descriptors', () => {
    const formatPreviewValue = (value: unknown, limit: unknown) => `${value}:${limit}`;

    expect(buildAdminLitNotConfiguredResource()).toEqual({
      address: '',
      display: 'Lit Chipotle not configured',
      meta: 'Enter a Lit account API key or Lit usage API key above, or save Lit Chipotle config to the worker, then refresh status.',
      loading: false,
      manualRefreshAvailable: false,
    });
    expect(buildAdminLitUnavailableResource({ useChipotlePath: true })).toEqual({
      address: '',
      display: 'Worker unavailable',
      meta: 'Resolve the worker URL to read Lit Chipotle status.',
      loading: false,
      manualRefreshAvailable: false,
    });
    expect(
      buildAdminLitStatusNotLoadedResource({
        hasAccountApiKey: true,
        configuredLitApiBase: 'https://api.chipotle.litprotocol.com',
        configuredLitGroupId: 'group_123',
        configuredLitPkpId: 'pkp_123',
        configuredLitActionCid: 'bafy123',
        formatPreviewValue,
      }),
    ).toEqual({
      address: '',
      display: 'Status not loaded',
      meta: 'Unsaved account key • api.chipotle.litprotocol.com:28 • group group_123:20 • PKP configured • Action configured • Click refresh to query the worker for Lit Chipotle status.',
      loading: false,
      manualRefreshAvailable: true,
    });
    expect(
      buildAdminLitLoadingResource({
        configuredLitGroupId: 'group_123',
        formatPreviewValue,
      }),
    ).toEqual({
      address: '',
      display: 'Loading...',
      meta: 'Checking group group_123:20',
      loading: true,
      manualRefreshAvailable: true,
    });
    expect(
      buildAdminLitStatusResource({
        ready: true,
        warnings: [],
        groupSummary: {
          hasConfiguredPkp: true,
          hasConfiguredAction: true,
        },
        balanceDisplay: '$5.00 credit',
        configuredLitApiBase: 'https://api.chipotle.litprotocol.com',
        configuredLitGroupId: 'group_123',
        configuredLitPkpId: 'pkp_123',
        configuredLitActionCid: 'bafy123',
        formatPreviewValue,
      }),
    ).toEqual({
      address: '',
      display: 'Ready',
      meta: 'api.chipotle.litprotocol.com:28 • balance $5.00 credit • group group_123:20 • PKP ready • Action ready',
      loading: false,
      manualRefreshAvailable: true,
    });
    expect(
      buildAdminLitStatusResource({
        warnings: ['missing'],
        groupSummary: { walletCount: 2, actionCount: 1 },
        formatPreviewValue,
      }),
    ).toEqual({
      address: '',
      display: 'Needs review',
      meta: '2 wallets • 1 action • 1 warning',
      loading: false,
      manualRefreshAvailable: true,
    });
    expect(
      buildAdminLitStatusResource({
        groupSummary: { hasConfiguredPkp: false },
        configuredLitPkpId: 'pkp_123',
        formatPreviewValue,
      }).display,
    ).toBe('Needs config');
    expect(buildAdminLitErrorResource('Failed to load Lit Chipotle status.')).toEqual({
      address: '',
      display: 'Unable to load status',
      meta: 'Failed to load Lit Chipotle status.',
      loading: false,
      manualRefreshAvailable: true,
    });
    expect(getAdminLitResourceLabel({})).toBe('Lit sponsorship status');
    expect(getAdminLitResourceLabel({ configuredLitActionCid: 'bafy123' })).toBe('Lit Chipotle status');
    expect(getAdminLitResourceLabel({ hasUsageApiKey: true })).toBe('Lit Chipotle status');
  });
});
