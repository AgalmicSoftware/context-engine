/** @file AdminPage.render.test.jsx */
import React, { act } from 'react';
import { ethers } from 'ethers';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './AdminPage.module.scss';

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_REGISTRY_CACHE_UPDATED_EVENT = 'ce:session-registry-cache-updated';

const buildSessionConfig = (overrides = {}) => ({
  slug: 'edge',
  sessionName: 'Edge Session',
  corsWorkerUrl: 'https://worker.example.test',
  networkChainId: 84532,
  __registry: {
    registryChainId: 84532,
    chainId: 84532,
    adminAddress: ADMIN_ADDRESS,
    ...(overrides.__registry || {}),
  },
  ...overrides,
});

const mockResolveCorsProxyUrl = jest.fn();
const mockLoadSessionRegistryCache = jest.fn();
const mockGetAllSessionEntries = jest.fn();
const mockBuildSignedAdminActionAuth = jest.fn();
const mockSetSessionFieldsOnChain = jest.fn();
const mockUploadSessionMetadata = jest.fn();
const mockUpdateSessionMetadataOnChain = jest.fn();
const mockUpsertSessionRegistryCache = jest.fn();

jest.mock('../../utilities/worker/corsProxy.js', () => ({
  corsProxyUtils: {
    resolveCorsProxyUrl: (...args) => mockResolveCorsProxyUrl(...args),
  },
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  buildSiweMessage: jest.fn(() => 'siwe-message'),
  buildSignedAdminActionAuth: (...args) => mockBuildSignedAdminActionAuth(...args),
  fetchWorkerWithAuth: jest.fn(),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => ({})),
  },
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: jest.fn(),
    readArweaveWalletBalance: jest.fn(),
    formatWinstonToAr: jest.fn(),
  },
}));

