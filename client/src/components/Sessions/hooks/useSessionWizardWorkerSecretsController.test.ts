import { act, renderHook } from '@testing-library/react';
import {
  arweavePublishAdapter,
  workerAuthPublishAdapter,
} from '../../../domains/sessions/publish/sessionPublishAdapters.js';
import { setGlobalLitHooks } from '../../../utilities/crypto/litProtocol.js';
import { SPONSORED_FIELD_KEYS } from '../../../utilities/session/sponsoredFlags.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import type { WorkerSecretsLike } from '../../shellTypes';
import useSessionWizardWorkerSecretsController from './useSessionWizardWorkerSecretsController';

jest.mock('../../../domains/sessions/publish/sessionPublishAdapters.js', () => ({
  __esModule: true,
  arweavePublishAdapter: {
    resolveUploadOptions: jest.fn(async (input) => ({
      ...input,
      resolved: true,
    })),
  },
  workerAuthPublishAdapter: {
    normalizeWorkerUrl: jest.fn((value) =>
      String(value || '')
        .trim()
        .replace(/\/+$/, ''),
    ),
    buildSignedBootstrapAdminAuth: jest.fn(async (input) => ({
      kind: 'bootstrap',
      ...input,
    })),
    buildSignedAdminActionAuth: jest.fn(async (input) => ({
      kind: 'typed',
      ...input,
    })),
  },
}));

jest.mock('../../../utilities/crypto/litProtocol.js', () => {
  const state = { current: null as unknown };
  return {
    __esModule: true,
    createLitHooks: jest.fn((input) => ({ input })),
    getGlobalLitHooks: jest.fn(() => state.current),
    resolveLitChain: jest.fn(() => 'ethereum'),
    setGlobalLitHooks: jest.fn((next) => {
      state.current = next;
    }),
  };
});

const baseWorkerSecrets = (overrides: Partial<WorkerSecretsLike> = {}): WorkerSecretsLike => ({
  openaiKey: '',
  anthropicKey: '',
  openrouterKey: '',
  customRpcUrl: '',
  customRpcKey: '',
  arweaveJwk: '',
  faucetPrivateKey: '',
  litApiBase: '',
  litGroupId: '',
  litPkpId: '',
  litActionCid: '',
  litAccountApiKey: '',
  litUsageApiKey: '',
  ...overrides,
});

const baseDraft = (overrides: Record<string, unknown> = {}) => ({
  slug: 'demo',
  corsWorkerUrl: 'https://worker.example.test/',
  networkChainId: 11155420,
  ai: {
    providers: {
      openai: {
        apiKey: 'draft-openai',
        encryptedApiKey: 'draft-openai-encrypted',
      },
      anthropic: {
        apiKey: 'draft-anthropic',
        encryptedApiKey: 'draft-anthropic-encrypted',
      },
    },
  },
  rpc: {
    providers: {
      path: {
        apiKey: 'rpc-key',
        encryptedApiKey: 'rpc-key-encrypted',
        rpcUrl: 'https://rpc.example.test',
      },
    },
  },
  arweave: {
    jwk: 'draft-jwk',
    encryptedJwk: 'draft-jwk-encrypted',
  },
  faucet: {
    privateKey: 'faucet-private-key',
    encryptedPrivateKey: 'faucet-private-key-encrypted',
  },
  ...overrides,
});

