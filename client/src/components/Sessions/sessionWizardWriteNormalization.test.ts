import { ethers } from 'ethers';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn((providerLike) => providerLike || null),
  },
}));

import { getSessionRegistryAddress } from '../../variables/chains.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { setSessionFieldsOnChain } from '../../utilities/web3/sessionRegistry.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  buildSessionWizardRegistrySessionFields,
  buildSessionWizardWorkerConfigPayload,
  sanitizeSessionWizardMetadataPayload,
} from './sessionWizardWriteNormalization.js';
import { resolveSessionWizardEnabledWorkerSecrets } from './sessionWizardWorkerSecretSupport';

const DEFAULT_CONFIG_CHAIN_ID = DEFAULT_CHAIN_ID;

describe('sessionWizardWriteNormalization', () => {
  beforeEach(() => {
    const getProviderMock = cryptoUtils._getProvider as jest.Mock;
    getProviderMock.mockReset();
    getProviderMock.mockImplementation((providerLike: any) => providerLike || null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sanitizeSessionWizardMetadataPayload strips worker-only fields from Arweave metadata', () => {
    const metadata = sanitizeSessionWizardMetadataPayload(
      {
        slug: 'edge',
        sessionName: '  Edge Session  ',
        sessionInfo: '  Session info  ',
        sessionHeader: ' https://images.example/header.png ',
        corsWorkerUrl: 'https://worker.example',
        corsWorkerURL: 'https://worker-alias.example',
        allowOrigins: ['https://app.example'],
        limits: { perWalletPerDay: 10 },
        rpcEndpoint: 'https://rpc.example',
        embeddedDeployHelperEnabled: false,
        rpcUrl: 'https://rpc-worker-alias.example',
        rpcUrlsByChainId: { 84532: ['https://rpc-chain.example'] },
        scopes: { ai: true },
        sponsored: { gate: 'registry-only' },
        sponsoredSbtAddress: '0x123',
        faucet: {
          rpcUrl: 'https://faucet-rpc.example',
          amountEth: '0.0002',
          privateKey: '0xpriv',
          encryptedPrivateKey: 'enc',
        },
        contracts: {
          surveys: { address: '0x111', chainId: 84532 },
          reputation: { address: '0x999', chainId: 84532 },
        },
        blockLimits: { start: '100', end: '120' },
      },
      {
        fieldOrder: ['slug', 'sessionName', 'sessionInfo', 'sessionHeaderImg', 'faucet', 'contracts', 'blockLimits'],
      },
    );

    expect(metadata).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      sessionInfo: 'Session info',
      sessionHeaderImg: 'https://images.example/header.png',
      faucet: { amountEth: '0.0002' },
      contracts: {
        surveys: { address: '0x111', chainId: 84532 },
      },
      blockLimits: { start: 100, end: 120 },
    });
  });

  test('sanitizeSessionWizardMetadataPayload writes profile-only mode metadata', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.telegram = true;
    profile.surfaces.miniApp = true;

    const metadata = sanitizeSessionWizardMetadataPayload({
      slug: 'profile-session',
      sessionName: 'Profile Session',
      sessionModeProfile: profile,
      telegramOnly: true,
      sessionMode: 'telegram_only',
      telegramBridgeEnabled: true,
      telegram: { only: true, mode: 'telegram_only' },
    });

    expect(metadata.sessionModeProfile).toEqual(profile);
    expect(metadata.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: expect.objectContaining({ mode: 'worker_sbt_gate' }),
      }),
    );
    expect(metadata.telegramOnly).toBeUndefined();
    expect(metadata.sessionMode).toBeUndefined();
    expect(metadata.telegramBridgeEnabled).toBeUndefined();
    expect(metadata.telegram).toBeUndefined();
  });

  test('publication normalization rejects invalid profiles before compiling storage metadata', () => {
    const malformedProfile = {
      profileVersion: 1,
      preset: 'custom',
      authority: { mode: 'worker_canonical' },
    };

    expect(() =>
      sanitizeSessionWizardMetadataPayload({
        slug: 'invalid-profile',
        sessionModeProfile: malformedProfile,
        storageProfile: { backend: 'cloudflare' },
      }),
    ).toThrow(/requires a reachable session mode profile/i);

    expect(() =>
      buildSessionWizardWorkerConfigPayload({
        slug: 'invalid-profile',
        draft: {
          sessionModeProfile: malformedProfile,
          storageProfile: { backend: 'cloudflare' },
        },
      }),
    ).toThrow(/requires a reachable session mode profile/i);
  });

  test('sanitizeSessionWizardMetadataPayload upgrades legacy Telegram flags to a profile without dual-write fields', () => {
    const metadata = sanitizeSessionWizardMetadataPayload({
      slug: 'legacy-telegram',
      sessionName: 'Legacy Telegram',
      telegramOnly: true,
      storageProfile: { backend: 'cloudflare' },
    });

    expect(metadata.sessionModeProfile).toEqual(
      expect.objectContaining({
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
        surfaces: expect.objectContaining({ telegram: true, miniApp: true, web: true }),
      }),
    );
    expect(metadata.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: expect.objectContaining({ mode: 'worker_sbt_gate' }),
      }),
    );
    expect(metadata.telegramOnly).toBeUndefined();
    expect(metadata.sessionMode).toBeUndefined();
    expect(metadata.telegramBridgeEnabled).toBeUndefined();
  });

  test('buildSessionWizardRegistrySessionFields keeps compatibility mirrors and sponsored flags only', () => {
    expect(
      buildSessionWizardRegistrySessionFields({
        onChainFields: {
          corsWorkerUrl: ' https://worker.example ',
          rpcUrl: ' https://rpc.example ',
          unexpectedField: 'should-not-pass-through',
        },
        sponsoredFields: {
          sponsored_ai: '1',
          sponsored_rpc: '',
          sponsored_arweave: '0',
        },
      }),
    ).toEqual({
      corsWorkerUrl: 'https://worker.example',
      rpcUrl: 'https://rpc.example',
      sponsored_ai: '1',
      sponsored_arweave: '0',
    });
  });

  test('buildSessionWizardRegistrySessionFields keeps worker-private RPC out of public registry fields', () => {
    expect(
      buildSessionWizardRegistrySessionFields({
        onChainFields: {
          rpcUrl: 'https://draft-rpc.example',
        },
        sponsoredFields: {
          sponsored_rpc: '1',
        },
      }),
    ).toEqual({
      rpcUrl: 'https://draft-rpc.example',
      sponsored_rpc: '1',
    });
  });

  test('buildSessionWizardRegistrySessionFields omits RPC when no public registry field exists', () => {
    expect(
      buildSessionWizardRegistrySessionFields({
        onChainFields: {},
      }),
    ).toEqual({});
    expect(
      buildSessionWizardRegistrySessionFields({
        onChainFields: {
          rpcUrl: ' https://browser-visible-rpc.example ',
        },
      }),
    ).toEqual({
      rpcUrl: 'https://browser-visible-rpc.example',
    });
  });

  test('buildSessionWizardRegistrySessionFields ignores uploaded custom RPC secrets', () => {
    const enabledSecrets = resolveSessionWizardEnabledWorkerSecrets({
      workerSecretsEnabled: true,
      workerSecrets: {
        customRpcUrl: ' https://uploaded-rpc.example ',
      },
    });

    expect(
      buildSessionWizardRegistrySessionFields({
        onChainFields: {},
        sponsoredFields: {
          sponsored_rpc: '0',
        },
      }),
    ).toEqual({
      sponsored_rpc: '0',
    });
    expect(enabledSecrets.customRpcUrl).toBe('https://uploaded-rpc.example');
  });

  test('buildSessionWizardRegistrySessionFields preserves empty worker URL clears for registry writes', async () => {
    const walletProvider = {
      request: jest.fn(async ({ method }) => (method === 'eth_sendTransaction' ? '0xtxhash' : null)),
    };
    const signer = {
      provider: null,
      getAddress: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000aa'),
      getChainId: jest.fn().mockResolvedValue(DEFAULT_CONFIG_CHAIN_ID),
    };
    const contractMock = {
      address: getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID),
      interface: {
        encodeFunctionData: jest.fn(() => '0xdeadbeef'),
      },
      estimateGas: {
        setSessionFields: jest.fn(),
      },
      setSessionFields: jest.fn(),
    };
    const web3ProviderMock = {
      getSigner: () => signer,
      waitForTransaction: jest.fn().mockResolvedValue({ status: 1, transactionHash: '0xtxhash' }),
    };

    jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
      return web3ProviderMock as any;
    } as any);
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock as any;
    } as any);

    const onChainFields = buildSessionWizardRegistrySessionFields({
      onChainFields: {
        corsWorkerUrl: '',
      },
    });

    expect(onChainFields).toEqual({
      corsWorkerUrl: '',
    });

    await setSessionFieldsOnChain({
      providerLike: walletProvider,
      chainId: DEFAULT_CONFIG_CHAIN_ID,
      slug: 'edge',
      fields: onChainFields,
      gasPriceGwei: '1',
    });

    expect(contractMock.estimateGas.setSessionFields).not.toHaveBeenCalled();
    expect(walletProvider.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_sendTransaction',
        params: [
          expect.objectContaining({
            from: '0x00000000000000000000000000000000000000aa',
            to: getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID),
            data: '0xdeadbeef',
            gas: ethers.BigNumber.from('300000').toHexString(),
          }),
        ],
      }),
    );
    expect(web3ProviderMock.waitForTransaction).toHaveBeenCalledWith('0xtxhash');
  });

  test('buildSessionWizardWorkerConfigPayload writes worker config authority fields to Worker KV payloads', () => {
    const payload = buildSessionWizardWorkerConfigPayload({
      slug: 'edge',
      draft: {
        networkChainId: DEFAULT_CONFIG_CHAIN_ID,
        corsWorkerUrl: 'https://draft-worker.example',
        blockLimits: { start: '250', end: '275' },
        contracts: {
          surveys: { address: '0x111', chainId: DEFAULT_CONFIG_CHAIN_ID },
          reputation: { address: '0x999', chainId: DEFAULT_CONFIG_CHAIN_ID },
        },
      },
      deployPayload: {
        adminAddress: ' 0xAdmin ',
        registryAddress: ' 0xRegistry ',
        registryChainId: DEFAULT_CONFIG_CHAIN_ID,
        rpcUrl: ' https://rpc.example ',
        rpcUrlsByChainId: { [DEFAULT_CONFIG_CHAIN_ID]: ['https://rpc.example'] },
        allowOrigins: ['https://app.example'],
        limits: { perWalletPerDay: 1000 },
        scopes: { ai: true },
        embeddedDeployHelperEnabled: false,
        faucet: {
          rpcUrl: 'https://faucet-rpc.example',
          amountEth: '0.0002',
          balanceThresholdEth: '0.001',
        },
      },
      workerSecrets: {
        litApiBase: ' https://api.chipotle.litprotocol.com ',
        litGroupId: ' group_123 ',
        litPkpId: ' pkp_123 ',
        litActionCid: ' bafy123 ',
        litUsageApiKey: 'lit-secret',
      },
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      workerUrl: ' https://worker.example/ ',
      latestChainBlock: 500,
      resolveWorkerFaucetConfig: () => ({
        rpcUrl: 'https://fallback-faucet.example',
        amountEth: '0.0003',
        balanceThresholdEth: '0.002',
      }),
    });

    expect(payload.slug).toBe('edge');
    expect(payload.adminAddress).toBe('0xAdmin');
    expect(payload.registryAddress).toBe('0xRegistry');
    expect(payload.registryChainId).toBe(DEFAULT_CONFIG_CHAIN_ID);
    expect(payload.networkChainId).toBe(DEFAULT_CONFIG_CHAIN_ID);
    expect(payload.corsWorkerUrl).toBe('https://worker.example/');
    expect(payload.rpcUrl).toBe('https://rpc.example');
    expect(payload.blockLimits).toEqual({ start: 250, end: 275 });
    expect(payload.embeddedDeployHelperEnabled).toBe(false);
    expect(payload.litCredentials).toEqual({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    });
    expect(payload.sessionId).toBe('0x123e4567e89b12d3a456426614174000');
    expect(payload.contracts.surveys).toEqual({ address: '0x111', chainId: DEFAULT_CONFIG_CHAIN_ID });
    expect(payload.contracts.sessionRegistry).toEqual({
      address: getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID),
      chainId: DEFAULT_CONFIG_CHAIN_ID,
    });
    expect(payload.contracts.reputation).toBeUndefined();
  });

  test('buildSessionWizardWorkerConfigPayload emits a reload-safe two-key worker-canonical config', () => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const payload = buildSessionWizardWorkerConfigPayload({
      slug: 'two-key-session',
      draft: {
        sessionName: 'Two Key Session',
        sessionInfo: 'Worker-canonical session content.',
        sessionHeaderImg: 'https://images.example/header.png',
        networkChainId: DEFAULT_CONFIG_CHAIN_ID,
        blockLimits: { start: 250 },
        contracts: {
          surveys: { address: '0x111', chainId: DEFAULT_CONFIG_CHAIN_ID },
        },
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-4o-mini' },
            thinking: { provider: 'openai', model: 'gpt-4o' },
            // The default wizard draft always carries this browser-only key,
            // even when its value is empty. It must not reach worker config.
            transcription: { provider: 'openai', model: 'whisper-1', rpcUrl: '' },
          },
        },
        sessionModeProfile,
      },
      deployPayload: {
        apiToken: 'must-never-persist',
        openaiKey: 'must-never-persist',
        registryAddress: '0xRegistry',
        registryChainId: DEFAULT_CONFIG_CHAIN_ID,
        rpcUrl: 'https://rpc.example',
        rpcUrlsByChainId: { [DEFAULT_CONFIG_CHAIN_ID]: ['https://rpc.example'] },
        faucet: { rpcUrl: 'https://faucet.example' },
        allowOrigins: ['https://app.example'],
      },
      workerSecrets: {
        litUsageApiKey: 'must-never-persist',
      },
      account: '0x00000000000000000000000000000000000000aa',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      workerUrl: 'https://worker.example',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        slug: 'two-key-session',
        sessionId: '0x123e4567e89b12d3a456426614174000',
        sessionName: 'Two Key Session',
        sessionInfo: 'Worker-canonical session content.',
        sessionHeaderImg: 'https://images.example/header.png',
        adminAddress: '0x00000000000000000000000000000000000000aa',
        workerAuthority: {
          version: 1,
          participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'],
          anonymousScopes: [],
        },
        groupCreationPolicy: 'participants',
      }),
    );
    expect(payload.contracts).toBeUndefined();
    expect(payload.blockLimits).toBeUndefined();
    expect(payload.registryAddress).toBeUndefined();
    expect(payload.registryChainId).toBeUndefined();
    expect(payload.networkChainId).toBeUndefined();
    expect(payload.rpcUrl).toBeUndefined();
    expect(payload.rpcUrlsByChainId).toBeUndefined();
    expect(payload.faucet).toBeUndefined();
    expect(payload.litCredentials).toBeUndefined();
    expect(payload.ai.models.transcription).toEqual({ provider: 'openai', model: 'whisper-1' });
    expect(payload.ai.models.transcription).not.toHaveProperty('rpcUrl');
    expect(JSON.stringify(payload)).not.toMatch(/must-never-persist|0xRegistry|rpc\.example|faucet\.example/i);
  });

  test('buildSessionWizardWorkerConfigPayload preserves an explicit admin-only group creation policy', () => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const payload = buildSessionWizardWorkerConfigPayload({
      slug: 'restricted-groups',
      draft: {
        sessionModeProfile,
        groupCreationPolicy: 'admin_only',
      },
      account: '0x00000000000000000000000000000000000000aa',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      workerUrl: 'https://worker.example',
    });

    expect(payload.groupCreationPolicy).toBe('admin_only');
  });

  test('buildSessionWizardWorkerConfigPayload keeps only the Lit public descriptor for worker-canonical Lit mode', () => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionModeProfile.encryption = { mode: 'lit' };
    sessionModeProfile.evm.registryChainId = DEFAULT_CONFIG_CHAIN_ID;
    sessionModeProfile.storage.payloadAccessControl = {
      ...sessionModeProfile.storage.payloadAccessControl!,
      encryption: 'lit',
    };

    const payload = buildSessionWizardWorkerConfigPayload({
      slug: 'worker-lit-session',
      draft: {
        sessionName: 'Worker Lit Session',
        networkChainId: DEFAULT_CONFIG_CHAIN_ID,
        sessionModeProfile,
      },
      deployPayload: {
        rpcUrl: 'https://rpc.example',
        rpcUrlsByChainId: { [DEFAULT_CONFIG_CHAIN_ID]: ['https://rpc.example'] },
      },
      workerSecrets: {
        litApiBase: ' https://api.chipotle.litprotocol.com ',
        litGroupId: ' group_123 ',
        litPkpId: ' pkp_123 ',
        litActionCid: ' bafy123 ',
        litAccountApiKey: 'must-never-persist',
        litUsageApiKey: 'must-never-persist',
      },
      account: '0x00000000000000000000000000000000000000aa',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      workerUrl: 'https://worker.example',
    });

    expect(payload.litCredentials).toEqual({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    });
    expect(payload.networkChainId).toBe(DEFAULT_CONFIG_CHAIN_ID);
    expect(payload.rpcUrl).toBeUndefined();
    expect(payload.rpcUrlsByChainId).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('must-never-persist');
  });
  test('session storage profile is session-owned metadata and worker config, with Cloudflare secrets omitted', () => {
    const metadata = sanitizeSessionWizardMetadataPayload(
      {
        slug: 'storage-edge',
        sessionName: 'Storage Edge',
        storageProfile: {
          backend: 'cloudflare',
          cloudflare: {
            accountId: 'must-not-pass-through',
            bucketName: 'private-bucket',
            workerToken: 'cf-secret-token',
          },
        },
      },
      {
        fieldOrder: ['slug', 'sessionName', 'storageProfile'],
      },
    );

    expect(metadata.storageProfile.backend).toBe('cloudflare');
    expect(metadata.storageProfile.sessionOwned).toBe(true);
    expect(metadata.storageProfile.telegramOwned).toBe(false);
    expect(metadata.storageProfile.resources.docsContext).toBe('active');
    expect(metadata.storageProfile.resources.questions).toBe('active');
    expect(metadata.storageProfile.resources.surveys).toBe('active');
    expect(metadata.storageProfile.resources.responses).toBe('active');
    expect(metadata.storageProfile.payloadAccessControl.mode).toBe('worker_sbt_gate');
    expect(metadata.storageProfile.payloadAccessControl.resources.docsContext).toBe('docUploads');
    expect(metadata.storageProfile.sbtGatedAccess.litRequired).toBe('not_required_worker_enforced');
    expect(metadata.storageProfile.cloudflare.primitives.r2).toContain('question_payloads');
    expect(metadata.storageProfile.cloudflare.primitives.r2).toContain('response_payloads');
    expect(metadata.storageProfile.cloudflare.payloadAccessMode).toBe('worker_sbt_gate');
    expect(JSON.stringify(metadata)).not.toMatch(/private-bucket|cf-secret-token|must-not-pass-through/i);

    const workerPayload = buildSessionWizardWorkerConfigPayload({
      slug: 'storage-edge',
      draft: {
        networkChainId: DEFAULT_CONFIG_CHAIN_ID,
        storageProfile: { backend: 'cloudflare' },
      },
      deployPayload: {},
    });

    expect(workerPayload.storageProfile.backend).toBe('cloudflare');
    expect(workerPayload.storageProfile.sessionOwned).toBe(true);
    expect(workerPayload.storageProfile.telegramOwned).toBe(false);
    expect(workerPayload.storageProfile.payloadAccessControl.mode).toBe('worker_sbt_gate');
    expect(workerPayload.litCredentials).toEqual({});
  });

  test('legacy Telegram mode is published as profile-only session metadata', () => {
    const metadata = sanitizeSessionWizardMetadataPayload(
      {
        slug: 'telegram-native',
        sessionName: 'Telegram Native',
        telegramOnly: true,
        storageProfile: { backend: 'cloudflare', payloadAccessControl: { mode: 'public_read' } },
      },
      {
        fieldOrder: ['slug', 'sessionName', 'telegramOnly', 'storageProfile'],
      },
    );

    expect(metadata.sessionModeProfile).toEqual(
      expect.objectContaining({
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
        surfaces: expect.objectContaining({ telegram: true, miniApp: true, web: true }),
      }),
    );
    expect(metadata.telegramOnly).toBeUndefined();
    expect(metadata.sessionMode).toBeUndefined();
    expect(metadata.telegramBridgeEnabled).toBeUndefined();
    expect(metadata.telegram).toBeUndefined();

    const workerPayload = buildSessionWizardWorkerConfigPayload({
      slug: 'telegram-native',
      draft: {
        networkChainId: DEFAULT_CONFIG_CHAIN_ID,
        telegramOnly: true,
        storageProfile: { backend: 'cloudflare', payloadAccessControl: { mode: 'public_read' } },
      },
      deployPayload: {},
    });

    expect(workerPayload.sessionModeProfile).toEqual(
      expect.objectContaining({
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
        surfaces: expect.objectContaining({ telegram: true, miniApp: true, web: true }),
      }),
    );
    expect(workerPayload.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: expect.objectContaining({ mode: 'public_read' }),
      }),
    );
    expect(workerPayload.telegramOnly).toBeUndefined();
    expect(workerPayload.sessionMode).toBeUndefined();
    expect(workerPayload.telegramBridgeEnabled).toBeUndefined();
  });
});
