jest.mock('../../variables/appConfig.js', () => {
  const actual = jest.requireActual('../../variables/appConfig.js');
  return {
    ...actual,
    ARWEAVE_ACTIVE: true,
  };
});

const mockBase64urlToHex = (value) => (
  String(value || '').startsWith('A')
    ? `0x${'11'.repeat(32)}`
    : `0x${'22'.repeat(32)}`
);

jest.mock('../arweave/arweaveScripts.js', () => {
  return {
    arweaveScripts: {
      uploadDataToArweave: jest.fn(),
      base64urlToHex: jest.fn(mockBase64urlToHex),
      hexToBase64url: jest.fn(),
      base64DecodeURL: jest.fn(),
      base64urlToBase64: jest.fn(),
    },
  };
});

jest.mock('../storage/storageClient.js', () => ({
  uploadDataToSessionStorage: jest.fn(),
  readSessionStorageBlob: jest.fn(),
}));

jest.mock('../logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  shouldLog: jest.fn(() => false),
}));

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  const mockUtils = {
    ...actual.utils,
    Interface: class MockInterface {
      encodeFunctionData() {
        return '0xdeadbeef';
      }
    },
  };

  class MockWeb3Provider {
    constructor(provider) {
      this.provider = provider;
    }

    getSigner() {
      return {
        getAddress: jest.fn(async () => '0x00000000000000000000000000000000000000aa'),
      };
    }

    async estimateGas() {
      return actual.ethers.BigNumber.from('300000');
    }

    async waitForTransaction(txHash) {
      return { status: 1, transactionHash: txHash };
    }
  }

  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      utils: mockUtils,
      providers: {
        ...actual.ethers.providers,
        Web3Provider: MockWeb3Provider,
      },
    },
    utils: mockUtils,
  };
});

const { ethers } = require('ethers');
const { arweaveScripts } = require('../arweave/arweaveScripts.js');
const { uploadDataToSessionStorage, readSessionStorageBlob } = require('../storage/storageClient.js');
const contractScriptsBarrel = require('./contractScripts');

const contractScripts = contractScriptsBarrel.default;
const submitResponses = (...args) => contractScripts.submitResponses(...args);
const createSBT = (...args) => contractScripts.createSBT(...args);
const addSurvey = (...args) => contractScripts.addSurveyWithQuestions(...args);
const predictSBTAddress = (...args) => contractScripts.predictSBTAddress(...args);

const TEST_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SURVEY_ID = ethers.utils.id('survey-error-path');
const QUESTION_ID = ethers.utils.id('question-error-path');
const SURVEY_TX_ID = 'A'.repeat(43);
const QUESTION_TX_ID = 'B'.repeat(43);
const CF_SURVEY_ID = 'C'.repeat(43);
const CF_QUESTION_ID = 'D'.repeat(43);
const CF_RESPONSE_ID = 'E'.repeat(43);
const GROUP_CFG = {
  slug: 'error-path-session',
  networkChainId: 84532,
  contracts: {
    surveys: {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 84532,
    },
    sbtFactory: {
      address: '0x2222222222222222222222222222222222222222',
      chainId: 84532,
    },
  },
};
const CLOUDFLARE_GROUP_CFG = {
  ...GROUP_CFG,
  storageProfile: {
    backend: 'cloudflare',
  },
};

const makeRpcProvider = ({ sendTxError } = {}) => ({
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [TEST_ADDRESS];
    if (method === 'eth_chainId') return '0x14a34';
    if (method === 'net_version') return '84532';
    if (method === 'eth_estimateGas') return '0x493e0';
    if (method === 'eth_sendTransaction') {
      if (sendTxError) throw sendTxError;
      return '0xtxhash';
    }
    return null;
  }),
});

const makeWriteContractMock = ({
  address = TEST_ADDRESS,
  data = '0xdeadbeef',
  methods = [],
} = {}) => {
  const contract = {
    address,
    interface: {
      encodeFunctionData: jest.fn(() => data),
    },
    estimateGas: {},
  };
  methods.forEach((method) => {
    contract[method] = jest.fn(async () => {
      throw new Error('old ethers tx response path should not be used');
    });
    contract.estimateGas[method] = jest.fn();
  });
  return contract;
};