const createControllerHarness = (overrides: Record<string, unknown> = {}) => {
  const {
    draft: draftOverride,
    draftFactory: draftFactoryOverride,
    workerSecrets: workerSecretsOverride,
    applyWorkerSecretsUpdate: applyWorkerSecretsUpdateOverride,
    updateDraftValue: updateDraftValueOverride,
    ...optionOverrides
  } = overrides;
  const workerSecrets = (workerSecretsOverride as WorkerSecretsLike | undefined) || baseWorkerSecrets();
  const applyWorkerSecretsUpdate = jest.fn();
  const updateDraftValue = jest.fn();
  const hook = renderHook(() =>
    useSessionWizardWorkerSecretsController({
      account: '0x00000000000000000000000000000000000000aa',
      provider: 'injected-provider',
      network: { id: 11155420 },
      draft:
        typeof draftFactoryOverride === 'function'
          ? draftFactoryOverride()
          : baseDraft((draftOverride as Record<string, unknown> | undefined) || {}),
      wizardMode: 'advanced',
      deployComplete: false,
      deployWorkerUrl: '',
      workerMode: 'custom',
      workerSecrets,
      workerSecretsEnabled: true,
      workerAllowOrigins: 'https://app.example.test, https://admin.example.test',
      provisionedSponsoredContext: null,
      effectivePersistWorkerSecrets: false,
      registryChainId: 11155420,
      allowNormalModeSharedHostedWorker: true,
      getCurrentWorkerSecrets: jest.fn(() => workerSecrets),
      getCurrentEnabledWorkerSecrets: jest.fn(() => workerSecrets),
      applyWorkerSecretsUpdate:
        (applyWorkerSecretsUpdateOverride as typeof applyWorkerSecretsUpdate | undefined) || applyWorkerSecretsUpdate,
      updateDraftValue: (updateDraftValueOverride as typeof updateDraftValue | undefined) || updateDraftValue,
      resolvedWalletAccountRef: {
        current: '0x00000000000000000000000000000000000000bb',
      },
      resolveChipotleHookConfig: jest.fn(() => null),
      ...optionOverrides,
    }),
  );

  return {
    ...hook,
    applyWorkerSecretsUpdate,
    updateDraftValue,
  };
};

