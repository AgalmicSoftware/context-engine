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
    expect(buildAdminArweaveBalanceResource({
      address: 'arweave-address-0001',
      winston: '123456',
      formatWinstonToAr: (winston, precision) => `${winston}:${precision}`,
      shortAddress,
    })).toEqual({
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
    expect(buildAdminFaucetRpcUnavailableResource({
      address: '0x00000000000000000000000000000000000000aa',
      shortAddress,
    })).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: 'RPC unavailable',
      meta: '0x0000…00aa',
      loading: false,
    });
    expect(buildAdminFaucetLoadingResource({
      address: '0x00000000000000000000000000000000000000aa',
      sessionChainLabel: 'Base Sepolia (84532)',
      shortAddress,
    })).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: 'Loading...',
      meta: 'Reading Base Sepolia (84532)',
      loading: true,
    });
    expect(buildAdminFaucetBalanceResource({
      address: '0x00000000000000000000000000000000000000aa',
      balanceWei: '184200000000000000',
      sessionChainLabel: 'Base Sepolia (84532)',
      formatEther: () => '0.1842',
      shortAddress,
    })).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: '0.1842 ETH',
      meta: '0x0000…00aa • Base Sepolia (84532)',
      loading: false,
    });
    expect(buildAdminFaucetErrorResource({
      address: '0x00000000000000000000000000000000000000aa',
      shortAddress,
    })).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      display: 'Unable to load balance',
      meta: '0x0000…00aa',
      loading: false,
    });
  });
});