describe('error paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arweaveScripts.uploadDataToArweave.mockReset();
    arweaveScripts.base64urlToHex.mockImplementation(mockBase64urlToHex);
    uploadDataToSessionStorage.mockReset();
    readSessionStorageBlob.mockReset();
    delete window.ethereum;
    delete window.web3authProvider;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
    delete window.web3authProvider;
  });

  it('uses provider-neutral wallet guidance for signer-only transaction paths', async () => {
    const signerCases = [
      {
        run: () => contractScripts.submitSurveyResponse('none', SURVEY_ID, SURVEY_TX_ID, GROUP_CFG),
        message: 'submitSurveyResponse requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.addSurveyWithQuestions(
          'none',
          SURVEY_ID,
          { title: 'Neutral survey' },
          [QUESTION_ID],
          [{ prompt: 'Neutral question' }],
          GROUP_CFG,
        ),
        message: 'addSurveyWithQuestions requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.addQuestions(
          'none',
          [QUESTION_ID],
          [{ prompt: 'Neutral question' }],
          [SURVEY_ID],
          GROUP_CFG,
        ),
        message: 'addQuestions requires a signer-capable provider (not read-only).',
      },
      {
        run: () => submitResponses(
          'none',
          [QUESTION_ID],
          [{ answer: 'yes' }],
          SURVEY_ID,
          { complete: true },
          GROUP_CFG,
        ),
        message: 'submitResponses: read-only provider is not allowed here. Connect a wallet first.',
      },
      {
        run: () => createSBT(
          'none',
          'Neutral Group',
          'NG',
          0,
          TEST_ADDRESS,
          0,
          false,
          0,
          [],
          'ipfs://token-uri',
          ethers.constants.HashZero,
          GROUP_CFG,
        ),
        message: 'createSBT: read-only provider is not allowed here. Connect a wallet first.',
      },
      {
        run: () => contractScripts.startClaim('none', TEST_ADDRESS, '0x1234'),
        message: 'startClaim requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.claimWithPassword('none', TEST_ADDRESS, 'secret'),
        message: 'claimWithPassword requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.claimWithInvite('none', TEST_ADDRESS, '1', '0xsig'),
        message: 'claimWithInvite requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.mintWithGroupSignature('none', TEST_ADDRESS, '0xsig'),
        message: 'mintWithGroupSignature requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.claim('none', TEST_ADDRESS),
        message: 'claim requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.addHashedPasswords('none', TEST_ADDRESS, []),
        message: 'addHashedPasswords requires a signer-capable provider (not read-only).',
      },
      {
        run: () => contractScripts.burnToken('none', TEST_ADDRESS, 1),
        message: 'burnToken requires a signer-capable provider (not read-only).',
      },
    ];

    for (const { run, message } of signerCases) {
      try {
        await run();
        throw new Error(`Expected rejection with message: ${message}`);
      } catch (error) {
        expect(error.message).toBe(message);
        expect(error.message).not.toMatch(/wagmi|web3auth/i);
      }
    }

    expect(() => contractScripts.getProviderLocation('web3auth')).toThrow(
      'Selected wallet provider is not available. Log in or reconnect your wallet first.'
    );
    expect(() => contractScripts.getProviderLocation('wagmi')).toThrow(
      'Connected wallet provider not found or invalid (window.ethereum missing).'
    );
    expect(() => contractScripts.getProviderLocation('none')).toThrow(
      'Read-only provider is not allowed for transactions. Connect a wallet first.'
    );
  });

  it('keeps signer fallback explicit and rejects unknown named providers', () => {
    const injectedProvider = makeRpcProvider();
    window.ethereum = injectedProvider;

    expect(contractScripts.getProviderLocation('')).toBe(injectedProvider);
    expect(contractScripts.getProviderLocation('injected')).toBe(injectedProvider);
    expect(() => contractScripts.getProviderLocation('legacy-extension')).toThrow(
      'Could not determine provider for "legacy-extension".'
    );
  });

  it('does not fall back to injected wallet reads for minted token counts by default', async () => {
    const injectedProvider = makeRpcProvider();
    window.ethereum = injectedProvider;
    const configuredContract = {
      mintedTokens: jest.fn(async () => {
        throw new Error('configured read failed');
      }),
    };
    const injectedContract = {
      mintedTokens: jest.fn(async () => ethers.BigNumber.from('7')),
    };
    let contractCalls = 0;
    const contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      contractCalls += 1;
      return contractCalls === 1 ? configuredContract : injectedContract;
    });

    await expect(contractScripts.getMintedTokens('none', TEST_ADDRESS, GROUP_CFG)).resolves.toBeNull();

    expect(configuredContract.mintedTokens).toHaveBeenCalledTimes(1);
    expect(injectedContract.mintedTokens).not.toHaveBeenCalled();
    expect(contractSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps minted token injected fallback available by explicit opt-in', async () => {
    const injectedProvider = makeRpcProvider();
    window.ethereum = injectedProvider;
    const configuredContract = {
      mintedTokens: jest.fn(async () => {
        throw new Error('configured read failed');
      }),
    };
    const injectedContract = {
      mintedTokens: jest.fn(async () => ethers.BigNumber.from('7')),
    };
    let contractCalls = 0;
    const contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      contractCalls += 1;
      return contractCalls === 1 ? configuredContract : injectedContract;
    });

    await expect(contractScripts.getMintedTokens('none', TEST_ADDRESS, GROUP_CFG, {
      allowInjectedReadFallback: true,
    })).resolves.toBe('7');

    expect(configuredContract.mintedTokens).toHaveBeenCalledTimes(1);
    expect(injectedContract.mintedTokens).toHaveBeenCalledTimes(1);
    expect(contractSpy).toHaveBeenCalledTimes(2);
    expect(contractSpy.mock.calls[1][2].provider).toBe(injectedProvider);
  });

  it('does not fall back to injected wallet reads for group password hashes by default', async () => {
    const injectedProvider = makeRpcProvider();
    window.ethereum = injectedProvider;
    const configuredContract = {
      groupPasswordHash: jest.fn(async () => {
        throw new Error('configured read failed');
      }),
    };
    const injectedContract = {
      groupPasswordHash: jest.fn(async () => ethers.constants.HashZero),
    };
    let contractCalls = 0;
    const contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      contractCalls += 1;
      return contractCalls === 1 ? configuredContract : injectedContract;
    });

    await expect(contractScripts.getGroupPasswordHash('none', TEST_ADDRESS, GROUP_CFG)).resolves.toBeNull();

    expect(configuredContract.groupPasswordHash).toHaveBeenCalledTimes(1);
    expect(injectedContract.groupPasswordHash).not.toHaveBeenCalled();
    expect(contractSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps group password hash injected fallback available by explicit opt-in', async () => {
    const injectedProvider = makeRpcProvider();
    window.ethereum = injectedProvider;
    const configuredContract = {
      groupPasswordHash: jest.fn(async () => {
        throw new Error('configured read failed');
      }),
    };
    const injectedContract = {
      groupPasswordHash: jest.fn(async () => ethers.constants.HashZero),
    };
    let contractCalls = 0;
    const contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      contractCalls += 1;
      return contractCalls === 1 ? configuredContract : injectedContract;
    });

    await expect(contractScripts.getGroupPasswordHash('none', TEST_ADDRESS, GROUP_CFG, {
      allowInjectedReadFallback: true,
    })).resolves.toBe(ethers.constants.HashZero);

    expect(configuredContract.groupPasswordHash).toHaveBeenCalledTimes(1);
    expect(injectedContract.groupPasswordHash).toHaveBeenCalledTimes(1);
    expect(contractSpy).toHaveBeenCalledTimes(2);
    expect(contractSpy.mock.calls[1][2].provider).toBe(injectedProvider);
  });

  it('throws submitResponses RPC timeouts instead of failing silently', async () => {
    const timeoutError = Object.assign(new Error('RPC timeout while broadcasting transaction.'), {
      code: 'NETWORK_ERROR',
    });
    window.ethereum = makeRpcProvider({ sendTxError: timeoutError });
    const mockSurveyContract = makeWriteContractMock({
      address: GROUP_CFG.contracts.surveys.address,
      methods: ['submitResponses'],
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockSurveyContract;
    });

    arweaveScripts.uploadDataToArweave
      .mockResolvedValueOnce(SURVEY_TX_ID)
      .mockResolvedValueOnce(QUESTION_TX_ID);

    const submitSpy = jest.spyOn(contractScripts, 'submitResponses');

    await expect(
      submitResponses(
        'wagmi',
        [QUESTION_ID],
        [{ answer: 'yes' }],
        SURVEY_ID,
        { complete: true },
        GROUP_CFG,
      )
    ).rejects.toBe(timeoutError);

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(arweaveScripts.uploadDataToArweave).toHaveBeenCalledTimes(2);
    const uploadOpts = arweaveScripts.uploadDataToArweave.mock.calls[0][2];
    expect(uploadOpts).toEqual(expect.objectContaining({
      sessionSlug: 'error-path-session',
      sessionConfig: expect.objectContaining({
        slug: 'error-path-session',
        networkChainId: 84532,
      }),
      context: expect.objectContaining({
        account: TEST_ADDRESS,
        chainId: 84532,
        providerLike: expect.any(Object),
        signer: expect.any(Object),
      }),
    }));
  });

  it('propagates wallet rejection errors from createSBT cleanly', async () => {
    const rpcProvider = makeRpcProvider({
      sendTxError: Object.assign(new Error('User denied transaction signature.'), {
        code: 4001,
      }),
    });
    window.ethereum = rpcProvider;

    const mockFactory = {
      address: GROUP_CFG.contracts.sbtFactory.address,
      interface: {
        encodeFunctionData: jest.fn(() => '0xfeedbeef'),
      },
      estimateGas: {
        createSBT: jest.fn(async () => ethers.BigNumber.from('1500000')),
      },
      createSBT: jest.fn(async () => {
        throw new Error('old ethers tx response path should not be used');
      }),
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockFactory;
    });
    const createSpy = jest.spyOn(contractScripts, 'createSBT');

    await expect(
      createSBT(
        'wagmi',
        'Error Path Group',
        'EPG',
        0,
        TEST_ADDRESS,
        0,
        false,
        0,
        [],
        'ipfs://token-uri',
        ethers.constants.HashZero,
        GROUP_CFG,
      )
    ).rejects.toMatchObject({ code: 4001, message: 'User denied transaction signature.' });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(mockFactory.estimateGas.createSBT).not.toHaveBeenCalled();
    expect(mockFactory.createSBT).not.toHaveBeenCalled();
    const sendCalls = rpcProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction'
    );
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][0].params[0]).toEqual(expect.objectContaining({
      from: TEST_ADDRESS,
      to: GROUP_CFG.contracts.sbtFactory.address,
      data: '0xfeedbeef',
      gas: ethers.BigNumber.from('5000000').toHexString(),
    }));
  });

  it('uses deployment fallback gas when createSBT gas estimation fails', async () => {
    const rpcProvider = makeRpcProvider({
      sendTxError: Object.assign(new Error('User denied transaction signature.'), {
        code: 4001,
      }),
    });
    window.ethereum = rpcProvider;
    const mockFactory = {
      address: GROUP_CFG.contracts.sbtFactory.address,
      interface: {
        encodeFunctionData: jest.fn(() => '0xfeedbeef'),
      },
      estimateGas: {
        createSBT: jest.fn(async () => {
          throw new Error('missing revert data in call exception');
        }),
      },
      createSBT: jest.fn(async () => {
        throw new Error('old ethers tx response path should not be used');
      }),
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockFactory;
    });

    await expect(
      createSBT(
        'wagmi',
        'Error Path Group',
        'EPG',
        0,
        TEST_ADDRESS,
        0,
        false,
        0,
        [],
        'ipfs://token-uri',
        ethers.constants.HashZero,
        GROUP_CFG,
      )
    ).rejects.toMatchObject({ code: 4001, message: 'User denied transaction signature.' });

    expect(mockFactory.estimateGas.createSBT).not.toHaveBeenCalled();
    expect(mockFactory.createSBT).not.toHaveBeenCalled();
    const sendCalls = rpcProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction'
    );
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][0].params[0].gas).toBe(ethers.BigNumber.from('5000000').toHexString());
  });

  it('fails before broadcasting unsupported configured deterministic group-password shapes', async () => {
    window.ethereum = makeRpcProvider();

    const mockFactory = {
      estimateGas: {
        createSBTDeterministicConfigured: jest.fn(),
      },
      createSBTDeterministicConfigured: jest.fn(),
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockFactory;
    });

    await expect(
      createSBT(
        'wagmi',
        'Error Path Group',
        'EPG',
        0,
        TEST_ADDRESS,
        0,
        false,
        0,
        [],
        'ipfs://token-uri',
        `0x${'11'.repeat(32)}`,
        GROUP_CFG,
        'predictable-salt',
        {
          useConfiguredDeterministic: true,
          initializeGroupPasswordHash: false,
        }
      )
    ).rejects.toThrow(
      'Configured deterministic SBT deployment cannot preinitialize a group password hash.'
    );

    expect(mockFactory.estimateGas.createSBTDeterministicConfigured).not.toHaveBeenCalled();
    expect(mockFactory.createSBTDeterministicConfigured).not.toHaveBeenCalled();
  });

  it('surfaces a clear preview error when configured deterministic prediction is unavailable on the factory', async () => {
    const unsupportedCall = Object.assign(new Error('missing revert data in call exception'), {
      code: 'CALL_EXCEPTION',
      data: '0x',
    });
    const mockFactory = {
      predictConfiguredSBTAddress: jest.fn(async () => {
        throw unsupportedCall;
      }),
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockFactory;
    });

    await expect(
      predictSBTAddress(
        'none',
        'Error Path Group',
        'EPG',
        0,
        TEST_ADDRESS,
        0,
        false,
        0,
        [],
        '',
        ethers.constants.HashZero,
        GROUP_CFG,
        'predictable-salt',
        {
          useConfiguredDeterministic: true,
          initializeGroupPasswordHash: true,
        }
      )
    ).rejects.toThrow(/does not support predictable-address deployment yet/);

    expect(mockFactory.predictConfiguredSBTAddress).toHaveBeenCalledTimes(1);
  });

  it('surfaces a clear deploy error when configured deterministic deployment is unavailable on the factory', async () => {
    const unsupportedEstimate = Object.assign(new Error('execution reverted'), {
      code: 'CALL_EXCEPTION',
      data: '0x',
    });
    window.ethereum = makeRpcProvider({ sendTxError: unsupportedEstimate });

    const mockFactory = makeWriteContractMock({
      address: GROUP_CFG.contracts.sbtFactory.address,
      data: '0xfeedbeef',
      methods: ['createSBTDeterministicConfigured'],
    });

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockFactory;
    });

    await expect(
      createSBT(
        'wagmi',
        'Error Path Group',
        'EPG',
        0,
        TEST_ADDRESS,
        0,
        false,
        0,
        [],
        'ipfs://token-uri',
        ethers.constants.HashZero,
        GROUP_CFG,
        'predictable-salt',
        {
          useConfiguredDeterministic: true,
          initializeGroupPasswordHash: true,
        }
      )
    ).rejects.toThrow(/does not support predictable-address deployment yet/);

    expect(mockFactory.estimateGas.createSBTDeterministicConfigured).not.toHaveBeenCalled();
    expect(mockFactory.createSBTDeterministicConfigured).not.toHaveBeenCalled();
  });

  it('rethrows addSurvey broadcast errors while still using the fallback gas path', async () => {
    const executionRevert = Object.assign(new Error('execution reverted: survey already exists'), {
      code: 'CALL_EXCEPTION',
    });
    window.ethereum = makeRpcProvider({ sendTxError: executionRevert });

    const mockSurveyContract = makeWriteContractMock({
      address: GROUP_CFG.contracts.surveys.address,
      methods: ['addSurvey'],
    });

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockSurveyContract;
    });
    arweaveScripts.uploadDataToArweave
      .mockResolvedValueOnce(SURVEY_TX_ID)
      .mockResolvedValueOnce(QUESTION_TX_ID);
    const addSurveySpy = jest.spyOn(contractScripts, 'addSurveyWithQuestions');

    await expect(
      addSurvey(
        'wagmi',
        SURVEY_ID,
        { title: 'Failure path survey' },
        [QUESTION_ID],
        [{ prompt: 'What broke?' }],
        GROUP_CFG,
      )
    ).rejects.toBe(executionRevert);

    expect(addSurveySpy).toHaveBeenCalledTimes(1);
    expect(mockSurveyContract.estimateGas.addSurvey).not.toHaveBeenCalled();
    expect(mockSurveyContract.addSurvey).not.toHaveBeenCalled();
  });

  it('broadcasts survey/question writes by tx hash instead of relying on ethers transaction response formatting', async () => {
    const rpcProvider = makeRpcProvider();
    window.ethereum = rpcProvider;

    const mockSurveyContract = {
      address: GROUP_CFG.contracts.surveys.address,
      interface: {
        encodeFunctionData: jest.fn(() => '0xdeadbeef'),
      },
      estimateGas: {
        addSurvey: jest.fn(async () => ethers.BigNumber.from('250000')),
        addQuestions: jest.fn(async () => ethers.BigNumber.from('200000')),
      },
      addSurvey: jest.fn(async () => {
        throw new Error('old ethers tx response path should not be used');
      }),
      addQuestions: jest.fn(async () => {
        throw new Error('old ethers tx response path should not be used');
      }),
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockSurveyContract;
    });

    arweaveScripts.uploadDataToArweave
      .mockResolvedValueOnce(SURVEY_TX_ID)
      .mockResolvedValueOnce(QUESTION_TX_ID)
      .mockResolvedValueOnce(QUESTION_TX_ID);

    const surveyResult = await addSurvey(
      'wagmi',
      SURVEY_ID,
      { title: 'Stable survey' },
      [QUESTION_ID],
      [{ id: QUESTION_ID, prompt: 'What changed?' }],
      GROUP_CFG,
    );

    const questionsResult = await contractScripts.addQuestions(
      'wagmi',
      [QUESTION_ID],
      [{ id: QUESTION_ID, prompt: 'Standalone path' }],
      [SURVEY_ID],
      GROUP_CFG,
    );

    expect(surveyResult.receipt).toEqual({ status: 1, transactionHash: '0xtxhash' });
    expect(surveyResult.surveyArweaveTxId).toBe(SURVEY_TX_ID);
    expect(surveyResult.surveyStorageRef).toEqual({
      backend: 'arweave',
      id: SURVEY_TX_ID,
      uri: `ar://${SURVEY_TX_ID}`,
      resource: 'surveys',
    });
    expect(surveyResult.uploadedQuestions[0]).toEqual(expect.objectContaining({
      questionId: expect.any(String),
      arweaveTxId: QUESTION_TX_ID,
      storageRef: expect.objectContaining({
        backend: 'arweave',
        id: QUESTION_TX_ID,
        resource: 'questions',
      }),
    }));
    expect(questionsResult.receipt).toEqual({ status: 1, transactionHash: '0xtxhash' });
    expect(questionsResult.uploadedQuestions).toHaveLength(1);
    expect(questionsResult.uploadedQuestions[0]).toEqual(expect.objectContaining({
      arweaveTxId: QUESTION_TX_ID,
      storageRef: expect.objectContaining({
        backend: 'arweave',
        id: QUESTION_TX_ID,
        resource: 'questions',
      }),
    }));
    expect(mockSurveyContract.addSurvey).not.toHaveBeenCalled();
    expect(mockSurveyContract.addQuestions).not.toHaveBeenCalled();
    expect(rpcProvider.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'eth_sendTransaction',
      params: [expect.objectContaining({
        from: TEST_ADDRESS,
        to: GROUP_CFG.contracts.surveys.address,
        data: '0xdeadbeef',
      })],
    }));
    const sendCalls = rpcProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction'
    );
    expect(sendCalls).toHaveLength(2);
    expect(sendCalls[0][0].params[0].gas).toBe(ethers.BigNumber.from('280000').toHexString());
    expect(sendCalls[1][0].params[0].gas).toBe(ethers.BigNumber.from('230000').toHexString());
  });

  it('routes Cloudflare survey and question payload writes through session storage with bytes32-compatible pointers', async () => {
    const rpcProvider = makeRpcProvider();
    window.ethereum = rpcProvider;

    const mockSurveyContract = makeWriteContractMock({
      address: GROUP_CFG.contracts.surveys.address,
      methods: ['addSurvey'],
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockSurveyContract;
    });
    uploadDataToSessionStorage
      .mockResolvedValueOnce({
        storageRef: { backend: 'cloudflare', id: CF_SURVEY_ID, resource: 'surveys' },
      })
      .mockResolvedValueOnce({
        storageRef: { backend: 'cloudflare', id: CF_QUESTION_ID, resource: 'questions' },
      });

    const result = await addSurvey(
      'wagmi',
      SURVEY_ID,
      { title: 'Cloudflare survey' },
      [QUESTION_ID],
      [{ id: QUESTION_ID, prompt: 'Where should this live?' }],
      CLOUDFLARE_GROUP_CFG,
    );

    expect(arweaveScripts.uploadDataToArweave).not.toHaveBeenCalled();
    expect(uploadDataToSessionStorage).toHaveBeenCalledTimes(2);
    expect(uploadDataToSessionStorage.mock.calls.map((call) => call[2].resource)).toEqual(['surveys', 'questions']);
    expect(mockSurveyContract.interface.encodeFunctionData).toHaveBeenCalledWith('addSurvey', [
      expect.any(String),
      `0x${'22'.repeat(32)}`,
      [expect.any(String)],
      [`0x${'22'.repeat(32)}`],
    ]);
    expect(result.surveyArweaveTxId).toBeUndefined();
    expect(result.surveyStorageRef).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      id: CF_SURVEY_ID,
      resource: 'surveys',
    }));
    expect(result.uploadedQuestions[0].arweaveTxId).toBe('');
    expect(result.uploadedQuestions[0].storageRef).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      id: CF_QUESTION_ID,
      resource: 'questions',
    }));
  });

  it('routes Cloudflare response payload writes through session storage before submitResponses', async () => {
    const rpcProvider = makeRpcProvider();
    window.ethereum = rpcProvider;
    const mockSurveyContract = makeWriteContractMock({
      address: GROUP_CFG.contracts.surveys.address,
      methods: ['submitResponses'],
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockSurveyContract;
    });
    uploadDataToSessionStorage
      .mockResolvedValueOnce({
        storageRef: { backend: 'cloudflare', id: CF_RESPONSE_ID, resource: 'responses' },
      })
      .mockResolvedValueOnce({
        storageRef: { backend: 'cloudflare', id: CF_RESPONSE_ID, resource: 'responses' },
      });

    await submitResponses(
      'wagmi',
      [QUESTION_ID],
      [{ answer: 'yes' }],
      SURVEY_ID,
      { complete: true },
      CLOUDFLARE_GROUP_CFG,
    );

    expect(arweaveScripts.uploadDataToArweave).not.toHaveBeenCalled();
    expect(uploadDataToSessionStorage).toHaveBeenCalledTimes(2);
    expect(uploadDataToSessionStorage.mock.calls.every((call) => call[2].resource === 'responses')).toBe(true);
    expect(uploadDataToSessionStorage.mock.calls[0][2].context).toEqual(expect.objectContaining({
      account: TEST_ADDRESS,
      chainId: 84532,
      providerLike: expect.any(Object),
      signer: expect.any(Object),
    }));
    expect(mockSurveyContract.interface.encodeFunctionData).toHaveBeenCalledWith('submitResponses', [
      [expect.any(String)],
      [`0x${'22'.repeat(32)}`],
      expect.any(String),
      `0x${'22'.repeat(32)}`,
    ]);
  });

  it('resolves Cloudflare question pointers through session storage before Arweave fallback', async () => {
    arweaveScripts.hexToBase64url.mockReturnValue(CF_QUESTION_ID);
    readSessionStorageBlob.mockResolvedValue(new Response(JSON.stringify({
      id: QUESTION_ID,
      prompt: 'Loaded from Cloudflare storage',
      questionType: 'freeform',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const mockSurveyContract = {
      getQuestionHash: jest.fn(async () => `0x${'22'.repeat(32)}`),
    };
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockSurveyContract;
    });

    const result = await contractScripts.getQuestionData(
      'none',
      QUESTION_ID,
      CLOUDFLARE_GROUP_CFG,
      { skipDecrypt: true },
    );

    expect(readSessionStorageBlob).toHaveBeenCalledTimes(1);
    expect(readSessionStorageBlob.mock.calls[0][0].storageRef).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      id: CF_QUESTION_ID,
      resource: 'questions',
    }));
    expect(result.prompt).toBe('Loaded from Cloudflare storage');
    expect(result.storageRef).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      id: CF_QUESTION_ID,
      resource: 'questions',
    }));
    expect(result.arweaveTxId).toBeUndefined();
  });

  it('broadcasts SBT writes by tx hash instead of relying on ethers transaction response formatting', async () => {
    const rpcProvider = makeRpcProvider();
    window.ethereum = rpcProvider;

    const mockSbtContract = {
      address: TEST_ADDRESS,
      interface: {
        encodeFunctionData: jest.fn(() => '0xfacefeed'),
      },
      estimateGas: {
        claim: jest.fn(async () => ethers.BigNumber.from('100000')),
        addHashedPasswords: jest.fn(async () => ethers.BigNumber.from('200000')),
        burn: jest.fn(async () => ethers.BigNumber.from('150000')),
      },
      claim: jest.fn(async () => {
        throw new Error('old ethers tx response path should not be used');
      }),
      addHashedPasswords: jest.fn(async () => {
        throw new Error('old ethers tx response path should not be used');
      }),
      burn: jest.fn(async () => {
        throw new Error('old ethers tx response path should not be used');
      }),
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return mockSbtContract;
    });

    const hashedPassword = `0x${'11'.repeat(32)}`;
    const claimReceipt = await contractScripts.claim('wagmi', TEST_ADDRESS);
    const addPasswordsReceipt = await contractScripts.addHashedPasswords('wagmi', TEST_ADDRESS, [hashedPassword]);
    const burnReceipt = await contractScripts.burnToken('wagmi', TEST_ADDRESS, 7);

    expect(claimReceipt).toEqual({ status: 1, transactionHash: '0xtxhash' });
    expect(addPasswordsReceipt).toEqual({ status: 1, transactionHash: '0xtxhash' });
    expect(burnReceipt).toEqual({ status: 1, transactionHash: '0xtxhash' });
    expect(mockSbtContract.claim).not.toHaveBeenCalled();
    expect(mockSbtContract.addHashedPasswords).not.toHaveBeenCalled();
    expect(mockSbtContract.burn).not.toHaveBeenCalled();

    const sendCalls = rpcProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction'
    );
    expect(sendCalls).toHaveLength(3);
    expect(sendCalls[0][0].params[0]).toEqual(expect.objectContaining({
      from: TEST_ADDRESS,
      to: TEST_ADDRESS,
      data: '0xfacefeed',
      gas: ethers.BigNumber.from('400000').toHexString(),
    }));
    expect(sendCalls[1][0].params[0].gas).toBe(ethers.BigNumber.from('280000').toHexString());
    expect(sendCalls[2][0].params[0].gas).toBe(ethers.BigNumber.from('500000').toHexString());
  });
});
