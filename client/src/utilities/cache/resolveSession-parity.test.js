const APP_CONFIG_MODULE = '../../variables/appConfig.js';
const SESSION_REGISTRY_MODULE = '../web3/sessionRegistry.js';
const SESSION_WORKER_CONFIG_CACHE_MODULE = '../session/sessionWorkerConfigCache.js';
const LOCAL_RESOLVER_MODULE = '../cache/contractScriptsCache.js';
const EXPORTED_RESOLVER_MODULE = '../web3/sessionConfigResolvers.js';
const SESSION_SOURCE_RESOLVER_MODULE = '../session/sessionSourceResolver.js';
const CONTRACT_SCRIPTS_IMPL_MODULE = '../web3/contractScripts.impl.js';
const RPC_PROVIDERS_MODULE = '../web3/rpcProviders.js';

const REGISTRY_POPULATED_CACHE = {
  sessions: {
    alpha: {
      slug: 'alpha',
      sessionName: '  Alpha Session  ',
      orgName: 'LegacyOrg',
      orgInfo: 'LegacyInfo',
      encryptedOrgInfo: 'encData',
      networkChainId: 84532,
      contracts: {
        surveys: {
          address: '0x1111111111111111111111111111111111111111',
        },
      },
    },
    '': {
      slug: '',
      sessionName: 'Registry General',
      networkChainId: 84532,
      contracts: {
        surveys: {
          address: '0x2222222222222222222222222222222222222222',
        },
      },
    },
  },
};

let mockRegistryCache = null;

const RAW_ALPHA_REGISTRY_SESSION = REGISTRY_POPULATED_CACHE.sessions.alpha;
const NORMALIZED_ALPHA_REGISTRY_SESSION = {
  slug: 'alpha',
  sessionName: 'Alpha Session',
  networkChainId: 84532,
  contracts: {
    surveys: {
      address: '0x1111111111111111111111111111111111111111',
    },
  },
};
const NORMALIZED_GENERAL_REGISTRY_SESSION = {
  slug: '',
  sessionName: 'Registry General',
  networkChainId: 84532,
  contracts: {
    surveys: {
      address: '0x2222222222222222222222222222222222222222',
    },
  },
};

const deepClone = (value) => (typeof value === 'undefined' ? value : JSON.parse(JSON.stringify(value)));

const setRegistryCacheState = (registryState) => {
  if (registryState === 'populated') {
    mockRegistryCache = deepClone(REGISTRY_POPULATED_CACHE);
    return;
  }
  mockRegistryCache = null;
};

const canonicalizeMockSlug = (rawSlug) => {
  const slug = String(rawSlug ?? '').trim();
  if (!slug) return '';
  return slug.toLowerCase() === 'general' ? '' : slug;
};

const readMockRegistryCache = () => {
  return mockRegistryCache ? deepClone(mockRegistryCache) : null;
};

const getMockRegistrySessions = () => {
  const cache = readMockRegistryCache();
  const sessions = Object.create(null);
  if (!cache?.sessions || typeof cache.sessions !== 'object' || Array.isArray(cache.sessions)) {
    return sessions;
  }
  Object.keys(cache.sessions).forEach((key) => {
    sessions[key] = cache.sessions[key];
  });
  return sessions;
};

const mockSessionRegistryGetSessionConfig = jest.fn();
const mockSessionRegistryReadCache = jest.fn();
const mockSessionRegistryGetAllSessionEntries = jest.fn();
const mockSessionRegistryRefreshSessionRegistryFieldsCache = jest.fn();
const mockOverlayCachedSessionWorkerConfig = jest.fn();

