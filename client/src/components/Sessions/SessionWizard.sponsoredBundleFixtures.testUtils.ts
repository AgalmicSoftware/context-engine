const createDefaultFetchMock = () =>
  jest.fn(async (url) => {
    const normalizedUrl = String(url);
    if (
      normalizedUrl === 'test-file-stub' ||
      normalizedUrl.includes('sessionCorsWorker') ||
      normalizedUrl.endsWith('.txt')
    ) {
      return {
        ok: true,
        text: async () => 'export default { fetch() { return new Response("ok"); } };',
        headers: { get: jest.fn(() => 'application/javascript') },
      };
    }
    return {
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '',
      headers: { get: jest.fn(() => 'application/json') },
    };
  });

const buildDecryptedSponsoredBundle = (overrides = {}) => {
  const base = {
    openaiKey: 'sponsored-openai',
    anthropicKey: 'sponsored-anthropic',
    openrouterKey: 'sponsored-openrouter',
    arweaveJwk: '{"kty":"RSA"}',
    faucetPrivateKey: '0xsponsoredfaucet',
    customRpcUrl: 'https://sponsored-rpc.example.test',
    litAccountApiKey: 'lit-account-secret',
    customRpcKey: 'ignore-me',
    meta: {
      label: 'Launch Week',
      createdAt: '2099-03-20T12:00:00.000Z',
      createdBy: '0xadmin',
      expiresAt: '2099-03-21T12:00:00.000Z',
      sourceSessionSlug: 'source-session',
      sourceWorkerUrl: 'https://source-worker.example.test',
    },
  };
  return {
    ...base,
    ...overrides,
    meta: {
      ...base.meta,
      ...(overrides?.meta || {}),
    },
  };
};

const seedWizardCache = ({
  workerSecrets = {},
  workerSecretsEnabled = true,
  persistWorkerSecrets = true,
  draft = {},
  deployComplete = false,
  deployWorkerUrl = '',
} = {}) => {
  sessionStorage.setItem(
    'ce:sessionWizardDraft:v1',
    JSON.stringify({
      draft: {
        ai: {
          models: {
            fast: { provider: 'openrouter', model: 'test-fast' },
            thinking: { provider: 'anthropic', model: 'test-thinking' },
          },
        },
        ...draft,
      },
      workerSecrets,
      workerSecretsEnabled,
      persistWorkerSecrets,
      deployComplete,
      deployWorkerUrl,
    }),
  );
};

const buildEnvelope = () =>
  JSON.stringify({
    type: 'contextengine-sponsored-bundle',
    version: 1,
    cipher: 'password-aes-gcm',
    encryptedData: 'encrypted-base64',
  });

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const buildMockContractViewerContracts = ({ sessionContracts = {} } = {}) =>
  Object.keys(sessionContracts).map((contractKey) => ({
    key: contractKey,
    name:
      contractKey === 'surveys'
        ? 'Questions and Surveys'
        : contractKey === 'sbtFactory'
          ? 'SBT Factory'
          : contractKey === 'sessionRegistry'
            ? 'Session Registry'
            : contractKey,
    explainer: `Explainer for ${contractKey}`,
    sourceFile:
      contractKey === 'surveys'
        ? 'Surveys.sol'
        : contractKey === 'sbtFactory'
          ? 'SBTFactory.sol'
          : contractKey === 'sessionRegistry'
            ? 'SessionRegistry.sol'
            : 'Contract.sol',
    source: `contract ${contractKey} {}`,
    addresses: sessionContracts[contractKey]?.address
      ? [
          {
            address: sessionContracts[contractKey].address,
            id: sessionContracts[contractKey].chainId || 84532,
            testnet: true,
            explorerUrl: `https://example.example.test/${contractKey}`,
          },
        ]
      : [],
  }));

export {
  buildDecryptedSponsoredBundle,
  buildEnvelope,
  buildMockContractViewerContracts,
  createDefaultFetchMock,
  createDeferred,
  seedWizardCache,
};