jest.mock('../../utilities/crypto/encryptedFields.js', () => ({
  encryptedFieldsUtils: {
    resolveEncryptedValue: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  loadSessionRegistryCache: (...args) => mockLoadSessionRegistryCache(...args),
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  sessionRegistryStore: {
    getAllSessionEntries: (...args) => mockGetAllSessionEntries(...args),
  },
  setSessionFieldsOnChain: (...args) => mockSetSessionFieldsOnChain(...args),
  setResourceGatesOnChain: jest.fn(),
  fetchSessionFromRegistry: jest.fn(),
  upsertSessionRegistryCache: (...args) => mockUpsertSessionRegistryCache(...args),
  uploadSessionMetadata: (...args) => mockUploadSessionMetadata(...args),
  updateSessionMetadataOnChain: (...args) => mockUpdateSessionMetadataOnChain(...args),
  sessionRegistryUtils: {
    normalizeSessionIdHex: jest.fn(() => ''),
  },
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: jest.fn(() => []),
  getGlobalLitHooks: jest.fn(() => null),
  resolveLitChain: jest.fn(() => 'baseSepolia'),
  resolveLitNetwork: jest.fn(() => 'datil-dev'),
}));

jest.mock('../Shared/AudioInput/AudioInput', () => () => <div data-testid="mock-admin-audio-input" />);
jest.mock('../SBTs/SBTSelector', () => () => <div data-testid="mock-admin-sbt-selector" />);

const AdminPage = require('./AdminPage').default;

const renderAdminPage = async ({
  account = ADMIN_ADDRESS,
  initialSessionId,
  initialRegistryChainId,
} = {}) => {
  let utils;
  await act(async () => {
    utils = render(
      <AdminPage
        account={account}
        network={{ id: 84532 }}
        loginComplete={true}
        toggleLoginModal={jest.fn()}
        initialSessionId={initialSessionId}
        initialRegistryChainId={initialRegistryChainId}
      />
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return utils;
};

const getGatePanel = () => screen.getByText('On-chain default gate').closest('section');

const getFieldInputByLabel = (labelText) => (
  screen.getByText(labelText).parentElement.querySelector('input,textarea,select')
);
const clickAndSettle = async (element) => {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
};
const waitForResolvedWorkerUrl = () => screen.findByDisplayValue('https://worker.example.test');
const openGatePanel = async () => {
  const panel = getGatePanel();
  await clickAndSettle(within(panel).getByRole('button', { name: 'Toggle On-chain default gate section' }));
  return panel;
};

describe('AdminPage rendered interactions', () => {
  const originalFetch = global.fetch;
  let web3ProviderSpy;
  let sessionEntries;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : { ok: true, json: async () => ({ ok: true }) }
    ));
    sessionEntries = [['edge', buildSessionConfig()]];
    mockLoadSessionRegistryCache.mockResolvedValue(undefined);
    mockGetAllSessionEntries.mockImplementation(() => sessionEntries);
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: 'https://worker.example.test',
      source: 'session-config',
      status: 'ok',
    });
    mockUploadSessionMetadata.mockResolvedValue({
      txId: 'metadata_tx_id',
      metadataUri: 'ar://metadata_tx_id',
    });
    mockUpdateSessionMetadataOnChain.mockResolvedValue({
      ok: true,
      txHash: '0xmetadatahash',
    });
    mockBuildSignedAdminActionAuth.mockImplementation(async ({ action, slug }) => ({
      address: ADMIN_ADDRESS,
      signature: '0xtyped-admin-request',
      action,
      slug,
      bodyHash: '0xbodyhash',
      nonce: 'typed-admin-nonce',
      audience: 'http://localhost:3000',
      expiration: 1700000000,
    }));
    web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    web3ProviderSpy?.mockRestore();
  });

  it('renders the selected session controls inline and lets the admin unlock the worker URL for editing', async () => {
    await renderAdminPage();

    const sessionSelect = await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT);
    expect(sessionSelect).toHaveValue('edge');
    expect(screen.queryByText(/^Sessions$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Connect a wallet to continue.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle Sessions section' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh sessions' })).toBeInTheDocument();

    const sessionLink = screen.getByRole('link', { name: 'Open session' });
    expect(sessionLink).toHaveAttribute('href', expect.stringContaining('/session/edge'));
    expect(sessionLink).toHaveAttribute('target', '_blank');

    const workerInput = await screen.findByDisplayValue('https://worker.example.test');
    expect(workerInput).toHaveProperty('readOnly', true);
    expect(screen.queryByText('Resolved (ok)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy worker URL' })).toHaveClass(styles.heroCardInputIconButton);
    expect(screen.getByRole('button', { name: 'Test' })).toHaveClass(styles.subtleActionButton);

    fireEvent.click(screen.getByRole('button', { name: 'Edit worker URL' }));

    expect(workerInput).toHaveProperty('readOnly', false);
    expect(screen.getByRole('button', { name: 'Lock worker URL' })).toBeInTheDocument();

    fireEvent.change(workerInput, {
      target: { value: 'https://edited.example.test' },
    });

    expect(screen.getByDisplayValue('https://edited.example.test')).toBeInTheDocument();
    expect(mockResolveCorsProxyUrl).toHaveBeenCalledWith(expect.objectContaining({
      sessionSlug: 'edge',
      sessionConfig: expect.objectContaining({ slug: 'edge' }),
    }));
  });

  it('reveals the tests section only after the worker Test button is clicked', async () => {
    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    expect(screen.queryByText(/^Tests$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle Tests section' })).not.toBeInTheDocument();

    await clickAndSettle(screen.getByRole('button', { name: 'Test' }));

    const testsPanel = await screen.findByText('Tests');
    expect(testsPanel).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Tests section' }));
    expect(screen.queryByText(/^Tests$/)).not.toBeInTheDocument();
  });

  it('does not reserve hero media space when the session header image fails to load', async () => {
    const OriginalImage = global.Image;
    class BrokenImageMock {
      set src(_value) {
        setTimeout(() => {
          if (typeof this.onerror === 'function') this.onerror(new Error('load failed'));
        }, 0);
      }
    }
    global.Image = BrokenImageMock;
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        sessionHeaderImg: 'https://broken.example.test/session-header.png',
      }),
    ]];

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      await waitFor(() => {
        const hero = screen.getByRole('heading', { name: 'Session Admin' }).closest('header');
        expect(hero).toHaveClass(styles.heroNoMedia);
      });
      expect(screen.queryByAltText('edge header')).not.toBeInTheDocument();
    } finally {
      global.Image = OriginalImage;
    }
  });

  it('warns non-admin wallets and disables admin-only actions', async () => {
    await renderAdminPage({
      account: '0x00000000000000000000000000000000000000bb',
    });

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_NOT_ADMIN_WARNING)).toHaveTextContent(
      'You are not the admin for this session; actions are disabled.'
    );
    expect(screen.queryByRole('button', { name: 'Save allowlist' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add recommended origins' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit worker URL' })).not.toBeInTheDocument();
    await openGatePanel();
    expect(screen.getByTestId(E2E_TESTIDS.ADMIN_GATE_UPDATE_BUTTON)).toBeDisabled();
  });

  it('retries registry loading with the default RPC path when the requested chain is still empty after bootstrap load', async () => {
    sessionEntries = [[
      'other-chain-session',
      buildSessionConfig({
        slug: 'other-chain-session',
        __registry: {
          registryChainId: 8453,
          chainId: 8453,
          adminAddress: ADMIN_ADDRESS,
        },
      }),
    ]];

    await renderAdminPage({
      initialRegistryChainId: '84532',
    });

    await waitFor(() => {
      expect(mockLoadSessionRegistryCache).toHaveBeenCalledTimes(2);
    });

    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(1, expect.objectContaining({
      chainIds: [84532],
      bootstrapRpc: true,
    }));
    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(2, expect.objectContaining({
      chainIds: [84532],
      bootstrapRpc: false,
    }));
  });

  it('defaults metadata start block to the selected session chain and updates metadata in place', async () => {
    const currentBlockSpy = jest
      .spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlockNumber')
      .mockResolvedValue(12345678);
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        networkChainId: 8453,
        blockLimits: {},
        __registry: {
          registryChainId: 84532,
          chainId: 84532,
          adminAddress: ADMIN_ADDRESS,
          metadataURI: 'ar://old-metadata',
        },
      }),
    ]];

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      const metadataPanel = screen.getByText('Session metadata').closest('section');
      fireEvent.click(within(metadataPanel).getAllByRole('button')[0]);

      await waitFor(() => {
        expect(screen.getByText('Current block on Base (8453): 12,345,678')).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('12345678')).toBeInTheDocument();

      await clickAndSettle(screen.getByRole('button', { name: 'Update metadata' }));

      await waitFor(() => {
        expect(mockUploadSessionMetadata).toHaveBeenCalledTimes(1);
      });
      expect(mockUploadSessionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        slug: 'edge',
        networkChainId: 8453,
        blockLimits: {
          start: 12345678,
          end: null,
        },
      }), expect.any(Object));
      const uploadedMetadata = mockUploadSessionMetadata.mock.calls[0][0];
      expect(uploadedMetadata.__registry).toBeUndefined();
      expect(uploadedMetadata.sponsoredKeys).toBeUndefined();

      await waitFor(() => {
        expect(mockUpdateSessionMetadataOnChain).toHaveBeenCalledWith(expect.objectContaining({
          chainId: 84532,
          slug: 'edge',
          metadataURI: 'ar://metadata_tx_id',
        }));
        expect(screen.getByText(/Session metadata updated\./)).toBeInTheDocument();
      });
    } finally {
      currentBlockSpy.mockRestore();
    }
  });

  it('updates the metadata auto-feature flag from admin', async () => {
    const currentBlockSpy = jest
      .spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlockNumber')
      .mockResolvedValue(12345678);
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        autoFeatureSBTsWithFeaturedSbtTags: false,
        blockLimits: {},
        __registry: {
          registryChainId: 84532,
          chainId: 84532,
          adminAddress: ADMIN_ADDRESS,
          metadataURI: 'ar://old-metadata',
        },
      }),
    ]];

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      const metadataPanel = screen.getByText('Session metadata').closest('section');
      fireEvent.click(within(metadataPanel).getAllByRole('button')[0]);

      const autoFeatureToggle = await screen.findByLabelText('Auto-feature by session slug');
      expect(autoFeatureToggle).not.toBeChecked();

      fireEvent.click(autoFeatureToggle);
      expect(autoFeatureToggle).toBeChecked();

      await clickAndSettle(screen.getByRole('button', { name: 'Update metadata' }));

      await waitFor(() => {
        expect(mockUploadSessionMetadata).toHaveBeenCalledTimes(1);
      });
      expect(mockUploadSessionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        autoFeatureSBTsBySessionSlug: true,
      }), expect.any(Object));
      expect(mockUploadSessionMetadata.mock.calls[0][0]).not.toHaveProperty('autoFeatureSBTsWithFeaturedSbtTags');
    } finally {
      currentBlockSpy.mockRestore();
    }
  });

  it('prefers canonical metadata auto-feature flag over the legacy alias in admin', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        autoFeatureSBTsBySessionSlug: false,
        autoFeatureSBTsWithFeaturedSbtTags: true,
      }),
    ]];

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const metadataPanel = screen.getByText('Session metadata').closest('section');
    fireEvent.click(within(metadataPanel).getAllByRole('button')[0]);

    const autoFeatureToggle = await screen.findByLabelText('Auto-feature by session slug');
    expect(autoFeatureToggle).not.toBeChecked();
  });

  it('rehydrates metadata draft when switching sessions even if previous session had unsaved edits', async () => {
    const session1 = buildSessionConfig({
      slug: 'session-one',
      sessionName: 'Session One',
      blockLimits: { start: 100 },
      defaultTags: 'tags-for-one',
      __registry: {
        registryChainId: 84532,
        chainId: 84532,
        adminAddress: ADMIN_ADDRESS,
        metadataURI: 'ar://meta-one',
      },
    });
    const session2 = buildSessionConfig({
      slug: 'session-two',
      sessionName: 'Session Two',
      blockLimits: { start: 200 },
      defaultTags: 'tags-for-two',
      __registry: {
        registryChainId: 84532,
        chainId: 84532,
        adminAddress: ADMIN_ADDRESS,
        metadataURI: 'ar://meta-two',
      },
    });
    sessionEntries = [['session-one', session1], ['session-two', session2]];

    await renderAdminPage();

    const sessionSelect = await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT);
    expect(sessionSelect).toHaveValue('session-one');

    const metadataPanel = screen.getByText('Session metadata').closest('section');
    fireEvent.click(within(metadataPanel).getByRole('button', { name: 'Toggle Session metadata section' }));

    const tagsInput = getFieldInputByLabel('Default tags');
    fireEvent.change(tagsInput, { target: { value: 'modified-tags' } });
    expect(tagsInput).toHaveValue('modified-tags');

    fireEvent.change(sessionSelect, { target: { value: 'session-two' } });
    expect(sessionSelect).toHaveValue('session-two');

    await waitFor(() => {
      expect(getFieldInputByLabel('Default tags')).toHaveValue('tags-for-two');
    });
  });

  it('renders clickable metadata links and a raw metadata copy control', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        __registry: {
          registryChainId: 84532,
          chainId: 84532,
          adminAddress: ADMIN_ADDRESS,
          metadataURI: 'ar://old-metadata',
        },
      }),
    ]];

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const metadataPanel = screen.getByText('Session metadata').closest('section');
    fireEvent.click(within(metadataPanel).getAllByRole('button')[0]);

    expect(within(metadataPanel).getByRole('link', { name: 'edge' })).toHaveAttribute('href', expect.stringContaining('/session/edge'));
    expect(metadataPanel.querySelector(`a[href="/u/${encodeURIComponent(ADMIN_ADDRESS)}"]`)).not.toBeNull();
    expect(metadataPanel.querySelector('a[href*="old-metadata"]')).not.toBeNull();
    expect(within(metadataPanel).getByRole('button', { name: 'Copy raw metadata JSON' })).toBeInTheDocument();
  });

  it('saves advanced metadata fields from the updated metadata payload', async () => {
    const currentBlockSpy = jest
      .spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlockNumber')
      .mockResolvedValue(12345678);
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        blockLimits: { start: 100, end: null },
        faucet: {
          amountEth: '0.0001',
          balanceThresholdEth: '0.0009',
        },
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-4o' },
            thinking: { provider: 'openai', model: 'gpt-4o' },
            transcription: { provider: 'openai', model: 'whisper-1' },
          },
        },
        contracts: {
          surveys: {
            address: '0x00000000000000000000000000000000000000f1',
            chainId: 84532,
          },
        },
        __registry: {
          registryChainId: 84532,
          chainId: 84532,
          adminAddress: ADMIN_ADDRESS,
          metadataURI: 'ar://old-metadata',
        },
      }),
    ]];

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      const metadataPanel = screen.getByText('Session metadata').closest('section');
      fireEvent.click(within(metadataPanel).getAllByRole('button')[0]);

      fireEvent.change(getFieldInputByLabel('Default tags'), {
        target: { value: 'governance, research' },
      });
      fireEvent.change(getFieldInputByLabel('Question generation prompt'), {
        target: { value: 'Ask better governance questions' },
      });
      fireEvent.change(getFieldInputByLabel('Default filter state'), {
        target: { value: '{"sort":"recent"}' },
      });
      fireEvent.change(getFieldInputByLabel('Faucet amount (ETH)'), {
        target: { value: '0.0002' },
      });
      fireEvent.change(getFieldInputByLabel('Faucet threshold (ETH)'), {
        target: { value: '0.001' },
      });
      fireEvent.change(getFieldInputByLabel('Thinking provider'), {
        target: { value: 'anthropic' },
      });
      fireEvent.change(getFieldInputByLabel('Thinking model'), {
        target: { value: 'claude-3-7-sonnet' },
      });
      fireEvent.change(getFieldInputByLabel('Highlighted question IDs'), {
        target: { value: 'q1\nq2' },
      });

      await clickAndSettle(screen.getByRole('button', { name: 'Update metadata' }));

      await waitFor(() => {
        expect(mockUploadSessionMetadata).toHaveBeenCalledTimes(1);
      });
      expect(mockUploadSessionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        defaultTags: 'governance, research',
        questionsGenPrompt: 'Ask better governance questions',
        defaultFilterState: { sort: 'recent' },
        HIGHLIGHTED_QUESTION_IDS: ['q1', 'q2'],
        faucet: expect.objectContaining({
          amountEth: '0.0002',
          balanceThresholdEth: '0.001',
        }),
        ai: expect.objectContaining({
          models: expect.objectContaining({
            thinking: expect.objectContaining({
              provider: 'anthropic',
              model: 'claude-3-7-sonnet',
            }),
          }),
        }),
      }), expect.any(Object));

      await waitFor(() => {
        expect(screen.getByText(/Session metadata updated\./)).toBeInTheDocument();
      });
    } finally {
      currentBlockSpy.mockRestore();
    }
  });

  it('requires explicit verification before saving synthesized fallback contract defaults', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        blockLimits: { start: 100, end: null },
        contracts: {
          surveys: {
            address: '0x00000000000000000000000000000000000000f1',
            chainId: 84532,
          },
          sbtFactory: {
            address: '0x00000000000000000000000000000000000000f2',
            chainId: 84532,
          },
          sessionRegistry: {
            address: '0x00000000000000000000000000000000000000f3',
            chainId: 84532,
          },
        },
        __registry: {
          registryChainId: 84532,
          chainId: 84532,
          adminAddress: ADMIN_ADDRESS,
          metadataURI: 'ar://missing-metadata',
          metadataLoadState: 'unavailable',
          metadataDefaultedContractKeys: ['surveys', 'sbtFactory', 'sessionRegistry'],
        },
      }),
    ]];

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const metadataPanel = screen.getByText('Session metadata').closest('section');
    fireEvent.click(within(metadataPanel).getAllByRole('button')[0]);

    expect(within(metadataPanel).getByText(/Session metadata could not be loaded/i)).toBeInTheDocument();

    await clickAndSettle(screen.getByRole('button', { name: 'Update metadata' }));

    await waitFor(() => {
      expect(screen.getByText(/Verify or edit the contract addresses before saving/i)).toBeInTheDocument();
    });
    expect(mockUploadSessionMetadata).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/I verified these fallback defaults/i));
    await clickAndSettle(screen.getByRole('button', { name: 'Update metadata' }));

    await waitFor(() => {
      expect(mockUploadSessionMetadata).toHaveBeenCalledTimes(1);
    });
  });

  it('retries the registry load with the default RPC path when bootstrap hydration stays empty', async () => {
    sessionEntries = [];
    mockLoadSessionRegistryCache.mockImplementation(async ({ bootstrapRpc } = {}) => {
      if (bootstrapRpc === false) {
        sessionEntries = [['edge', buildSessionConfig()]];
      }
      return {
        __loadMeta: {
          hadLoadErrors: bootstrapRpc !== false,
        },
      };
    });

    await renderAdminPage();

    const sessionSelect = await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT);
    expect(sessionSelect).toHaveValue('edge');
    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(1, expect.objectContaining({
      bootstrapRpc: true,
    }));
    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(2, expect.objectContaining({
      bootstrapRpc: false,
    }));
  });

  it('retries the registry load with the default RPC path when bootstrap hydration leaves stale cached sessions', async () => {
    sessionEntries = [['edge', buildSessionConfig({ sessionName: 'Stale Session' })]];
    mockLoadSessionRegistryCache.mockImplementation(async ({ bootstrapRpc } = {}) => {
      if (bootstrapRpc === false) {
        sessionEntries = [['edge', buildSessionConfig({ sessionName: 'Fresh Session' })]];
      }
      return {
        __loadMeta: {
          hadLoadErrors: bootstrapRpc !== false,
        },
      };
    });

    await renderAdminPage();

    const sessionSelect = await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT);
    await waitFor(() => {
      expect(sessionSelect).toHaveValue('edge');
      expect(within(sessionSelect).getByRole('option', { name: 'edge — Fresh Session' })).toBeInTheDocument();
      expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(1, expect.objectContaining({
        bootstrapRpc: true,
      }));
      expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(2, expect.objectContaining({
        bootstrapRpc: false,
      }));
    });
  });

  it('syncs the session picker when another route updates the registry cache', async () => {
    sessionEntries = [];

    await renderAdminPage();

    expect(await screen.findByText('No sessions found in the registry.')).toBeInTheDocument();

    sessionEntries = [['edge', buildSessionConfig()]];
    act(() => {
      window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT));
    });

    const sessionSelect = await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT);
    expect(sessionSelect).toHaveValue('edge');
  });

});