const resetResolverMockImplementations = () => {
  mockSessionRegistryGetSessionConfig.mockReset();
  mockSessionRegistryGetSessionConfig.mockImplementation((slug) => {
    const key = canonicalizeMockSlug(slug);
    const sessions = getMockRegistrySessions();
    if (!Object.prototype.hasOwnProperty.call(sessions, key)) {
      return null;
    }
    const session = sessions[key];
    return session ? deepClone(session) : null;
  });

  mockSessionRegistryReadCache.mockReset();
  mockSessionRegistryReadCache.mockImplementation(() => readMockRegistryCache());

  mockSessionRegistryGetAllSessionEntries.mockReset();
  mockSessionRegistryGetAllSessionEntries.mockImplementation(() =>
    Object.entries(getMockRegistrySessions()).map(([key, value]) => [key, deepClone(value)]),
  );

  mockSessionRegistryRefreshSessionRegistryFieldsCache.mockReset();
  mockSessionRegistryRefreshSessionRegistryFieldsCache.mockResolvedValue(undefined);

  mockOverlayCachedSessionWorkerConfig.mockReset();
  mockOverlayCachedSessionWorkerConfig.mockImplementation(({ sessionConfig }) => sessionConfig);
};

const installResolverMocks = ({ useOnchainRegistry }) => {
  jest.doMock(APP_CONFIG_MODULE, () => {
    const actual = jest.requireActual(APP_CONFIG_MODULE);
    return {
      ...actual,
      USE_ONCHAIN_SESSION_REGISTRY: useOnchainRegistry,
    };
  });

  jest.doMock(SESSION_REGISTRY_MODULE, () => {
    return {
      sessionRegistryStore: {
        getSessionConfig: mockSessionRegistryGetSessionConfig,
        readCache: mockSessionRegistryReadCache,
        getAllSessionEntries: mockSessionRegistryGetAllSessionEntries,
      },
      refreshSessionRegistryFieldsCache: mockSessionRegistryRefreshSessionRegistryFieldsCache,
      sessionRegistryUtils: {
        refreshSessionRegistryFieldsCache: mockSessionRegistryRefreshSessionRegistryFieldsCache,
      },
    };
  });

  jest.doMock(SESSION_WORKER_CONFIG_CACHE_MODULE, () => ({
    overlayCachedSessionWorkerConfig: mockOverlayCachedSessionWorkerConfig,
  }));
};

const loadScenarioBranchModules = () => {
  let modules = null;
  jest.isolateModules(() => {
    modules = {
      localModule: require(LOCAL_RESOLVER_MODULE),
      exportedModule: require(EXPORTED_RESOLVER_MODULE),
      sessionSourceResolverModule: require(SESSION_SOURCE_RESOLVER_MODULE),
    };
  });
  return modules;
};

const loadNullSafetyCallerModules = () => {
  let modules = null;
  jest.isolateModules(() => {
    modules = {
      contractScriptsImplModule: require(CONTRACT_SCRIPTS_IMPL_MODULE),
      rpcProvidersModule: require(RPC_PROVIDERS_MODULE),
    };
  });
  return modules;
};

const clearResolverMocks = () => {
  jest.resetModules();
  jest.dontMock(APP_CONFIG_MODULE);
  jest.dontMock(SESSION_REGISTRY_MODULE);
  jest.dontMock(SESSION_WORKER_CONFIG_CACHE_MODULE);
};

const unresolvedSession = (slug) => ({
  slug,
  contracts: {},
  __unresolved: true,
});

const expectNormalizedRegistrySession = (actual, expected) => {
  expect(actual).toEqual(expected);
  expect(actual?.orgName).toBeUndefined();
  expect(actual?.orgInfo).toBeUndefined();
  expect(actual?.encryptedOrgInfo).toBeUndefined();
};

const EMPTY_LIKE_CASES = new Set([
  'empty-string',
  'null',
  'undefined',
  'object-sessionSlug-empty',
  'object-sessionSlug-general',
]);

const ALPHA_ALIAS_CASES = new Set([
  'alpha-string',
  'object-sessionSlug-alpha',
  'object-sessionSlug-alpha-with-legacy-fields',
]);

