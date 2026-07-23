import {
  E2E_TESTIDS,
  REGISTRY_CACHE_KEY,
  arweaveClient,
  cacheScripts,
  collectTreeNodes,
  contractScripts,
  cryptoUtils,
  getChainById,
  getDefaultHttpRpc,
  makeInstance,
  nodeHasClassName,
  normalizeArweaveUrl,
  peekCacheSyncMock,
  renderToStaticMarkup,
  resourceKeys,
  sessionRegistryStore,
  sessionRegistryUtils,
  subscribeCacheUpdatesMock,
  treeHasText,
  writeCacheOptimisticMock,
  hasSubmittedResourcesInManagedCache,
  readManagedCacheSnapshot,
  sanitizeDocumentUrls,
  selectManagedNetBucketSnapshot,
} from './CreateQuestionsAndSurveys.cacheTestUtils';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const buildRegistryLitProfile = () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.encryption = { mode: 'lit' };
  return profile;
};

describe('CreateQuestionsAndSurveys managed cache reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    try {
      delete (globalThis as any).CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete (globalThis as any).CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
  });

  it('uses scoped litHooks props for locked question submits when global hooks are absent', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const stopAfterLitGuard = new Error('passed lit hook guard');
    try {
      try {
        delete (window as any).__litHooks;
      } catch (_) {}
      try {
        delete (window as any).litHooks;
      } catch (_) {}
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'demo-2',
        sessionSlug: 'demo-2',
        network: { id: 84532, chainId: 84532 },
        networkChainId: 84532,
        litHooks: { saveKey: jest.fn() },
        sessionConfig: {
          slug: 'demo-2',
          networkChainId: 84532,
        },
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-2',
        networkChainId: 84532,
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default: {
            id: 'default',
            gateId: 'default',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 84532,
            mode: 'any',
          },
        },
      }));
      instance.removeDuplicateQuestions = jest.fn(() => {
        throw stopAfterLitGuard;
      });
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [
          {
            id: 'q1',
            type: 'freeform',
            prompt: 'Prompt 1',
            tags: [],
            lockGateIds: ['default'],
          },
        ],
      };

      await instance.createSurvey();

      expect(instance.state.submissionError).toBe('passed lit hook guard');
      expect(instance.state.submissionError).not.toContain('Lit hooks not initialized');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('derives Chipotle hooks from session config for locked question submits when globals are absent', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const stopAfterLitGuard = new Error('passed derived lit hook guard');
    try {
      try {
        delete (window as any).__litHooks;
      } catch (_) {}
      try {
        delete (window as any).litHooks;
      } catch (_) {}
      const sessionConfig = {
        slug: 'chipotle-session',
        networkChainId: 11155420,
        corsWorkerUrl: 'https://worker.example.test',
        sessionModeProfile: buildRegistryLitProfile(),
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            default: {
              lookupStatus: 'ok',
              sbtAddresses: ['0x0000000000000000000000000000000000000101'],
              chainId: 11155420,
              mode: 'any',
            },
          },
        },
      };
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'chipotle-session',
        sessionSlug: 'chipotle-session',
        network: { id: 11155420, chainId: 11155420 },
        networkChainId: 11155420,
        sessionConfig,
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue(sessionConfig);
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default: {
            id: 'default',
            gateId: 'default',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 11155420,
            mode: 'any',
          },
        },
      }));
      instance.removeDuplicateQuestions = jest.fn(() => {
        throw stopAfterLitGuard;
      });
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [
          {
            id: 'q1',
            type: 'freeform',
            prompt: 'Prompt 1',
            tags: [],
            lockGateIds: ['default'],
          },
        ],
      };

      await instance.createSurvey();

      expect(instance.state.submissionError).toBe('passed derived lit hook guard');
      expect(instance.state.submissionError).not.toContain('Lit hooks not initialized');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('derives Chipotle hooks from registry cache when submit config lacks worker runtime fields', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const registryConfigSpy = jest.spyOn(sessionRegistryStore, 'getSessionConfig');
    const stopAfterLitGuard = new Error('passed registry-derived lit hook guard');
    try {
      try {
        delete (window as any).__litHooks;
      } catch (_) {}
      try {
        delete (window as any).litHooks;
      } catch (_) {}
      registryConfigSpy.mockReturnValue({
        slug: 'registry-chipotle',
        networkChainId: 11155420,
        corsWorkerUrl: 'https://worker.example.test',
        lit: { network: 'chipotle' },
        sessionModeProfile: buildRegistryLitProfile(),
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            default: {
              lookupStatus: 'ok',
              sbtAddresses: ['0x0000000000000000000000000000000000000101'],
              chainId: 11155420,
              mode: 'any',
            },
          },
        },
      });
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'registry-chipotle',
        sessionSlug: 'registry-chipotle',
        network: { id: 11155420, chainId: 11155420 },
        networkChainId: 11155420,
        sessionConfig: {
          slug: 'registry-chipotle',
          networkChainId: 11155420,
          contracts: {
            surveys: { chainId: 11155420 },
          },
        },
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'registry-chipotle',
        networkChainId: 11155420,
        contracts: {
          surveys: { chainId: 11155420 },
        },
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default: {
            id: 'default',
            gateId: 'default',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 11155420,
            mode: 'any',
          },
        },
      }));
      instance.removeDuplicateQuestions = jest.fn(() => {
        throw stopAfterLitGuard;
      });
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [
          {
            id: 'q1',
            type: 'freeform',
            prompt: 'Prompt 1',
            tags: [],
            lockGateIds: ['default'],
          },
        ],
      };

      await instance.createSurvey();

      expect(registryConfigSpy).toHaveBeenCalledWith('registry-chipotle');
      expect(instance.state.submissionError).toBe('passed registry-derived lit hook guard');
      expect(instance.state.submissionError).not.toContain('Lit hooks not initialized');
    } finally {
      registryConfigSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  it('applies the default session gate to untouched standalone questions before upload', async () => {
    const encryptedPromptEnvelope = {
      version: 'ce-envelope-v1',
      ciphertext: 'ciphertext',
      recipients: [{ type: 'lit-sbt-v1' }],
    };
    const encryptSpy = jest
      .spyOn(cryptoUtils, 'encryptEnvelopeValue')
      .mockResolvedValue(encryptedPromptEnvelope as any);
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

    try {
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'demo-2',
        sessionSlug: 'demo-2',
        network: { id: 84532, chainId: 84532 },
        networkChainId: 84532,
        litHooks: { saveKey: jest.fn() },
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-2',
        sessionName: 'demo 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default_gate: {
            id: 'default_gate',
            gateId: 'default_gate',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 84532,
            mode: 'any',
          },
        },
        gateOptions: [
          {
            id: 'default_gate',
            label: 'demo 2',
            badgeLabel: 'demo 2',
            color: '#5affc2',
          },
        ],
        defaultGateId: 'default_gate',
      }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        title: '',
        questions: [
          {
            id: 'q1',
            type: 'binary',
            prompt: 'Test Q Encrypted',
            tags: [],
            lockGateIds: [],
          },
        ],
        documentURLs: [],
        surveyHash: '',
      };

      await instance.createSurvey();

      expect(addQuestionsSpy).toHaveBeenCalledTimes(1);
      const uploadedQuestion = addQuestionsSpy.mock.calls[0][2][0];
      expect(uploadedQuestion).toEqual(
        expect.objectContaining({
          prompt: '[encrypted]',
          promptEncrypted: encryptedPromptEnvelope,
          encryption: expect.objectContaining({
            enabled: true,
            targets: { questions: true, questionTags: true },
          }),
        }),
      );
      expect(uploadedQuestion.prompt).not.toBe('Test Q Encrypted');
      expect(encryptSpy).toHaveBeenCalledWith(
        'Test Q Encrypted',
        expect.objectContaining({
          lit: expect.objectContaining({
            recipients: expect.arrayContaining([
              expect.objectContaining({
                chain: expect.any(String),
                accessControlConditions: expect.any(Array),
              }),
            ]),
          }),
        }),
      );
    } finally {
      encryptSpy.mockRestore();
      addQuestionsSpy.mockRestore();
    }
  });

  it('blocks default-gated standalone question submits when Lit hooks are missing', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

    try {
      try {
        delete (window as any).__litHooks;
      } catch (_) {}
      try {
        delete (window as any).litHooks;
      } catch (_) {}
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'demo-2',
        sessionSlug: 'demo-2',
        network: { id: 84532, chainId: 84532 },
        networkChainId: 84532,
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-2',
        sessionName: 'demo 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default_gate: {
            id: 'default_gate',
            gateId: 'default_gate',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 84532,
            mode: 'any',
          },
        },
        gateOptions: [
          {
            id: 'default_gate',
            label: 'demo 2',
            badgeLabel: 'demo 2',
            color: '#5affc2',
          },
        ],
        defaultGateId: 'default_gate',
      }));
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        title: '',
        questions: [
          {
            id: 'q1',
            type: 'binary',
            prompt: 'Test Q Encrypted',
            tags: [],
            lockGateIds: [],
          },
        ],
        documentURLs: [],
        surveyHash: '',
      };

      await instance.createSurvey();

      expect(addQuestionsSpy).not.toHaveBeenCalled();
      expect(instance.state.submissionError).toContain('Lit hooks not initialized');
    } finally {
      addQuestionsSpy.mockRestore();
    }
  });

  it('uses __registry.registryChainId for wagmi network guard when sessionConfig omits networkChainId', async () => {
    const instance = makeInstance({
      provider: 'wagmi',
      loginComplete: true,
      account: '0xabc',
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      sessionConfig: {
        slug: 'edge',
        contracts: {
          surveys: { address: '0x1111111111111111111111111111111111111111' },
        },
        __registry: {
          registryChainId: 84532,
        },
      },
    });
    instance.getWalletChainId = jest.fn().mockResolvedValue('0x2105');
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [
        {
          id: 'q1',
          type: 'freeform',
          prompt: 'Prompt 1',
          tags: [],
        },
      ],
    };

    await instance.createSurvey();

    expect(instance.state.needsNetworkSwitch).toBe(true);
    expect(instance.state.isSubmitting).toBe(false);
  });

  it('does not trigger the wagmi network guard when the session chain is unresolved', async () => {
    const stopAfterGuard = new Error('stop after network guard');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const instance = makeInstance({
      provider: 'wagmi',
      loginComplete: true,
      account: '0xabc',
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      sessionConfig: {
        slug: 'edge',
        networkChainId: null,
        contracts: {
          surveys: { address: '0x1111111111111111111111111111111111111111' },
        },
      },
    });
    instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
      slug: 'edge',
      networkChainId: null,
      contracts: {
        surveys: { address: '0x1111111111111111111111111111111111111111' },
      },
    });
    instance.resolveSessionChainId = jest.fn().mockReturnValue(null);
    instance.getWalletChainId = jest.fn().mockResolvedValue('0x2105');
    instance.removeDuplicateQuestions = jest.fn(() => {
      throw stopAfterGuard;
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [
        {
          id: 'q1',
          type: 'freeform',
          prompt: 'Prompt 1',
          tags: [],
        },
      ],
    };

    try {
      await instance.createSurvey();

      expect(instance.state.needsNetworkSwitch).toBe(false);
      expect(instance.removeDuplicateQuestions).toHaveBeenCalled();
      expect(instance.state.submissionError).toBe(stopAfterGuard.message);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('adds the missing wallet network with a non-PATH RPC URL', async () => {
    const originalEthereum = (window as any).ethereum;
    const request = jest.fn().mockRejectedValueOnce({ code: 4902 }).mockResolvedValueOnce(undefined);
    (window as any).ethereum = { request } as any;
    try {
      const instance = makeInstance({ provider: 'wagmi' });
      instance.resolveSessionChainId = jest.fn(() => 84532);
      instance.resolveTargetNetwork = jest.fn(() => getChainById(84532));

      await instance.switchToCorrectNetwork();

      expect(request).toHaveBeenNthCalledWith(1, {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }],
      });
      expect(request).toHaveBeenNthCalledWith(2, {
        method: 'wallet_addEthereumChain',
        params: [
          expect.objectContaining({
            rpcUrls: [getDefaultHttpRpc(84532, { allowPath: false })],
          }),
        ],
      });
    } finally {
      window.ethereum = originalEthereum;
    }
  });
});
