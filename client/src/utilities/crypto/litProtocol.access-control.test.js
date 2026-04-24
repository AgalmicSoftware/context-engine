describe('litProtocol access control helpers', () => {
  const loadLitProtocol = () => {
    jest.resetModules();

    jest.doMock('../logging', () => ({
      __esModule: true,
      createLogger: () => ({
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }));

    return require('./litProtocol.js');
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.dontMock('../logging');
  });

  it('builds a specific-wallet access control condition', () => {
    const litProtocol = loadLitProtocol();

    expect(litProtocol.buildWalletAddressAccessControlConditions({
      walletAddress: '0x00000000000000000000000000000000000000Aa',
      chainId: 84532,
    })).toEqual([
      {
        contractAddress: '',
        standardContractType: '',
        chain: 'baseSepolia',
        method: '',
        parameters: [':userAddress'],
        returnValueTest: {
          comparator: '=',
          value: '0x00000000000000000000000000000000000000aa',
        },
      },
    ]);
  });

  it('falls back to sepolia for wallet-only access control on OP Sepolia', () => {
    const litProtocol = loadLitProtocol();

    expect(litProtocol.buildWalletAddressAccessControlConditions({
      walletAddress: '0x00000000000000000000000000000000000000Aa',
      chainId: 11155420,
    })).toEqual([
      {
        contractAddress: '',
        standardContractType: '',
        chain: 'sepolia',
        method: '',
        parameters: [':userAddress'],
        returnValueTest: {
          comparator: '=',
          value: '0x00000000000000000000000000000000000000aa',
        },
      },
    ]);
  });

  it('returns null for an invalid wallet address', () => {
    const litProtocol = loadLitProtocol();

    expect(litProtocol.buildWalletAddressAccessControlConditions({
      walletAddress: 'not-an-address',
      chainId: 84532,
    })).toBeNull();
  });
});