const INPUT_CASES = [
  {
    label: "input ''",
    key: 'empty-string',
    input: '',
  },
  {
    label: 'input null',
    key: 'null',
    input: null,
  },
  {
    label: 'input undefined',
    key: 'undefined',
    input: undefined,
  },
  {
    label: "input 'general'",
    key: 'general-string',
    input: 'general',
  },
  {
    label: "input 'alpha'",
    key: 'alpha-string',
    input: 'alpha',
  },
  {
    label: "input 'unknown-slug-xyz'",
    key: 'unknown-string',
    input: 'unknown-slug-xyz',
  },
  {
    label: "input { sessionSlug: '' }",
    key: 'object-sessionSlug-empty',
    input: { sessionSlug: '' },
  },
  {
    label: "input { sessionSlug: 'general' }",
    key: 'object-sessionSlug-general',
    input: { sessionSlug: 'general' },
  },
  {
    label: "input { sessionSlug: 'alpha' }",
    key: 'object-sessionSlug-alpha',
    input: { sessionSlug: 'alpha' },
  },
  {
    label: "input { slug: 'alpha' }",
    key: 'object-slug-alpha',
    input: { slug: 'alpha' },
  },
  {
    label: "input { _isWeb3Context: true, groupKeyOrCfg: 'alpha' }",
    key: 'object-web3-context-alpha',
    input: { _isWeb3Context: true, groupKeyOrCfg: 'alpha' },
  },
  {
    label: "input { sessionSlug: 'alpha', legacy naming fields }",
    key: 'object-sessionSlug-alpha-with-legacy-fields',
    input: {
      sessionSlug: 'alpha',
      orgName: 'OldOrg',
      orgInfo: 'OldInfo',
      encryptedOrgInfo: 'enc',
      sessionName: '  Padded Name  ',
    },
  },
];

const CALLER_NULL_SAFETY = [
  {
    caller: 'getWeb3Context',
    file: 'contractScripts.impl.ts#getWeb3Context',
    safe: true,
    reason:
      'extractChainId(cfg) and getSessionAddresses(cfg) are null-tolerant, so the context is created with fallback/default-chain resolution.',
  },
  {
    caller: 'maybeDecryptSurveyPayload',
    file: 'contractScripts.impl.ts#maybeDecryptSurveyPayload',
    safe: true,
    reason: 'getDecryptContext(cfg) accepts null and later reads use cfg?.slug optional chaining.',
  },
  {
    caller: 'maybeDecryptQuestionPayload',
    file: 'contractScripts.impl.ts#maybeDecryptQuestionPayload',
    safe: true,
    reason: 'same null-tolerant decrypt-context path as survey payload decryption.',
  },
  {
    caller: 'predictSBTAddress',
    file: 'contractScripts.impl.ts#predictSBTAddress',
    safe: true,
    reason:
      'null cfg collapses to empty slug/address lookup; missing sbtFactory address returns an empty string early.',
  },
  {
    caller: 'addSurveyWithQuestions',
    file: 'contractScripts.impl.ts#addSurveyWithQuestions',
    safe: true,
    reason: 'missing surveys address is guarded and converted into an explicit session-address error.',
  },
  {
    caller: 'addQuestions',
    file: 'contractScripts.impl.ts#addQuestions',
    safe: true,
    reason: 'same guarded missing-surveys-address path as addSurveyWithQuestions.',
  },
  {
    caller: 'createSBT',
    file: 'contractScripts.impl.ts#createSBT',
    safe: true,
    reason: 'missing factory address logs and returns early instead of dereferencing null session data.',
  },
  {
    caller: 'countSBTCreated',
    file: 'contractScripts.impl.ts#countSBTCreated',
    safe: true,
    reason: 'missing factory address returns 0 as the neutral read result.',
  },
  {
    caller: 'getSbtCreationBlockByAddress',
    file: 'contractScripts.impl.ts#getSbtCreationBlockByAddress',
    safe: true,
    reason: 'getSessionAddresses(cfg) handles null and the function returns null when no factory address resolves.',
  },
  {
    caller: 'getSbtMetadata',
    file: 'contractScripts.impl.ts#getSbtMetadata',
    safe: true,
    reason: 'provider resolution and chain-id extraction both tolerate null cfg inputs.',
  },
  {
    caller: 'isPasswordValid',
    file: 'contractScripts.impl.ts#isPasswordValid',
    safe: true,
    reason: 'null-tolerant provider/chain helpers sit inside an outer try/catch that returns false on failure.',
  },
  {
    caller: 'getLocalAwareReadProviderForGroup',
    file: 'rpcProviders.js#getLocalAwareReadProviderForGroup',
    safe: true,
    reason: 'extractChainId(null) falls back through DEFAULT_CHAIN_ID before delegating to getReadProviderForGroup.',
  },
  {
    caller: 'getReadProviderForGroup',
    file: 'rpcProviders.js#getReadProviderForGroup',
    safe: true,
    reason:
      'extractChainId(null) falls back through DEFAULT_CHAIN_ID and the remaining provider-selection helpers use optional chaining.',
  },
];