describe('useSessionWizardWorkerSecretsController', () => {
  const mockedArweaveAdapter = arweavePublishAdapter as jest.Mocked<typeof arweavePublishAdapter>;
  const mockedWorkerAuthAdapter = workerAuthPublishAdapter as jest.Mocked<typeof workerAuthPublishAdapter>;
  const mockedSetGlobalLitHooks = setGlobalLitHooks as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports missing deploy secrets without owning deploy execution', () => {
    const { result } = createControllerHarness({
      network: { id: 0 },
      registryChainId: 0,
      draft: {
        networkChainId: 0,
        rpc: {
          providers: {},
        },
      },
      workerSecrets: baseWorkerSecrets({
        litApiBase: 'https://lit.example.test',
        litActionCid: 'lit-action-cid',
      }),
    });

    expect(result.current.getMissingWorkerSecretsForDeploy()).toEqual([
      'OpenAI key',
      'Arweave JWK',
      'Worker RPC URL',
      'Lit group ID',
      'Lit PKP ID',
    ]);
  });

  it('requires only the AI key for the default Cloudflare profile', () => {
    const { result } = createControllerHarness({
      network: { id: 0 },
      registryChainId: 0,
      draft: baseDraft({
        networkChainId: 0,
        rpc: { providers: {} },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      workerSecrets: baseWorkerSecrets(),
    });

    expect(result.current.getMissingWorkerSecretsForDeploy()).toEqual(['OpenAI key']);
  });

  it.each(['anthropicKey', 'openrouterKey'])(
    'does not accept unselected %s for the default Cloudflare AI models',
    (key) => {
      const { result } = createControllerHarness({
        network: { id: 0 },
        registryChainId: 0,
        draft: baseDraft({
          networkChainId: 0,
          rpc: { providers: {} },
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        }),
        workerSecrets: baseWorkerSecrets({ [key]: 'provider-secret' }),
      });

      expect(result.current.getMissingWorkerSecretsForDeploy()).toEqual(['OpenAI key']);
    },
  );

  it.each([
    ['anthropic', 'anthropicKey'],
    ['openrouter', 'openrouterKey'],
  ])('accepts the selected %s provider key for worker-canonical AI models', (provider, key) => {
    const { result } = createControllerHarness({
      network: { id: 0 },
      registryChainId: 0,
      draft: baseDraft({
        networkChainId: 0,
        rpc: { providers: {} },
        ai: {
          models: {
            fast: { provider },
            thinking: { provider },
          },
        },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      workerSecrets: baseWorkerSecrets({ [key]: 'provider-secret', openaiKey: 'transcription-secret' }),
    });

    expect(result.current.getMissingWorkerSecretsForDeploy()).toEqual([]);
  });

  it('requires every provider selected by mixed worker-canonical AI models', () => {
    const { result } = createControllerHarness({
      network: { id: 0 },
      registryChainId: 0,
      draft: baseDraft({
        networkChainId: 0,
        rpc: { providers: {} },
        ai: {
          models: {
            fast: { provider: 'openai' },
            thinking: { provider: 'anthropic' },
          },
        },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      workerSecrets: baseWorkerSecrets({ anthropicKey: 'provider-secret' }),
    });

    expect(result.current.getMissingWorkerSecretsForDeploy()).toEqual(['OpenAI key']);
  });

  it('refreshes provider-aware readiness when the selected AI providers change', () => {
    let draft = baseDraft({
      networkChainId: 0,
      rpc: { providers: {} },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    });
    const { result, rerender } = createControllerHarness({
      network: { id: 0 },
      registryChainId: 0,
      draftFactory: () => draft,
      workerSecrets: baseWorkerSecrets({ openaiKey: 'provider-secret' }),
    });

    expect(result.current.getMissingWorkerSecretsForDeploy()).toEqual([]);

    draft = baseDraft({
      networkChainId: 0,
      rpc: { providers: {} },
      ai: {
        models: {
          fast: { provider: 'anthropic' },
          thinking: { provider: 'anthropic' },
        },
      },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    });
    rerender();

    expect(result.current.getMissingWorkerSecretsForDeploy()).toEqual(['Anthropic key']);
  });

  it('preserves sponsored fallback fields only for the current slug and worker URL', () => {
    const { result } = createControllerHarness({
      workerSecrets: baseWorkerSecrets(),
      provisionedSponsoredContext: {
        sessionSlug: 'demo',
        workerUrl: 'https://worker.example.test',
        fields: {
          [SPONSORED_FIELD_KEYS.ai]: '1',
          [SPONSORED_FIELD_KEYS.lit]: '1',
        },
      },
    });

    expect(result.current.buildSponsoredFlagFields()).toEqual(
      expect.objectContaining({
        [SPONSORED_FIELD_KEYS.ai]: '1',
        [SPONSORED_FIELD_KEYS.lit]: '1',
      }),
    );

    const mismatched = renderHook(() =>
      useSessionWizardWorkerSecretsController({
        account: '0x00000000000000000000000000000000000000aa',
        provider: 'injected-provider',
        network: { id: 11155420 },
        draft: baseDraft(),
        wizardMode: 'advanced',
        deployComplete: false,
        deployWorkerUrl: '',
        workerMode: 'custom',
        workerSecrets: baseWorkerSecrets(),
        workerSecretsEnabled: true,
        workerAllowOrigins: '',
        provisionedSponsoredContext: {
          sessionSlug: 'other-session',
          workerUrl: 'https://worker.example.test',
          fields: {
            [SPONSORED_FIELD_KEYS.ai]: '1',
            [SPONSORED_FIELD_KEYS.lit]: '1',
          },
        },
        effectivePersistWorkerSecrets: false,
        registryChainId: 11155420,
        allowNormalModeSharedHostedWorker: true,
        getCurrentWorkerSecrets: jest.fn(() => baseWorkerSecrets()),
        getCurrentEnabledWorkerSecrets: jest.fn(() => baseWorkerSecrets()),
        applyWorkerSecretsUpdate: jest.fn(),
        updateDraftValue: jest.fn(),
        resolvedWalletAccountRef: { current: '' },
        resolveChipotleHookConfig: jest.fn(() => null),
      }),
    );

    expect(mismatched.result.current.buildSponsoredFlagFields()).toEqual(
      expect.objectContaining({
        [SPONSORED_FIELD_KEYS.ai]: '0',
        [SPONSORED_FIELD_KEYS.lit]: '0',
      }),
    );
  });

  it('clears persisted draft secret fields for worker resources', () => {
    const { result, updateDraftValue } = createControllerHarness();

    act(() => {
      result.current.clearWorkerSecretFields();
    });

    expect(updateDraftValue).toHaveBeenCalledWith(['ai', 'providers', 'openai', 'apiKey'], '');
    expect(updateDraftValue).toHaveBeenCalledWith(['ai', 'providers', 'openai', 'encryptedApiKey'], '');
    expect(updateDraftValue).toHaveBeenCalledWith(['rpc', 'providers', 'path', 'apiKey'], '');
    expect(updateDraftValue).toHaveBeenCalledWith(['rpc', 'providers', 'path', 'encryptedApiKey'], '');
    expect(updateDraftValue).toHaveBeenCalledWith(['arweave', 'jwk'], '');
    expect(updateDraftValue).toHaveBeenCalledWith(['arweave', 'encryptedJwk'], '');
    expect(updateDraftValue).toHaveBeenCalledWith(['faucet', 'privateKey'], '');
    expect(updateDraftValue).toHaveBeenCalledWith(['faucet', 'encryptedPrivateKey'], '');
  });

  it('clears cached Arweave JWKs only when local secret persistence is disabled', () => {
    const { result, applyWorkerSecretsUpdate } = createControllerHarness();

    act(() => {
      result.current.clearCachedArweaveJwkAfterUpload();
    });

    expect(applyWorkerSecretsUpdate).toHaveBeenCalledTimes(1);
    expect(applyWorkerSecretsUpdate.mock.calls[0][0]({ arweaveJwk: 'cached-jwk', openaiKey: 'cached-openai' })).toEqual(
      {
        arweaveJwk: '',
        openaiKey: 'cached-openai',
      },
    );

    const persisted = createControllerHarness({
      effectivePersistWorkerSecrets: true,
    });
    act(() => {
      persisted.result.current.clearCachedArweaveJwkAfterUpload();
    });

    expect(persisted.applyWorkerSecretsUpdate).not.toHaveBeenCalled();
  });

  it('signs admin actions with normalized worker URL, slug, and account context', async () => {
    const { result } = createControllerHarness({
      draft: baseDraft({
        slug: ' fallback-slug ',
        networkChainId: 11155420,
      }),
    });

    await act(async () => {
      await result.current.signBootstrapAdminAction({
        statement: ' bootstrap ',
        targetSlug: ' target-slug ',
        workerUrl: ' https://worker.example.test/admin/ ',
      });
      await result.current.signTypedAdminAction({
        action: ' rotate-secret ',
        body: { ok: true },
        targetSlug: ' target-slug ',
        workerUrl: ' https://worker.example.test/admin/ ',
      });
    });

    expect(mockedWorkerAuthAdapter.buildSignedBootstrapAdminAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'target-slug',
        workerUrl: 'https://worker.example.test/admin',
        statement: 'bootstrap',
        context: expect.objectContaining({
          account: '0x00000000000000000000000000000000000000bb',
          chainId: 11155420,
          providerLike: 'injected-provider',
        }),
      }),
    );
    expect(mockedWorkerAuthAdapter.buildSignedAdminActionAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rotate-secret',
        slug: 'target-slug',
        body: { ok: true },
        workerUrl: 'https://worker.example.test/admin',
      }),
    );
  });

  it('delegates Arweave upload option auth through bootstrap signing', async () => {
    const { result } = createControllerHarness();

    await act(async () => {
      await result.current.buildSessionWizardPublishArweaveUploadOptions({
        arweaveJwk: '',
        workerUrl: 'https://worker.example.test',
        sessionSlug: 'demo',
        authAccount: '0x00000000000000000000000000000000000000cc',
      });
    });

    expect(mockedArweaveAdapter.resolveUploadOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        workerUrl: 'https://worker.example.test',
        preferDirectArweaveUpload: false,
        requireAdminAuthWithoutJwk: true,
        buildAdminAuth: expect.any(Function),
      }),
    );
  });

  it('installs and restores Chipotle Lit hooks through the existing global hook port', () => {
    const { unmount } = createControllerHarness({
      workerSecrets: baseWorkerSecrets({
        litApiBase: 'https://lit.example.test',
        litGroupId: 'lit-group',
        litPkpId: 'lit-pkp',
      }),
      resolveChipotleHookConfig: jest.fn(() => ({
        apiBase: 'https://lit.example.test',
        groupId: 'lit-group',
        pkpId: 'lit-pkp',
      })),
    });

    expect(mockedSetGlobalLitHooks).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          litNetwork: 'chipotle',
        }),
      }),
    );

    unmount();
    expect(mockedSetGlobalLitHooks).toHaveBeenLastCalledWith(null);
  });
});
