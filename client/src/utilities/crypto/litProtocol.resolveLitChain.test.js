describe('resolveLitChain', () => {
  const loadLitProtocol = () => {
    jest.resetModules();

    const warn = jest.fn();
    jest.doMock('../logging', () => ({
      __esModule: true,
      createLogger: () => ({
        log: jest.fn(),
        info: jest.fn(),
        warn,
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }));

    return {
      warn,
      litProtocol: require('./litProtocol.js'),
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.dontMock('../logging');
  });

  it('warns once when defaulting to ethereum with no chain metadata', () => {
    const { warn, litProtocol } = loadLitProtocol();

    expect(litProtocol.resolveLitChain()).toBe('ethereum');
    expect(litProtocol.resolveLitChain({ chainId: null, litChain: '', chain: undefined })).toBe('ethereum');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[lit] resolveLitChain falling back to default chain.',
      expect.objectContaining({
        defaultChain: 'ethereum',
        chainId: null,
        litChain: null,
        chain: null,
      }),
    );
  });

  it('does not warn when the chain can be resolved from chainId', () => {
    const { warn, litProtocol } = loadLitProtocol();

    expect(litProtocol.resolveLitChain({ chainId: 84532 })).toBe('baseSepolia');
    expect(warn).not.toHaveBeenCalled();
  });
});