const MODULE_PRIVATE_NULL_SAFE_CALLERS = new Set([
  'maybeDecryptSurveyPayload',
  'maybeDecryptQuestionPayload',
  'getLocalAwareReadProviderForGroup',
]);

const CALLER_EXPORT_RESOLVERS = {
  getWeb3Context: ({ contractScriptsImplModule }) => contractScriptsImplModule.getWeb3Context,
  predictSBTAddress: ({ contractScriptsImplModule }) => contractScriptsImplModule.default?.predictSBTAddress,
  addSurveyWithQuestions: ({ contractScriptsImplModule }) => contractScriptsImplModule.default?.addSurveyWithQuestions,
  addQuestions: ({ contractScriptsImplModule }) => contractScriptsImplModule.default?.addQuestions,
  createSBT: ({ contractScriptsImplModule }) => contractScriptsImplModule.default?.createSBT,
  countSBTCreated: ({ contractScriptsImplModule }) => contractScriptsImplModule.default?.countSBTCreated,
  getSbtCreationBlockByAddress: ({ contractScriptsImplModule }) =>
    contractScriptsImplModule.default?.getSbtCreationBlockByAddress,
  getSbtMetadata: ({ contractScriptsImplModule }) => contractScriptsImplModule.default?.getSbtMetadata,
  isPasswordValid: ({ contractScriptsImplModule }) => contractScriptsImplModule.default?.isPasswordValid,
  getReadProviderForGroup: ({ rpcProvidersModule }) => rpcProvidersModule.getReadProviderForGroup,
};

