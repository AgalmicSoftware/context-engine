import {
  buildCreateSbtAuthoringContractRefs,
  buildCreateSbtDefaultDistributionState,
  contractRefMatchesChain,
  normalizeSessionContractRef,
  resolveCreateSbtAuthoringChainOptions,
  resolveCreateSbtAuthoringChainState,
  resolveCreateSbtPreferredAuthoringChainId,
  selectPreferredChainId,
} from './createSbtGroupHelpers';

describe('createSbtGroupHelpers authoring chain helpers', () => {
  it('selects the preferred chain from candidates and optional allowed ids', () => {
    expect(selectPreferredChainId(['bad', 10, 84532], [84532])).toBe(84532);
    expect(selectPreferredChainId([0, '11155420'], [])).toBe(11155420);
    expect(selectPreferredChainId([], [84532])).toBeNull();
  });

  it('resolves authoring chain state from options, registry fallback, and empty ids', () => {
    const getChainByIdMock = jest.fn((chainId) => (chainId === 11155420 ? { id: chainId, name: 'OP Sepolia' } : null));

    expect(
      resolveCreateSbtAuthoringChainState({
        chainId: 84532,
        chainOptions: [{ id: 84532, name: 'Base Sepolia' }],
        getChainById: getChainByIdMock,
      }),
    ).toEqual({
      chainId: 84532,
      chain: { id: 84532, name: 'Base Sepolia' },
    });

    expect(
      resolveCreateSbtAuthoringChainState({
        chainId: 11155420,
        chainOptions: [],
        getChainById: getChainByIdMock,
      }),
    ).toEqual({
      chainId: 11155420,
      chain: { id: 11155420, name: 'OP Sepolia' },
    });

    expect(
      resolveCreateSbtAuthoringChainState({
        chainId: null,
        chainOptions: [{ id: 84532, name: 'Base Sepolia' }],
        getChainById: getChainByIdMock,
      }),
    ).toEqual({
      chainId: null,
      chain: 'not connected',
    });
    expect(getChainByIdMock).toHaveBeenCalledWith(0);
    expect(
      buildCreateSbtDefaultDistributionState({
        account: '0xAdmin',
        authoringChain: { chainId: 84532, chain: { id: 84532, name: 'Base Sepolia' } },
      }),
    ).toEqual({
      isLimited: false,
      limitedNumber: 0,
      hasAdmin: false,
      adminAddress: '0xAdmin',
      isRevocable: false,
      isTimeLimited: false,
      mintingEndTime: null,
      distributionOption: 'anyoneCanMint',
      burnAuth: 'AdminOnly',
      burnAdmin: '0xAdmin',
      network: { id: 84532, name: 'Base Sepolia' },
      unlisted: false,
    });
    expect(
      buildCreateSbtDefaultDistributionState({
        account: '',
        authoringChain: { chainId: null, chain: 'not connected' },
      }).network,
    ).toBe('not connected');
  });

  it('filters authoring chain options to chains with SBT factories', () => {
    const hasUsableSbtFactoryForChain = jest.fn((chainId) => chainId === 11155420);

    expect(
      resolveCreateSbtAuthoringChainOptions({
        getSessionRegistryChains: () => [
          { id: 84532, name: 'Base Sepolia' },
          null,
          { id: 11155420, name: 'OP Sepolia' },
          { name: 'Missing id' },
        ],
        hasUsableSbtFactoryForChain,
      }),
    ).toEqual([{ id: 11155420, name: 'OP Sepolia' }]);
    expect(hasUsableSbtFactoryForChain).toHaveBeenCalledWith(84532);
    expect(hasUsableSbtFactoryForChain).toHaveBeenCalledWith(11155420);
    expect(
      resolveCreateSbtAuthoringChainOptions({
        getSessionRegistryChains: () => null,
        hasUsableSbtFactoryForChain,
      }),
    ).toEqual([]);
  });

  it('resolves preferred authoring chain ids before wallet fallback', () => {
    expect(
      resolveCreateSbtPreferredAuthoringChainId({
        availableChainIds: [84532, 11155420],
        network: { id: 10, chainId: 84532 },
        resolvedSessionConfig: { networkChainId: 11155420 },
        selectedChainId: 84532,
        sessionConfigOverride: { networkChainId: 10 },
      }),
    ).toBe(84532);

    expect(
      resolveCreateSbtPreferredAuthoringChainId({
        availableChainIds: [84532, 11155420],
        network: { id: 11155420 },
        resolvedSessionConfig: { networkChainId: 84532 },
        selectedChainId: 10,
        sessionConfigOverride: null,
      }),
    ).toBe(84532);

    expect(
      resolveCreateSbtPreferredAuthoringChainId({
        availableChainIds: [11155420],
        network: { chainId: 11155420 },
        selectedChainId: '',
        sessionConfigOverride: null,
        resolvedSessionConfig: null,
      }),
    ).toBe(11155420);
  });

  it('normalizes session contract refs and compares chain matches', () => {
    expect(normalizeSessionContractRef({ address: ' 0xSBT ', chainID: '84532' })).toEqual({
      address: '0xSBT',
      chainId: 84532,
    });
    expect(normalizeSessionContractRef({ chain: 10 })).toEqual({ chainId: 10 });
    expect(normalizeSessionContractRef(null, 11155420)).toEqual({ chainId: 11155420 });
    expect(normalizeSessionContractRef({})).toBeNull();
    expect(contractRefMatchesChain({ address: '0xA', chainId: 84532 }, 84532)).toBe(true);
    expect(contractRefMatchesChain({ address: '0xA', chainId: 10 }, 84532)).toBe(false);
    expect(contractRefMatchesChain({ address: '0xA' }, 84532)).toBe(true);
    expect(contractRefMatchesChain({}, 84532)).toBe(false);
  });

  it('builds authoring contract refs for the selected chain', () => {
    const getSessionContractsForChain = jest.fn((chainId) =>
      chainId === 11155420
        ? {
            sbtFactory: { address: '0xOPFactory', chainId: 11155420 },
            surveys: { address: '0xOPSurveys', chainId: 11155420 },
            registry: { address: '0xOPRegistry' },
          }
        : {
            sbtFactory: { address: '0xBaseFactory', chainId: 84532 },
            surveys: { address: '0xBaseSurveys', chainId: 84532 },
          },
    );
    const resolveSessionContractRef = jest.fn(({ contractKey }) => ({
      address: contractKey === 'surveys' ? '0xAliasSurveys' : '',
      chainId: 11155420,
    }));

    expect(buildCreateSbtAuthoringContractRefs({ networkId: '' })).toEqual({});
    expect(
      buildCreateSbtAuthoringContractRefs({
        getSessionContractsForChain,
        networkId: 84532,
        sessionConfig: {
          networkChainId: 84532,
          contracts: {
            custom: { address: '0xCustomBase', chainId: 84532 },
          },
        },
      }),
    ).toMatchObject({
      custom: { address: '0xCustomBase', chainId: 84532 },
      sbtFactory: { address: '0xBaseFactory', chainId: 84532 },
    });

    expect(
      buildCreateSbtAuthoringContractRefs({
        getSessionContractsForChain,
        networkId: 11155420,
        resolveSessionContractRef,
        sessionConfig: {
          networkChainId: 84532,
          contracts: {
            sbtFactory: { address: '0xStaleBaseFactory', chainId: 84532 },
            custom: { address: '0xStaleCustom', chainId: 84532 },
          },
        },
      }),
    ).toEqual({
      sbtFactory: { address: '0xOPFactory', chainId: 11155420 },
      custom: { address: '0xStaleCustom', chainId: 84532 },
      surveys: { address: '0xOPSurveys', chainId: 11155420 },
      registry: { address: '0xOPRegistry', chainId: 11155420 },
    });
    expect(resolveSessionContractRef).toHaveBeenCalledWith({
      contractKey: 'surveys',
      sessionConfig: expect.objectContaining({ networkChainId: 84532 }),
    });
  });
});
