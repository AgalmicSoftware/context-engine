import { ethers } from 'ethers';
import { createContractProfileMethods } from './contractProfile.js';

const GROUP_CFG = {
  slug: 'provider-selection-session',
  networkChainId: 84532,
  blockLimits: {
    start: 1,
    end: null,
  },
  contracts: {
    sbtFactory: {
      address: '0x00000000000000000000000000000000000000aa',
      chainId: 84532,
    },
    surveys: {
      address: '0x00000000000000000000000000000000000000ab',
      chainId: 84532,
    },
  },
};

const SBT_CREATED_IFACE = new ethers.utils.Interface(['event SBTCreated(address indexed sbtAddress)']);

const makeCreatedLog = (address, blockNumber = 0) => {
  const encoded = SBT_CREATED_IFACE.encodeEventLog(
    SBT_CREATED_IFACE.getEvent('SBTCreated'),
    [address]
  );
  return {
    address: GROUP_CFG.contracts.sbtFactory.address,
    blockNumber,
    topics: encoded.topics,
    data: encoded.data,
  };
};

const makeDeps = () => {
  const chainProvider = new ethers.providers.JsonRpcProvider('http://chain-provider.example');
  const groupProvider = new ethers.providers.JsonRpcProvider('http://session-provider.example');
  return {
    resolveSession: jest.fn((value) => value || GROUP_CFG),
    getReadProviderForChain: jest.fn(() => chainProvider),
    getReadProviderForGroup: jest.fn(() => groupProvider),
    CUSTOM_SBT_ABI: ['function balanceOf(address owner) view returns (uint256)'],
    callWithRetry: jest.fn((fn) => fn()),
    rpcLog: jest.fn(),
    isNonexistentTokenError: jest.fn(() => false),
    contractsLog: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    getSessionAddresses: jest.fn(() => ({
      sbtFactory: {
        address: GROUP_CFG.contracts.sbtFactory.address,
        chainId: GROUP_CFG.contracts.sbtFactory.chainId,
      },
    })),
    buildSbtScopeMemoTag: jest.fn(() => 'provider-selection'),
    bumpSbtMemoRunVersion: jest.fn(() => 1),
    isLatestSbtMemoRun: jest.fn(() => true),
    SBT_FACTORY_ABI: ['event SBTCreated(address indexed sbtAddress)'],
    shouldLog: jest.fn(() => false),
    fetchLogsSmartWithProvider: jest.fn(async () => []),
    resolveSessionNameValue: jest.fn(() => ''),
    normalizeSessionSlug: jest.fn((value = '') => String(value || '').trim().toLowerCase()),
    normalizeSbtSessionLinkFields: jest.fn((value) => value),
    normalizeSessionNameFields: jest.fn((value) => value),
    latestBlockCache: { _map: {} },
  };
};

describe('contractProfile session-aware provider selection', () => {
  it('uses the group-aware provider for SBT universe discovery', async () => {
    const deps = makeDeps();
    const methods = createContractProfileMethods(deps);
    methods.getRelevantBlockWindowForFilter = jest.fn().mockResolvedValue({
      fromBlock: 20,
      toBlock: 10,
    });

    const result = await methods.getAllSbtAddressesCached('none', GROUP_CFG);

    expect(result).toEqual([]);
    expect(deps.getReadProviderForGroup).toHaveBeenCalledWith(GROUP_CFG, {
      contractKey: 'sbtFactory',
      skipGlobalPreferred: true,
    });
    expect(methods.getRelevantBlockWindowForFilter).toHaveBeenCalledWith(GROUP_CFG, {
      contractKey: 'sbtFactory',
    });
    expect(deps.getReadProviderForChain).not.toHaveBeenCalled();
    expect(deps.fetchLogsSmartWithProvider).not.toHaveBeenCalled();
  });

  it('emits newly discovered SBT addresses incrementally from log chunks', async () => {
    const deps = makeDeps();
    const firstAddress = '0x00000000000000000000000000000000000000c1';
    const secondAddress = '0x00000000000000000000000000000000000000c2';
    const firstLog = makeCreatedLog(firstAddress, 12);
    const secondLog = makeCreatedLog(secondAddress, 15);
    const discovered = [];
    deps.fetchLogsSmartWithProvider.mockImplementation(async (
      _provider,
      _filter,
      _fromBlock,
      _toBlock,
      _depth,
      _chunk,
      progressState
    ) => {
      if (typeof progressState?.onLogs === 'function') {
        await progressState.onLogs({ logs: [firstLog], scanTo: 12 });
        await progressState.onLogs({ logs: [firstLog, secondLog], scanTo: 15 });
      }
      return [firstLog, secondLog];
    });
    const parseLogSpy = jest.spyOn(ethers.utils.Interface.prototype, 'parseLog');

    const methods = createContractProfileMethods(deps);
    methods.getRelevantBlockWindowForFilter = jest.fn().mockResolvedValue({
      fromBlock: 10,
      toBlock: 15,
    });

    const result = await methods.getAllSbtAddressesCached('none', GROUP_CFG, {
      onDiscoveredAddresses: (payload) => discovered.push(payload),
    });

    expect(result.map((address) => address.toLowerCase())).toEqual([
      firstAddress.toLowerCase(),
      secondAddress.toLowerCase(),
    ]);
    expect(discovered).toEqual([
      {
        addresses: [expect.stringMatching(new RegExp(`^${firstAddress}$`, 'i'))],
        scanTo: 12,
        fromBlock: 10,
        toBlock: 15,
      },
      {
        addresses: [expect.stringMatching(new RegExp(`^${secondAddress}$`, 'i'))],
        scanTo: 15,
        fromBlock: 10,
        toBlock: 15,
      },
    ]);
    expect(parseLogSpy).toHaveBeenCalledTimes(2);
  });
});
