import {
  buildCreateSbtAuthoringChainSyncPatch,
  buildCreateSbtAuthoringChainSyncStatePatch,
  buildCreateSbtAuthoringContractRefs,
  contractRefMatchesChain,
  getConfiguredContractAddress,
  hasUsableCreateSbtFactoryForChain,
  normalizePositiveChainId,
  normalizeSessionContractRef,
  resolveCreateSbtAuthoringChainOptions,
  resolveCreateSbtAuthoringChainState,
  resolveCreateSbtCachedDistributionChainId,
  resolveCreateSbtPreferredAuthoringChainId,
  selectPreferredChainId,
  shouldHideCreateSbtNetworkSelector,
} from './createSbtGroupAuthoringChainHelpers';

describe('createSbtGroupAuthoringChainHelpers', () => {
  it('normalizes chain ids and builds distribution sync patches', () => {
    expect(normalizePositiveChainId('84532')).toBe(84532);
    expect(normalizePositiveChainId(0)).toBeNull();
    expect(normalizePositiveChainId(Number.NaN)).toBeNull();
    expect(resolveCreateSbtCachedDistributionChainId({ network: { id: '11155420' } })).toBe(11155420);
    expect(resolveCreateSbtCachedDistributionChainId({ network: { chainId: 84532 } })).toBe(84532);
    expect(resolveCreateSbtCachedDistributionChainId({ network: 'bad' })).toBeNull();
    expect(
      buildCreateSbtAuthoringChainSyncPatch({
        currentDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
        currentNetwork: 11155420,
        syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      }),
    ).toBeNull();
    expect(
      buildCreateSbtAuthoringChainSyncPatch({
        currentDistributionNetwork: { id: 84532, name: 'Base Sepolia' },
        currentNetwork: 84532,
        syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      }),
    ).toEqual({
      network: 11155420,
      sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
    });
    expect(
      buildCreateSbtAuthoringChainSyncStatePatch({
        currentDistribution: { burnAdmin: '0xAdmin' },
        syncPatch: {
          network: 11155420,
          sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
        },
      }),
    ).toEqual({
      network: 11155420,
      sbtDistribution: {
        burnAdmin: '0xAdmin',
        network: { id: 11155420, name: 'OP Sepolia' },
      },
    });
    expect(buildCreateSbtAuthoringChainSyncStatePatch()).toBeNull();
  });

  it('filters authoring chain options and resolves selected state', () => {
    const getChainById = jest.fn((chainId) => (chainId === 11155420 ? { id: chainId, name: 'OP Sepolia' } : null));
    const hasUsableSbtFactoryForChain = jest.fn((chainId) => chainId === 11155420);

    expect(
      resolveCreateSbtAuthoringChainOptions({
        getSessionRegistryChains: () => [
          { id: 84532, name: 'Base Sepolia' },
          null,
          { id: 11155420, name: 'OP Sepolia' },
        ],
        hasUsableSbtFactoryForChain,
      }),
    ).toEqual([{ id: 11155420, name: 'OP Sepolia' }]);
    expect(
      resolveCreateSbtAuthoringChainState({
        chainId: 84532,
        chainOptions: [{ id: 84532, name: 'Base Sepolia' }],
        getChainById,
      }),
    ).toEqual({
      chainId: 84532,
      chain: { id: 84532, name: 'Base Sepolia' },
    });
    expect(
      resolveCreateSbtAuthoringChainState({
        chainId: 11155420,
        chainOptions: [],
        getChainById,
      }),
    ).toEqual({
      chainId: 11155420,
      chain: { id: 11155420, name: 'OP Sepolia' },
    });
    expect(resolveCreateSbtAuthoringChainState({ chainId: null, getChainById })).toEqual({
      chainId: null,
      chain: 'not connected',
    });
  });

  it('selects preferred authoring chains before wallet fallback', () => {
    expect(selectPreferredChainId(['bad', 10, 84532], [84532])).toBe(84532);
    expect(selectPreferredChainId([0, '11155420'], [])).toBe(11155420);
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
        availableChainIds: [11155420],
        network: { chainId: 11155420 },
        selectedChainId: '',
        sessionConfigOverride: null,
        resolvedSessionConfig: null,
      }),
    ).toBe(11155420);
    expect(shouldHideCreateSbtNetworkSelector({ hideNetworkSelector: true })).toBe(true);
    expect(shouldHideCreateSbtNetworkSelector({ deferredDeploy: true })).toBe(true);
    expect(shouldHideCreateSbtNetworkSelector({ hideNetworkSelector: 0, deferredDeploy: '' })).toBe(false);
  });

  it('normalizes contract refs and swaps stale authoring defaults by selected chain', () => {
    expect(getConfiguredContractAddress({ address: ' 0xSBT ' })).toBe('0xSBT');
    expect(getConfiguredContractAddress({})).toBe('');
    expect(
      hasUsableCreateSbtFactoryForChain({
        chainId: 11155420,
        getSessionContractsForChain: () => ({ sbtFactory: { address: ' 0xFactory ' } }),
      }),
    ).toBe(true);
    expect(
      hasUsableCreateSbtFactoryForChain({
        chainId: 84532,
        getSessionContractsForChain: () => ({ sbtFactory: { address: ' ' } }),
      }),
    ).toBe(false);
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