describe('resolveSession parity characterization', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    setRegistryCacheState('empty');
    resetResolverMockImplementations();
  });

  afterEach(() => {
    jest.advanceTimersByTime(200);
    localStorage.clear();
    setRegistryCacheState('empty');
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  [true, false].forEach((useOnchainRegistry) => {
    describe(`USE_ONCHAIN_SESSION_REGISTRY=${String(useOnchainRegistry)}`, () => {
      let localModule;
      let exportedModule;
      let sessionSourceResolverModule;

      beforeAll(() => {
        jest.resetModules();
        installResolverMocks({ useOnchainRegistry });
        resetResolverMockImplementations();
        ({ localModule, exportedModule, sessionSourceResolverModule } = loadScenarioBranchModules());
      });

      afterAll(() => {
        clearResolverMocks();
      });

      ['populated', 'empty'].forEach((registryState) => {
        describe(`registry cache ${registryState}`, () => {
          INPUT_CASES.forEach(({ label, key, input }) => {
            it(label, () => {
              setRegistryCacheState(registryState);
              const demoDefaultSessionConfig = sessionSourceResolverModule.getDefaultSessionConfig();

              const localResult = localModule.memoizedResolveSession(deepClone(input));
              const exportedResult = exportedModule.resolveSession(deepClone(input));

              if (EMPTY_LIKE_CASES.has(key)) {
                expect(localResult).toEqual(demoDefaultSessionConfig);

                if (registryState === 'populated') {
                  // DIVERGENCE: LOCAL hard-codes demo-general for empty/null/general inputs.
                  // DIVERGENCE: EXPORTED routes the same inputs through registry-aware getDefaultSessionConfig().
                  expectNormalizedRegistrySession(exportedResult, NORMALIZED_GENERAL_REGISTRY_SESSION);
                  return;
                }

                if (useOnchainRegistry) {
                  // DIVERGENCE: EXPORTED can return null in strict on-chain mode when the general registry entry is missing.
                  expect(exportedResult).toBeNull();
                  return;
                }

                expect(exportedResult).toEqual(demoDefaultSessionConfig);
                return;
              }

              if (key === 'object-web3-context-alpha') {
                if (registryState === 'populated') {
                  // DIVERGENCE: LOCAL unwraps memoized web3-context wrappers before resolving the slug.
                  expect(localResult).toEqual(RAW_ALPHA_REGISTRY_SESSION);
                  expect(localResult?.orgName).toBe('LegacyOrg');
                  expect(localResult?.sessionName).toBe('  Alpha Session  ');

                  // DIVERGENCE: EXPORTED resolveSession treats the wrapper as a plain object.
                  expect(exportedResult).toEqual({ _isWeb3Context: true, groupKeyOrCfg: 'alpha' });
                  return;
                }

                expect(localResult).toEqual(unresolvedSession('alpha'));
                // DIVERGENCE: EXPORTED still preserves the wrapper object when no local unwrap occurs.
                expect(exportedResult).toEqual({ _isWeb3Context: true, groupKeyOrCfg: 'alpha' });
                return;
              }

              if (ALPHA_ALIAS_CASES.has(key)) {
                if (registryState === 'populated') {
                  expect(localResult).toEqual(RAW_ALPHA_REGISTRY_SESSION);
                  expect(localResult?.orgName).toBe('LegacyOrg');
                  expect(localResult?.orgInfo).toBe('LegacyInfo');
                  expect(localResult?.encryptedOrgInfo).toBe('encData');
                  expect(localResult?.sessionName).toBe('  Alpha Session  ');

                  // DIVERGENCE: LOCAL preserves raw registry naming for non-empty known slugs.
                  // DIVERGENCE: EXPORTED normalizes registry naming and trims legacy text fields away.
                  expectNormalizedRegistrySession(exportedResult, NORMALIZED_ALPHA_REGISTRY_SESSION);
                  expect(exportedResult?.sessionName).toBe('Alpha Session');

                  if (key === 'object-sessionSlug-alpha-with-legacy-fields') {
                    expect(localResult?.orgName).not.toBe('OldOrg');
                    expect(localResult?.sessionName).not.toBe('  Padded Name  ');
                    expect(exportedResult?.sessionName).not.toBe('Padded Name');
                  }
                  return;
                }

                expect(localResult).toEqual(unresolvedSession('alpha'));
                expect(exportedResult).toEqual(unresolvedSession('alpha'));
                return;
              }

              if (key === 'general-string') {
                expect(localResult).toEqual(demoDefaultSessionConfig);

                if (registryState === 'populated') {
                  // DIVERGENCE: LOCAL canonicalizes "general" to demo-general immediately.
                  // DIVERGENCE: EXPORTED canonicalizes first, then continues through the string resolver path.
                  expectNormalizedRegistrySession(exportedResult, NORMALIZED_GENERAL_REGISTRY_SESSION);
                  return;
                }

                if (useOnchainRegistry) {
                  // DIVERGENCE: with no registry hit, EXPORTED preserves an unresolved canonical-general placeholder.
                  expect(exportedResult).toEqual(unresolvedSession(''));
                  return;
                }

                expect(exportedResult).toEqual(demoDefaultSessionConfig);
                return;
              }

              if (key === 'unknown-string') {
                expect(localResult).toEqual(unresolvedSession('unknown-slug-xyz'));
                expect(exportedResult).toEqual(unresolvedSession('unknown-slug-xyz'));
                return;
              }

              if (key === 'object-slug-alpha') {
                // No divergence here: without an explicit sessionSlug alias, both resolvers just normalize the object.
                expect(localResult).toEqual({ slug: 'alpha' });
                expect(exportedResult).toEqual({ slug: 'alpha' });
                return;
              }

              throw new Error(`Unhandled input case: ${key}`);
            });
          });
        });
      });
    });
  });

  describe('per-caller null-safety when memoizedResolveSession returns null', () => {
    let modules;

    beforeAll(() => {
      jest.resetModules();
      installResolverMocks({ useOnchainRegistry: true });
      resetResolverMockImplementations();
      setRegistryCacheState('empty');
      modules = loadNullSafetyCallerModules();
    });

    afterAll(() => {
      clearResolverMocks();
    });

    it('pins the Phase 1 caller null-safety matrix and verifies exported callers still exist', () => {
      // Live probes are intentionally out of scope for Phase 1 because these callers
      // transitively depend on ethers Contracts, providers, and network-backed setup
      // that is impractical to invoke meaningfully in this isolated unit test.
      setRegistryCacheState('empty');

      CALLER_NULL_SAFETY.forEach(({ caller }) => {
        if (MODULE_PRIVATE_NULL_SAFE_CALLERS.has(caller)) {
          // These documented callers are module-private, so there is no public export to probe here.
          return;
        }
        expect(typeof CALLER_EXPORT_RESOLVERS[caller]?.(modules)).toBe('function');
      });

      expect(CALLER_NULL_SAFETY).toEqual([
        {
          caller: 'getWeb3Context',
          file: 'contractScripts.impl.ts#getWeb3Context',
          safe: true,
          reason:
            'extractChainId(cfg) and getSessionAddresses(cfg) are null-tolerant, so the context is created with fallback/default-chain resolution.',
        },
        {
          caller: 'maybeDecryptSurveyPayload',
          file: 'contractScripts.impl.ts#maybeDecryptSurveyPayload',
          safe: true,
          reason: 'getDecryptContext(cfg) accepts null and later reads use cfg?.slug optional chaining.',
        },
        {
          caller: 'maybeDecryptQuestionPayload',
          file: 'contractScripts.impl.ts#maybeDecryptQuestionPayload',
          safe: true,
          reason: 'same null-tolerant decrypt-context path as survey payload decryption.',
        },
        {
          caller: 'predictSBTAddress',
          file: 'contractScripts.impl.ts#predictSBTAddress',
          safe: true,
          reason:
            'null cfg collapses to empty slug/address lookup; missing sbtFactory address returns an empty string early.',
        },
        {
          caller: 'addSurveyWithQuestions',
          file: 'contractScripts.impl.ts#addSurveyWithQuestions',
          safe: true,
          reason: 'missing surveys address is guarded and converted into an explicit session-address error.',
        },
        {
          caller: 'addQuestions',
          file: 'contractScripts.impl.ts#addQuestions',
          safe: true,
          reason: 'same guarded missing-surveys-address path as addSurveyWithQuestions.',
        },
        {
          caller: 'createSBT',
          file: 'contractScripts.impl.ts#createSBT',
          safe: true,
          reason: 'missing factory address logs and returns early instead of dereferencing null session data.',
        },
        {
          caller: 'countSBTCreated',
          file: 'contractScripts.impl.ts#countSBTCreated',
          safe: true,
          reason: 'missing factory address returns 0 as the neutral read result.',
        },
        {
          caller: 'getSbtCreationBlockByAddress',
          file: 'contractScripts.impl.ts#getSbtCreationBlockByAddress',
          safe: true,
          reason:
            'getSessionAddresses(cfg) handles null and the function returns null when no factory address resolves.',
        },
        {
          caller: 'getSbtMetadata',
          file: 'contractScripts.impl.ts#getSbtMetadata',
          safe: true,
          reason: 'provider resolution and chain-id extraction both tolerate null cfg inputs.',
        },
        {
          caller: 'isPasswordValid',
          file: 'contractScripts.impl.ts#isPasswordValid',
          safe: true,
          reason: 'null-tolerant provider/chain helpers sit inside an outer try/catch that returns false on failure.',
        },
        {
          caller: 'getLocalAwareReadProviderForGroup',
          file: 'rpcProviders.js#getLocalAwareReadProviderForGroup',
          safe: true,
          reason:
            'extractChainId(null) falls back through DEFAULT_CHAIN_ID before delegating to getReadProviderForGroup.',
        },
        {
          caller: 'getReadProviderForGroup',
          file: 'rpcProviders.js#getReadProviderForGroup',
          safe: true,
          reason:
            'extractChainId(null) falls back through DEFAULT_CHAIN_ID and the remaining provider-selection helpers use optional chaining.',
        },
      ]);
    });
  });
});
