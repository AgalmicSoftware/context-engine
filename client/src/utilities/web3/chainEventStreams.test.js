import { ethers } from 'ethers';
import { createContractEventListenerMethods } from './chainEventStreams.js';

const SBT_FACTORY_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SURVEYS_ADDRESS = '0x00000000000000000000000000000000000000ab';
const SBT_INSTANCE_ADDRESS = '0x00000000000000000000000000000000000000ac';

const makeProvider = (url) => ({
  on: jest.fn(),
  __CE_RPC_META: {
    providerMode: 'fallback',
    providerLabel: 'path',
    preferredUrls: [url],
  },
});

const buildMethods = ({ getReadProviderForGroup } = {}) => {
  const sbtListenerMap = new Map();
  const surveyListenerMap = new Map();
  const getReadProviderForChain = jest.fn(() => makeProvider('https://chain.example'));
  const contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation((address, abi, provider) => ({
    address,
    provider,
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
  }));
  const methods = createContractEventListenerMethods({
    resolveSession: jest.fn((groupKeyOrCfg = '') => ({
      slug: groupKeyOrCfg || 'general',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: SBT_FACTORY_ADDRESS,
          chainId: 84532,
        },
        surveys: {
          address: SURVEYS_ADDRESS,
          chainId: 84532,
        },
      },
    })),
    getSessionAddresses: jest.fn((cfg) => cfg.contracts || {}),
    contractsLog: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    sbtListenerMap,
    surveyListenerMap,
    getReadProviderForChain,
    getReadProviderForGroup,
    SBT_FACTORY_ABI: ['event SBTCreated(address indexed sbtAddress)'],
    CUSTOM_SBT_ABI: [
      'event SBTActivity(address indexed account,uint256 indexed tokenId,bool indexed burned)',
    ],
    SURVEYS: [
      'event SurveyAdded(address indexed creator,bytes32 indexed surveyId)',
      'event QuestionsAdded(address indexed creator,bytes32[] questionIds,bytes32[] surveyIds)',
      'event ResponsesSubmitted(address indexed responder,bytes32[] questionIds,bytes32 indexed surveyId)',
    ],
    shouldLog: jest.fn(() => false),
  });
  return {
    methods,
    sbtListenerMap,
    surveyListenerMap,
    getReadProviderForChain,
    contractSpy,
  };
};

describe('chainEventStreams provider scoping', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rebinds SBT factory listeners when the provider scope changes on the same chain', async () => {
    const alphaProvider = makeProvider('https://alpha-rpc.example');
    const betaProvider = makeProvider('https://beta-rpc.example');
    const getReadProviderForGroup = jest.fn((groupKeyOrCfg) => (
      groupKeyOrCfg === 'beta' ? betaProvider : alphaProvider
    ));
    const { methods, sbtListenerMap, getReadProviderForChain, contractSpy } = buildMethods({
      getReadProviderForGroup,
    });

    await methods.listenForSBTEvents('none', jest.fn(), 'alpha');
    await methods.listenForSBTEvents('none', jest.fn(), 'beta');

    expect(getReadProviderForGroup).toHaveBeenNthCalledWith(1, 'alpha', { contractKey: 'sbtFactory' });
    expect(getReadProviderForGroup).toHaveBeenNthCalledWith(2, 'beta', { contractKey: 'sbtFactory' });
    expect(getReadProviderForChain).not.toHaveBeenCalled();
    expect(contractSpy).toHaveBeenCalledTimes(2);
    expect(sbtListenerMap.size).toBe(2);
  });

  it('treats SBT instance listeners with different provider scopes as distinct subscriptions', async () => {
    const alphaProvider = makeProvider('https://alpha-rpc.example');
    const betaProvider = makeProvider('https://beta-rpc.example');
    const getReadProviderForGroup = jest.fn((groupKeyOrCfg) => (
      groupKeyOrCfg === 'beta' ? betaProvider : alphaProvider
    ));
    const { methods, contractSpy } = buildMethods({
      getReadProviderForGroup,
    });

    await methods.listenForSBTInstanceEvents('none', [SBT_INSTANCE_ADDRESS], jest.fn(), 'alpha');
    await methods.listenForSBTInstanceEvents('none', [SBT_INSTANCE_ADDRESS], jest.fn(), 'beta');

    expect(getReadProviderForGroup).toHaveBeenNthCalledWith(1, 'alpha', { contractKey: 'sbtFactory' });
    expect(getReadProviderForGroup).toHaveBeenNthCalledWith(2, 'beta', { contractKey: 'sbtFactory' });
    expect(contractSpy).toHaveBeenCalledTimes(2);
  });

  it('forwards transaction and log ordering metadata on factory events', async () => {
    const alphaProvider = makeProvider('https://alpha-rpc.example');
    const getReadProviderForGroup = jest.fn(() => alphaProvider);
    const handleNewEvent = jest.fn();
    const { methods, contractSpy } = buildMethods({ getReadProviderForGroup });

    await methods.listenForSBTEvents('none', handleNewEvent, 'alpha');

    const factoryContract = contractSpy.mock.results[0]?.value;
    const [, onCreated] = factoryContract.on.mock.calls.find(([eventName]) => eventName === 'SBTCreated');
    onCreated(SBT_INSTANCE_ADDRESS, {
      transactionHash: '0xcreated',
      blockNumber: 12,
      transactionIndex: 3,
      logIndex: 5,
    });

    expect(handleNewEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SBTCreated',
      sbtAddress: SBT_INSTANCE_ADDRESS,
      transactionHash: '0xcreated',
      blockNumber: 12,
      transactionIndex: 3,
      logIndex: 5,
    }));
  });

  it('forwards transaction and log ordering metadata on SBT activity events', async () => {
    const alphaProvider = makeProvider('https://alpha-rpc.example');
    const getReadProviderForGroup = jest.fn(() => alphaProvider);
    const handleNewEvent = jest.fn();
    const { methods, contractSpy } = buildMethods({ getReadProviderForGroup });

    await methods.listenForSBTInstanceEvents('none', [SBT_INSTANCE_ADDRESS], handleNewEvent, 'alpha');

    const instanceContract = contractSpy.mock.results[0]?.value;
    const [, onActivity] = instanceContract.on.mock.calls.find(([eventName]) => eventName === 'SBTActivity');
    onActivity(
      '0x00000000000000000000000000000000000000dd',
      { toString: () => '9' },
      true,
      {
        transactionHash: '0xactivity',
        blockNumber: 22,
        transactionIndex: 1,
        logIndex: 4,
      }
    );

    expect(handleNewEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SBTActivity',
      address: ethers.utils.getAddress(SBT_INSTANCE_ADDRESS),
      transactionHash: '0xactivity',
      blockNumber: 22,
      transactionIndex: 1,
      logIndex: 4,
      args: expect.objectContaining({
        account: '0x00000000000000000000000000000000000000dd',
        tokenId: '9',
        burned: true,
      }),
    }));
  });
});
