import { cloneSessionModePreset, compileSessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import { normalizeSessionStorageProfileConfig } from '../sessionWizardStorageProfile';
import { buildSessionSettingsDraft, buildSessionSettingsSave } from './sessionSettingsEdits';
import { buildOnChainSessionMetadata, contractsNeedChecking } from './sessionSettingsChain';
import { saveOnChainSessionSettings, syncOnChainSessionWorker } from './sessionSettingsSave';

const mockUpload = jest.fn();
const mockUpdateOnChain = jest.fn();
const mockUpsertCache = jest.fn();
const mockPostWorker = jest.fn();
const mockReadWallet = jest.fn();

jest.mock('../../../domains/sessions/registry/sessionRegistryAdminPorts', () => ({
  adminSessionRegistryPorts: {
    reads: { upsertSessionRegistryCache: (...args) => mockUpsertCache(...args) },
    writes: {
      uploadSessionMetadata: (...args) => mockUpload(...args),
      updateSessionMetadataOnChain: (...args) => mockUpdateOnChain(...args),
    },
  },
}));
jest.mock('../../../utilities/worker/signedAdminWorkerRequest', () => ({
  postSignedAdminWorkerRequest: (...args) => mockPostWorker(...args),
}));
jest.mock('./sessionSettingsWallet', () => ({
  readSigningWallet: (...args) => mockReadWallet(...args),
}));

const ADMIN = '0x00000000000000000000000000000000000000aa';
const WORKER = 'https://chain-salon.example.workers.dev';
const address = (byte) => `0x${byte.repeat(20)}`;

// A registry session as the registry cache serves it: metadata fields, the
// chain-default contracts, on-chain fields and the __registry record.
const registryConfig = (registry = {}) => {
  const profile = cloneSessionModePreset('trustless_public_decentralized');
  return {
    slug: 'chain-salon',
    sessionId: '1f1f1f1f-1f1f-1f1f-1f1f-1f1f1f1f1f1f',
    networkChainId: 11155420,
    sessionName: 'Chain salon',
    sessionInfo: 'Before.',
    corsWorkerUrl: WORKER,
    rpc: { providers: { path: { rpcUrl: 'https://rpc.example.test/v2/private' } } },
    sponsoredKeys: { ai: true },
    sessionModeProfile: profile,
    storageProfile: normalizeSessionStorageProfileConfig(compileSessionModeProfile(profile).storageProfile),
    blockLimits: { start: 100, end: null },
    faucet: { amountEth: '0.0002', balanceThresholdEth: '0.001' },
    contracts: {
      surveys: { address: address('f1'), chainId: 11155420 },
      sbtFactory: { address: address('f2'), chainId: 11155420 },
      sessionRegistry: { address: address('f3'), chainId: 11155420 },
      hats: { address: address('f4'), chainId: 11155420 },
    },
    ai: {
      models: { fast: { provider: 'openai', model: 'gpt-legacy-fast' }, thinking: { provider: 'openai', model: 'm' } },
      reasoningEffort: 'low',
      taskReasoningEffort: { generate: 'medium' },
    },
    defaultSbtTags: 'members',
    autoFeatureSBTsBySessionSlug: true,
    featured_SBTs_LIST: [],
    ignored_SBTs_LIST: [],
    __registry: {
      registryChainId: 11155420,
      chainId: 11155420,
      metadataURI: 'ar://old-metadata',
      encryptedMetadataURI: 'ar://encrypted-metadata',
      adminAddress: ADMIN,
      sessionIdHex: `0x${'1f'.repeat(16)}`,
      metadataLoadState: 'loaded',
      metadataDefaultedContractKeys: [],
      ...registry,
    },
  };
};

const edit = (config, change) => {
  const draft = buildSessionSettingsDraft(config);
  change(draft);
  return buildSessionSettingsSave(config, draft, { onChain: true });
};

describe('editing an on-chain session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockResolvedValue({ txId: 'new-metadata', metadataUri: 'ar://new-metadata' });
    mockUpdateOnChain.mockResolvedValue({ ok: true, txHash: '0xmetadatahash' });
    mockPostWorker.mockResolvedValue({ data: { ok: true } });
    mockReadWallet.mockResolvedValue({ address: ADMIN, chainId: 11155420 });
  });

  it('writes every edited field, chain-only ones included, into the new metadata', () => {
    const config = registryConfig();
    const { patch } = edit(config, (draft) => {
      draft.sessionName = 'Chain salon, part 2';
      draft.ai.models.thinking.model = 'gpt-6.1-sol';
      draft.contracts.surveys = address('e1');
      draft.blockLimits = { start: '200', end: '900' };
      draft.faucet.amountEth = '0.0005';
      draft.lists.featured_SBTs_LIST = address('a1');
      draft.lists.HIGHLIGHTED_QUESTION_IDS = 'q1';
      // Worker sessions only, for now: on-chain metadata never carries them.
      draft.agentInstructions = 'Join the Reviewers group.';
    });

    expect(Object.keys(patch).sort()).toEqual([
      'HIGHLIGHTED_QUESTION_IDS',
      'ai',
      'blockLimits',
      'contracts',
      'faucet',
      'featured_SBTs_LIST',
      'sessionName',
    ]);
    const metadata = buildOnChainSessionMetadata({ ...config, ...patch });
    expect(metadata).toMatchObject({
      slug: 'chain-salon',
      sessionName: 'Chain salon, part 2',
      blockLimits: { start: 200, end: 900 },
      faucet: { amountEth: '0.0005', balanceThresholdEth: '0.001' },
      featured_SBTs_LIST: [address('a1')],
      HIGHLIGHTED_QUESTION_IDS: ['q1'],
    });
    // A saved model outside the setup list is kept; the untouched parts of ai stay.
    expect(metadata.ai).toEqual({
      models: {
        fast: { provider: 'openai', model: 'gpt-legacy-fast' },
        thinking: { provider: 'openai', model: 'gpt-6.1-sol' },
      },
      reasoningEffort: 'low',
      taskReasoningEffort: { generate: 'medium' },
    });
    expect(metadata.contracts).toEqual({
      ...config.contracts,
      surveys: { address: address('e1'), chainId: 11155420 },
    });
    // The registry record, on-chain fields and the Worker's own fields stay out.
    ['__registry', 'sponsoredKeys', 'rpc', 'corsWorkerUrl'].forEach((key) => expect(metadata).not.toHaveProperty(key));
  });

  it('keeps a legacy choice not to feature the session’s SBTs, under the current key', () => {
    const { autoFeatureSBTsBySessionSlug: _current, ...legacy } = registryConfig();
    const config = { ...legacy, autoFeatureSBTsWithFeaturedSbtTags: false };
    const { patch } = edit(config, (draft) => {
      draft.sessionName = 'Renamed';
    });
    const metadata = buildOnChainSessionMetadata({ ...config, ...patch });
    expect(metadata.autoFeatureSBTsBySessionSlug).toBe(false);
    expect(metadata).not.toHaveProperty('autoFeatureSBTsWithFeaturedSbtTags');
  });

  it('keeps a legacy provider set with ai.mode when the models name none', () => {
    const config = {
      ...registryConfig(),
      ai: {
        mode: 'anthropic',
        models: { fast: { model: 'claude-sonnet-5-5' }, thinking: { model: 'claude-opus-5-5' } },
      },
    };
    const { patch } = edit(config, (draft) => {
      draft.sessionName = 'Renamed';
    });
    const metadata = buildOnChainSessionMetadata({ ...config, ...patch });
    expect(metadata.ai.models.fast).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5-5' });
    expect(metadata.ai.models.thinking).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });
    expect(metadata.ai).not.toHaveProperty('mode');
  });

  it('saves nothing when nothing changed, and needs a start block before it saves', () => {
    expect(edit(registryConfig(), () => {}).patch).toEqual({});
    const config = { ...registryConfig(), blockLimits: undefined };
    expect(() => edit(config, () => {})).toThrow('Set the start block');
    expect(() =>
      edit(registryConfig(), (draft) => {
        draft.blockLimits.end = '50';
      }),
    ).toThrow('The end block must be a block number after the start block.');
  });

  it('refuses synthesized contract addresses until the admin corrects or confirms them', () => {
    const config = registryConfig({
      metadataLoadState: 'unavailable',
      metadataDefaultedContractKeys: ['surveys', 'sbtFactory', 'sessionRegistry'],
    });
    const draft = buildSessionSettingsDraft(config);
    expect(contractsNeedChecking(config, draft)).toBe(true);
    expect(contractsNeedChecking(config, { ...draft, contractsChecked: true })).toBe(false);
    expect(contractsNeedChecking(config, { ...draft, contracts: { ...draft.contracts, surveys: address('e1') } })).toBe(
      false,
    );
    expect(contractsNeedChecking(registryConfig(), draft)).toBe(false);
  });

  it('uploads, updates the registry keeping the encrypted URI, caches, then syncs the Worker', async () => {
    const config = registryConfig();
    const { patch, after } = edit(config, (draft) => {
      draft.sessionName = 'Renamed on chain';
      draft.ai.reasoningEffort = 'high';
    });
    const steps = [];
    const result = await saveOnChainSessionSettings({
      before: config,
      after,
      patch,
      sessionSlug: 'chain-salon',
      account: ADMIN,
      provider: 'wagmi',
      workerOrigin: WORKER,
      authorityMode: 'evm_registry_canonical',
      onStep: (step, state) => steps.push(`${step}:${state}`),
    });

    expect(steps).toEqual([
      'wallet:running',
      'wallet:done',
      'upload:running',
      'upload:done',
      'registry:running',
      'registry:done',
      'cache:running',
      'cache:done',
      'worker:running',
      'worker:done',
    ]);
    const [uploaded, uploadOptions] = mockUpload.mock.calls[0];
    expect(uploaded).toMatchObject({ sessionName: 'Renamed on chain', ai: { reasoningEffort: 'high' } });
    expect(uploadOptions).toMatchObject({ sessionSlug: 'chain-salon', workerUrl: WORKER });
    expect(mockUpdateOnChain).toHaveBeenCalledWith({
      providerLike: 'wagmi',
      chainId: 11155420,
      slug: 'chain-salon',
      metadataURI: 'ar://new-metadata',
      encryptedMetadataURI: 'ar://encrypted-metadata',
    });
    const cached = mockUpsertCache.mock.calls[0][0].config;
    expect(cached.sessionName).toBe('Renamed on chain');
    expect(cached.__registry).toMatchObject({
      metadataURI: 'ar://new-metadata',
      encryptedMetadataURI: 'ar://encrypted-metadata',
      metadataLoadState: 'loaded',
      metadata: uploaded,
    });
    // The Worker gets the runtime fields, the edits, and all of the new ai.
    const sync = mockPostWorker.mock.calls[0][0];
    expect(sync).toMatchObject({ action: 'set-config', path: '/admin/set-config', workerUrl: WORKER });
    expect(sync.body.config).toMatchObject({
      sessionName: 'Renamed on chain',
      ai: uploaded.ai,
      blockLimits: { start: 100, end: null },
      adminAddress: ADMIN,
      registryChainId: 11155420,
    });
    expect(result).toEqual({
      txHash: '0xmetadatahash',
      nextConfig: cached,
      workerError: '',
      workerSync: expect.objectContaining({ workerOrigin: WORKER, patch: sync.body.config }),
    });
  });

  it('checks the wallet’s account and network before the paid upload', async () => {
    const config = registryConfig();
    const { patch, after } = edit(config, (draft) => {
      draft.sessionInfo = 'After.';
    });
    const save = () => {
      const steps = [];
      return {
        steps,
        done: saveOnChainSessionSettings({
          before: config,
          after,
          patch,
          sessionSlug: 'chain-salon',
          account: ADMIN,
          provider: 'wagmi',
          workerOrigin: WORKER,
          authorityMode: 'evm_registry_canonical',
          onStep: (step, state, detail) => steps.push([step, state, detail]),
        }),
      };
    };

    mockReadWallet.mockResolvedValue({ address: ADMIN, chainId: 84532 });
    const wrongNetwork = save();
    await expect(wrongNetwork.done).rejects.toThrow('Switch the wallet to');
    expect(wrongNetwork.steps.at(-1)).toEqual(['wallet', 'failed', expect.stringContaining('(11155420)')]);

    mockReadWallet.mockResolvedValue({ address: address('cc'), chainId: 11155420 });
    await expect(save().done).rejects.toThrow(`Switch it to the registry admin, ${ADMIN}.`);
    mockReadWallet.mockResolvedValue({ address: '', chainId: 0 });
    await expect(save().done).rejects.toThrow(`Connect the registry admin wallet, ${ADMIN}.`);

    expect(mockReadWallet).toHaveBeenCalledWith('wagmi');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateOnChain).not.toHaveBeenCalled();
  });

  it('reports a failed Worker sync on its own, since the on-chain update stands', async () => {
    mockPostWorker.mockRejectedValue(new Error('Admin authorization failed.'));
    const config = registryConfig();
    const { patch, after } = edit(config, (draft) => {
      draft.sessionInfo = 'After.';
    });
    const steps = [];
    const result = await saveOnChainSessionSettings({
      before: config,
      after,
      patch,
      sessionSlug: 'chain-salon',
      account: ADMIN,
      workerOrigin: WORKER,
      authorityMode: 'evm_registry_canonical',
      onStep: (step, state, detail) => steps.push([step, state, detail]),
    });
    expect(steps.at(-1)).toEqual(['worker', 'failed', 'Admin authorization failed.']);
    expect(result.workerError).toBe('Admin authorization failed.');
    expect(result.txHash).toBe('0xmetadatahash');

    // The kept sync is sent again as it was; nothing is uploaded again.
    mockPostWorker.mockResolvedValue({ data: { ok: true } });
    await syncOnChainSessionWorker(result.workerSync);
    expect(mockPostWorker).toHaveBeenCalledTimes(2);
    expect(mockPostWorker.mock.calls[1][0].body).toEqual(mockPostWorker.mock.calls[0][0].body);
    expect(mockPostWorker.mock.calls[1][0].body.config).toMatchObject({ sessionInfo: 'After.' });
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('stops before the registry when the upload fails, and skips the sync without a Worker', async () => {
    const config = registryConfig();
    const { patch, after } = edit(config, (draft) => {
      draft.sessionInfo = 'After.';
    });
    const run = (workerOrigin) => {
      const steps = [];
      return {
        steps,
        done: saveOnChainSessionSettings({
          before: config,
          after,
          patch,
          sessionSlug: 'chain-salon',
          account: ADMIN,
          workerOrigin,
          authorityMode: 'evm_registry_canonical',
          onStep: (step, state) => steps.push(`${step}:${state}`),
        }),
      };
    };

    const skipped = run('');
    await skipped.done;
    expect(skipped.steps.at(-1)).toBe('worker:skipped');
    expect(mockPostWorker).not.toHaveBeenCalled();

    mockUpload.mockRejectedValue(new Error('Arweave upload failed.'));
    const failed = run(WORKER);
    await expect(failed.done).rejects.toThrow('Arweave upload failed.');
    expect(failed.steps).toEqual(['wallet:running', 'wallet:done', 'upload:running', 'upload:failed']);
    expect(mockUpdateOnChain).toHaveBeenCalledTimes(1);
  });
});
