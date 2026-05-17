/** @file AdminPage.render.test.jsx */
import React, { act } from 'react';
import { ethers } from 'ethers';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getCachedSessionWorkerConfig } from '../../utilities/session/sessionWorkerConfigCache.js';
import { CLOUDFLARE_CORS_WORKER_URL } from '../../variables/appConfig.js';
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
const mockReadArweaveWalletBalance = jest.fn();
const mockFormatWinstonToAr = jest.fn();

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
    readArweaveWalletBalance: (...args) => mockReadArweaveWalletBalance(...args),
    formatWinstonToAr: (...args) => mockFormatWinstonToAr(...args),
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
const Arweave = require('arweave');

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

const getWorkerSecretsPanel = () => screen.getByText('Worker secrets').closest('section');
const getGatePanel = () => screen.getByText('On-chain default gate').closest('section');

const getSecretInputByLabel = (labelText) => (
  screen.getByText(labelText).parentElement.querySelector('input,textarea')
);
const getFieldInputByLabel = (labelText) => (
  screen.getByText(labelText).parentElement.querySelector('input,textarea,select')
);
const getAllowOriginsInput = () => screen.getByLabelText('CORS allowlist');
const clickAndSettle = async (element) => {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
};
const openAllowlistEditor = async () => {
  await clickAndSettle(screen.getByRole('button', { name: 'Allowlist' }));
  return getAllowOriginsInput();
};
const waitForResolvedWorkerUrl = () => screen.findByDisplayValue('https://worker.example.test');
const openWorkerSecretsPanel = async () => {
  const panel = getWorkerSecretsPanel();
  await clickAndSettle(within(panel).getByRole('button', { name: 'Toggle Worker secrets section' }));
  return panel;
};
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
    mockFormatWinstonToAr.mockImplementation((winston) => {
      if (String(winston) === '12345678000000') return '12.345678';
      if (String(winston) === '5') return '0.000000';
      return '0.000000';
    });
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

  it('saves worker secrets through the signed admin route and reports success', async () => {
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : { ok: true, json: async () => ({ ok: true }) }
    ));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'AI' }));

    fireEvent.change(getSecretInputByLabel('OpenAI API key'), {
      target: { value: '  sk-live-test  ' },
    });

    await clickAndSettle(await screen.findByRole('button', { name: 'Save worker secrets' }));

    await waitFor(() => {
      expect(screen.getByText(/Worker secrets saved for edge/)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('https://worker.example.test/admin/set-secrets', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(mockBuildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
      action: 'set-secrets',
      slug: 'edge',
      workerUrl: 'https://worker.example.test',
      body: {
        sessionSlug: 'edge',
        secrets: {
          openaiKey: 'sk-live-test',
        },
      },
    }));

    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
    const payload = JSON.parse(adminCall[1].body);
    expect(payload).toEqual({
      address: ADMIN_ADDRESS,
      signature: '0xtyped-admin-request',
      action: 'set-secrets',
      slug: 'edge',
      bodyHash: '0xbodyhash',
      nonce: 'typed-admin-nonce',
      audience: 'http://localhost:3000',
      expiration: 1700000000,
      sessionSlug: 'edge',
      secrets: {
        openaiKey: 'sk-live-test',
      },
    });
    expect(mockSetSessionFieldsOnChain).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 84532,
      slug: 'edge',
      fields: expect.objectContaining({
        sponsored_ai: '1',
        sponsored_transcribe: '1',
      }),
    }));
  });

  it('canonicalizes selected session slugs before signed admin worker actions', async () => {
    sessionEntries = [[
      ' TeSt!?_A ',
      buildSessionConfig({
        slug: ' TeSt!?_A ',
        sessionName: 'Slug Normalization Session',
      }),
    ]];
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : { ok: true, json: async () => ({ ok: true }) }
    ));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'AI' }));

    fireEvent.change(getSecretInputByLabel('OpenAI API key'), {
      target: { value: 'sk-live-test' },
    });

    await clickAndSettle(await screen.findByRole('button', { name: 'Save worker secrets' }));

    await waitFor(() => {
      expect(mockSetSessionFieldsOnChain).toHaveBeenCalledWith(expect.objectContaining({
        slug: 'test_a',
      }));
    });

    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
    const payload = JSON.parse(adminCall[1].body);
    expect(payload.sessionSlug).toBe('test_a');
    expect(payload.slug).toBe('test_a');
  });

  it('saves Lit account API keys and updates the sponsored_lit session flag', async () => {
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : { ok: true, json: async () => ({ ok: true }) }
    ));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Lit' }));

    fireEvent.change(getSecretInputByLabel('Lit account API key'), {
      target: { value: 'account-secret' },
    });

    await clickAndSettle(await screen.findByRole('button', { name: 'Save worker secrets' }));

    await waitFor(() => {
      expect(screen.getByText(/Worker secrets saved for edge/)).toBeInTheDocument();
    });

    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
    const payload = JSON.parse(adminCall[1].body);
    expect(payload.secrets).toEqual(expect.objectContaining({
      litAccountApiKey: 'account-secret',
    }));
    expect(mockSetSessionFieldsOnChain).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 84532,
      slug: 'edge',
      fields: expect.objectContaining({
        sponsored_lit: '1',
      }),
    }));
  });

  it('saves Lit usage API keys and updates the sponsored_lit session flag', async () => {
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : { ok: true, json: async () => ({ ok: true }) }
    ));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Lit' }));

    fireEvent.change(getSecretInputByLabel('Lit usage API key'), {
      target: { value: 'lit-secret' },
    });

    await clickAndSettle(await screen.findByRole('button', { name: 'Save worker secrets' }));

    await waitFor(() => {
      expect(screen.getByText(/Worker secrets saved for edge/)).toBeInTheDocument();
    });

    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
    const payload = JSON.parse(adminCall[1].body);
    expect(payload.secrets).toEqual(expect.objectContaining({
      litUsageApiKey: 'lit-secret',
    }));
    expect(mockSetSessionFieldsOnChain).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 84532,
      slug: 'edge',
      fields: expect.objectContaining({
        sponsored_lit: '1',
      }),
    }));
  });

  it('preserves sponsored_lit when saving unrelated worker secrets', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        sponsoredKeys: { lit: true },
      }),
    ]];

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'AI' }));

    fireEvent.change(getSecretInputByLabel('OpenAI API key'), {
      target: { value: 'sk-live-test' },
    });

    await clickAndSettle(await screen.findByRole('button', { name: 'Save worker secrets' }));

    await waitFor(() => {
      expect(screen.getByText(/Worker secrets saved for edge/)).toBeInTheDocument();
    });

    expect(mockSetSessionFieldsOnChain).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 84532,
      slug: 'edge',
      fields: expect.objectContaining({
        sponsored_ai: '1',
        sponsored_transcribe: '1',
        sponsored_lit: '1',
      }),
    }));
  });

  it('only signs Lit Chipotle status requests after the explicit refresh action', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        sponsoredKeys: { lit: true },
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litGroupId: 'group_123',
          litPkpId: 'pkp_123',
          litActionCid: 'bafy123',
        },
      }),
    ]];
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/admin/lit-chipotle-status')
        ? {
            ok: true,
            json: async () => ({
              ok: true,
              ready: true,
              apiBase: 'https://api.chipotle.litprotocol.com',
              balance: { balance_display: '$5.00 credit' },
              warnings: [],
              groupSummary: {
                walletCount: 1,
                actionCount: 1,
                hasConfiguredPkp: true,
                hasConfiguredAction: true,
              },
            }),
          }
        : { ok: true, json: async () => ({ ok: true }) }
    ));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    await waitFor(() => {
      expect(
        mockBuildSignedAdminActionAuth.mock.calls.find(
          ([args]) => args?.action === 'lit-chipotle-status'
        )
      ).toBeUndefined();
    });
    expect(global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/lit-chipotle-status'))).toBeUndefined();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Lit' }));

    expect(await screen.findByText('Lit Chipotle status')).toBeInTheDocument();

    const refreshButton = await screen.findByRole('button', { name: 'Refresh Lit status' });
    await clickAndSettle(refreshButton);

    await waitFor(() => {
      expect(mockBuildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
        action: 'lit-chipotle-status',
        slug: 'edge',
        workerUrl: 'https://worker.example.test',
      }));
      expect(global.fetch).toHaveBeenCalledWith(
        'https://worker.example.test/admin/lit-chipotle-status',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  it('passes an unsaved Lit usage API key to the Chipotle status refresh request', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        sponsoredKeys: { lit: true },
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litGroupId: 'group_123',
        },
      }),
    ]];
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/admin/lit-chipotle-status')
        ? {
            ok: true,
            json: async () => ({
              ok: true,
              ready: false,
              apiBase: 'https://api.chipotle.litprotocol.com',
              warnings: [],
              groupSummary: {
                walletCount: null,
                actionCount: null,
                hasConfiguredPkp: null,
                hasConfiguredAction: null,
              },
            }),
          }
        : { ok: true, json: async () => ({ ok: true }) }
    ));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Lit' }));

    fireEvent.change(getSecretInputByLabel('Lit usage API key'), {
      target: { value: 'lit-inline-test-key' },
    });

    const refreshButton = await screen.findByRole('button', { name: 'Refresh Lit status' });
    await clickAndSettle(refreshButton);

    await waitFor(() => {
      const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/lit-chipotle-status'));
      expect(adminCall).toBeDefined();
      const payload = JSON.parse(adminCall[1].body);
      expect(payload.litUsageApiKey).toBe('lit-inline-test-key');
      expect(payload.sessionSlug).toBe('edge');
    });
  });

  it('hydrates the allowlist editor from the cached worker config overlay', async () => {
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : { ok: true, json: async () => ({ ok: true }) }
    ));
    localStorage.setItem('ce:sessionWorkerConfigCache:v1', JSON.stringify({
      v: 2,
      bySession: {
        edge: {
          config: {
            corsWorkerUrl: 'https://worker.example.test',
            allowOrigins: ['https://existing.example.test'],
            limits: { perWalletPerDay: 3 },
            rpcEndpoint: 'https://rpc.example.test',
          },
          cachedAtMs: 1700000000000,
        },
      },
    }));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    expect(await openAllowlistEditor()).toHaveValue('https://existing.example.test');
  });

  it('saves the edited allowOrigins list exactly for the selected session', async () => {
    localStorage.setItem('ce:sessionWorkerConfigCache:v1', JSON.stringify({
      v: 2,
      bySession: {
        edge: {
          config: {
            corsWorkerUrl: 'https://worker.example.test',
            allowOrigins: ['https://existing.example.test', 'https://remove-me.example.test'],
            limits: { perWalletPerDay: 3 },
            rpcEndpoint: 'https://rpc.example.test',
          },
          cachedAtMs: 1700000000000,
        },
      },
    }));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    fireEvent.change(await openAllowlistEditor(), {
      target: { value: 'https://existing.example.test' },
    });
    await clickAndSettle(screen.getByRole('button', { name: 'Save allowlist' }));

    await waitFor(() => {
      expect(screen.getByText(/allowOrigins saved \(1 origins\)/)).toBeInTheDocument();
    });

    expect(mockBuildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
      action: 'set-config',
      slug: 'edge',
      workerUrl: 'https://worker.example.test',
      body: expect.objectContaining({
        sessionSlug: 'edge',
        adminAddress: ADMIN_ADDRESS,
        config: expect.objectContaining({
          allowOrigins: ['https://existing.example.test'],
        }),
      }),
    }));
    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-config'));
    const payload = JSON.parse(adminCall[1].body);
    expect(payload.sessionSlug).toBe('edge');
    expect(payload.adminAddress).toBe(ADMIN_ADDRESS);
    expect(payload.action).toBe('set-config');
    expect(payload.slug).toBe('edge');
    expect(Object.prototype.hasOwnProperty.call(payload.config, 'adminAddress')).toBe(false);
    expect(payload.config.allowOrigins).toEqual(['https://existing.example.test']);
    expect(getCachedSessionWorkerConfig('edge')).toEqual(expect.objectContaining({
      corsWorkerUrl: 'https://worker.example.test',
      allowOrigins: ['https://existing.example.test'],
      limits: { perWalletPerDay: 3 },
      rpcEndpoint: 'https://rpc.example.test',
    }));
  });

  it('normalizes mixed delimiter allowOrigins input before saving', async () => {
    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    fireEvent.change(await openAllowlistEditor(), {
      target: { value: 'https://alpha.example.test, http://localhost:7391\nhttps://alpha.example.test/' },
    });
    await clickAndSettle(screen.getByRole('button', { name: 'Save allowlist' }));

    await waitFor(() => {
      expect(screen.getByText(/allowOrigins saved \(2 origins\)/)).toBeInTheDocument();
    });

    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-config'));
    const payload = JSON.parse(adminCall[1].body);
    expect(payload.config.allowOrigins).toEqual([
      'https://alpha.example.test',
      'http://localhost:7391',
    ]);
  });

  it('retries allowlist saves when the worker reports a nonce mismatch', async () => {
    let setConfigCalls = 0;
    mockBuildSignedAdminActionAuth
      .mockImplementationOnce(async ({ action, slug }) => ({
        address: ADMIN_ADDRESS,
        signature: '0xtyped-admin-request-1',
        action,
        slug,
        bodyHash: '0xbodyhash-1',
        nonce: 'typed-admin-nonce-1',
        audience: 'http://localhost:3000',
        expiration: 1700000000,
      }))
      .mockImplementationOnce(async ({ action, slug }) => ({
        address: ADMIN_ADDRESS,
        signature: '0xtyped-admin-request-2',
        action,
        slug,
        bodyHash: '0xbodyhash-2',
        nonce: 'typed-admin-nonce-2',
        audience: 'http://localhost:3000',
        expiration: 1700000001,
      }));
    global.fetch = jest.fn((url) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) });
      }
      if (String(url).endsWith('/admin/set-config')) {
        setConfigCalls += 1;
        if (setConfigCalls === 1) {
          return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'Nonce mismatch or expired.' }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    fireEvent.change(await openAllowlistEditor(), {
      target: { value: 'https://existing.example.test' },
    });
    await clickAndSettle(screen.getByRole('button', { name: 'Save allowlist' }));

    await waitFor(() => {
      expect(screen.getByText(/allowOrigins saved \(1 origins\)/)).toBeInTheDocument();
    });

    expect(mockBuildSignedAdminActionAuth).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/admin/set-config'))).toHaveLength(2);
    const [, secondRequest] = global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/admin/set-config'))[1];
    expect(JSON.parse(secondRequest.body).nonce).toBe('typed-admin-nonce-2');
  });

  it('saving an empty allowlist keeps CORS open and surfaces a warning', async () => {
    localStorage.setItem('ce:sessionWorkerConfigCache:v1', JSON.stringify({
      v: 2,
      bySession: {
        edge: {
          config: {
            corsWorkerUrl: 'https://worker.example.test',
            allowOrigins: ['https://existing.example.test'],
          },
          cachedAtMs: 1700000000000,
        },
      },
    }));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    fireEvent.change(await openAllowlistEditor(), {
      target: { value: '' },
    });
    expect(screen.getByText(
      'Empty allowlist: saving this draft keeps CORS open for any browser origin.'
    )).toBeInTheDocument();

    await clickAndSettle(screen.getByRole('button', { name: 'Save allowlist' }));

    await waitFor(() => {
      expect(screen.getByText(/allowOrigins saved with open CORS/)).toBeInTheDocument();
    });

    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-config'));
    const payload = JSON.parse(adminCall[1].body);
    expect(payload.config.allowOrigins).toEqual([]);
    expect(getCachedSessionWorkerConfig('edge')).toEqual(expect.objectContaining({
      allowOrigins: [],
    }));
  });

  it('adds recommended origins to the allowlist draft without duplicating entries', async () => {
    localStorage.setItem('ce:sessionWorkerConfigCache:v1', JSON.stringify({
      v: 2,
      bySession: {
        edge: {
          config: {
            corsWorkerUrl: 'https://worker.example.test',
            allowOrigins: ['https://existing.example.test', 'http://localhost:7391'],
          },
          cachedAtMs: 1700000000000,
        },
      },
    }));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    await openAllowlistEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Add recommended origins' }));

    await waitFor(() => {
      expect(screen.getByText(/Save allowlist to apply/)).toBeInTheDocument();
    });

    const values = getAllowOriginsInput().value.split('\n').filter(Boolean);
    expect(values).toEqual(expect.arrayContaining([
      'https://existing.example.test',
      'http://localhost:7391',
      'https://contextengine.xyz', // intentional: production recommended origin assertion
      window.location.origin,
    ]));
    expect(values.filter((entry) => entry === 'http://localhost:7391')).toHaveLength(1);
    expect(global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-config'))).toBeUndefined();
  });

  it('turns worker allowlist save fetch failures into a stale-worker/CORS hint', async () => {
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : Promise.reject(new TypeError('Failed to fetch'))
    ));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    fireEvent.change(await openAllowlistEditor(), {
      target: { value: 'https://replacement.example.test' },
    });
    await clickAndSettle(screen.getByRole('button', { name: 'Save allowlist' }));

    await waitFor(() => {
      expect(screen.getByText(
        /Worker request could not reach https:\/\/worker\.example\.test\./
      )).toBeInTheDocument();
    });
    expect(screen.getByText(
      /If this session still resolves an older worker URL, finish deploy\/config sync or edit the worker URL override first\./
    )).toBeInTheDocument();
  });

  it('surfaces missing worker URLs before admin patch actions can run', async () => {
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: '',
      source: 'session-config',
      status: 'missing',
    });
    sessionEntries = [['edge', buildSessionConfig({ corsWorkerUrl: '' })]];

    await renderAdminPage();

    await screen.findByRole('button', { name: 'Allowlist' });
    await openAllowlistEditor();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save allowlist' })).toBeDisabled();
    });
    expect(screen.queryByText('Missing (missing)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save allowlist' })).toBeDisabled();
  });

  it('prefills the worker hero card from the cached worker-config replica while async resolution is pending', async () => {
    let resolveWorkerLookup;
    mockResolveCorsProxyUrl.mockImplementation(() => new Promise((resolve) => {
      resolveWorkerLookup = resolve;
    }));
    sessionEntries = [['edge', buildSessionConfig({ corsWorkerUrl: '' })]];
    localStorage.setItem('ce:sessionWorkerConfigCache:v1', JSON.stringify({
      v: 1,
      bySession: {
        edge: {
          corsWorkerUrl: 'https://worker-kv-cache.example.test',
        },
      },
    }));

    await renderAdminPage();

    expect(await screen.findByDisplayValue('https://worker-kv-cache.example.test')).toBeInTheDocument();
    expect(await openAllowlistEditor()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save allowlist' })).toBeDisabled();

    await act(async () => {
      resolveWorkerLookup({
        url: 'https://worker-kv-cache.example.test',
        source: 'worker-config-cache',
        status: 'plain',
      });
    });
  });

  it('prefills the worker hero card with the shared fallback for the general session', async () => {
    let resolveWorkerLookup;
    mockResolveCorsProxyUrl.mockImplementation(() => new Promise((resolve) => {
      resolveWorkerLookup = resolve;
    }));
    sessionEntries = [['', buildSessionConfig({
      slug: '',
      sessionName: 'Context Engine',
      corsWorkerUrl: '',
    })]];

    await renderAdminPage();

    const workerInput = await screen.findByPlaceholderText(/worker-name.*account-subdomain/i);
    expect(workerInput).toHaveValue(CLOUDFLARE_CORS_WORKER_URL);
    expect(screen.getByRole('link', { name: 'Open session' })).toHaveAttribute('href', 'http://localhost/session');

    const metadataPanel = screen.getByText('Session metadata').closest('section');
    fireEvent.click(within(metadataPanel).getAllByRole('button')[0]);
    expect(within(metadataPanel).getByRole('link', { name: 'general' })).toHaveAttribute('href', 'http://localhost/session');

    await act(async () => {
      resolveWorkerLookup({
        url: '',
        source: 'missing',
        status: 'missing',
      });
    });
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

  it('shows Arweave and faucet balances inline with worker secrets and refreshes both cards', async () => {
    const arweave = Arweave.init({ host: 'arweave.example.test', port: 443, protocol: 'https' });
    const arweaveJwk = await arweave.wallets.generate();
    const arweaveAddress = await arweave.wallets.jwkToAddress(arweaveJwk);
    const arweaveShort = `${arweaveAddress.slice(0, 6)}…${arweaveAddress.slice(-4)}`;
    const faucetWallet = ethers.Wallet.createRandom();
    const faucetPrivateKey = faucetWallet.privateKey;
    const faucetAddress = faucetWallet.address;
    const faucetShort = `${faucetAddress.slice(0, 6)}…${faucetAddress.slice(-4)}`;
    const arweaveBalanceSpy = jest
      .spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBalance')
      .mockResolvedValue(ethers.utils.parseEther('0.1842'));
    mockReadArweaveWalletBalance.mockResolvedValue({
      address: arweaveAddress,
      balanceUrl: `https://arweave.example.test/wallet/${arweaveAddress}/balance`,
      gatewayBase: 'https://arweave.example.test',
      winston: '12345678000000',
    });

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      const workerSecretsPanel = await openWorkerSecretsPanel();
      fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Arweave' }));
      fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

      fireEvent.change(getSecretInputByLabel('Arweave JWK (JSON)'), {
        target: { value: JSON.stringify(arweaveJwk) },
      });
      fireEvent.change(getSecretInputByLabel('Faucet private key'), {
        target: { value: faucetPrivateKey },
      });

      await waitFor(() => {
        expect(mockReadArweaveWalletBalance).toHaveBeenCalledTimes(1);
        expect(arweaveBalanceSpy).toHaveBeenCalledTimes(1);
      });
      expect(await within(workerSecretsPanel).findByText('12.345678 AR')).toBeInTheDocument();
      expect(within(workerSecretsPanel).getByText('0.1842 ETH')).toBeInTheDocument();
      expect(within(workerSecretsPanel).getByText(arweaveShort)).toBeInTheDocument();
      expect(within(workerSecretsPanel).getByText(`${faucetShort} • Base Sepolia (84532)`)).toBeInTheDocument();
      expect(screen.queryByText('Resources')).not.toBeInTheDocument();

      expect(workerSecretsPanel).not.toHaveTextContent(faucetPrivateKey);

      await clickAndSettle(screen.getByRole('button', { name: 'Refresh Arweave balance' }));
      await clickAndSettle(screen.getByRole('button', { name: 'Refresh faucet balance' }));

      await waitFor(() => {
        expect(mockReadArweaveWalletBalance).toHaveBeenCalledTimes(2);
        expect(arweaveBalanceSpy).toHaveBeenCalledTimes(2);
      });
    } finally {
      arweaveBalanceSpy.mockRestore();
    }
  });

  it('accepts bare hex faucet private keys when previewing faucet balance', async () => {
    const faucetWallet = ethers.Wallet.createRandom();
    const faucetPrivateKey = faucetWallet.privateKey.slice(2);
    const faucetAddress = faucetWallet.address;
    const faucetShort = `${faucetAddress.slice(0, 6)}…${faucetAddress.slice(-4)}`;
    const faucetBalanceSpy = jest
      .spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBalance')
      .mockResolvedValue(ethers.utils.parseEther('0.1842'));

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      const workerSecretsPanel = await openWorkerSecretsPanel();
      fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

      fireEvent.change(getSecretInputByLabel('Faucet private key'), {
        target: { value: faucetPrivateKey },
      });

      await waitFor(() => {
        expect(faucetBalanceSpy).toHaveBeenCalledTimes(1);
      });
      expect(await within(workerSecretsPanel).findByText('0.1842 ETH')).toBeInTheDocument();
      expect(within(workerSecretsPanel).getByText(`${faucetShort} • Base Sepolia (84532)`)).toBeInTheDocument();
      expect(within(workerSecretsPanel).queryByText('Invalid key')).not.toBeInTheDocument();
    } finally {
      faucetBalanceSpy.mockRestore();
    }
  });

  it('hides zero-balance resource summaries in worker secrets', async () => {
    const arweave = Arweave.init({ host: 'arweave.example.test', port: 443, protocol: 'https' });
    const arweaveJwk = await arweave.wallets.generate();
    const faucetWallet = ethers.Wallet.createRandom();
    const faucetBalanceSpy = jest
      .spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBalance')
      .mockResolvedValue(ethers.constants.Zero);
    mockReadArweaveWalletBalance.mockResolvedValue({
      address: await arweave.wallets.jwkToAddress(arweaveJwk),
      balanceUrl: 'https://arweave.example.test/wallet/test/balance',
      gatewayBase: 'https://arweave.example.test',
      winston: '5',
    });

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      const workerSecretsPanel = await openWorkerSecretsPanel();
      fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Arweave' }));
      fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

      fireEvent.change(getSecretInputByLabel('Arweave JWK (JSON)'), {
        target: { value: JSON.stringify(arweaveJwk) },
      });
      fireEvent.change(getSecretInputByLabel('Faucet private key'), {
        target: { value: faucetWallet.privateKey },
      });

      await waitFor(() => {
        expect(mockReadArweaveWalletBalance).toHaveBeenCalledTimes(1);
        expect(faucetBalanceSpy).toHaveBeenCalledTimes(1);
        expect(within(workerSecretsPanel).queryByText('Arweave balance')).not.toBeInTheDocument();
        expect(within(workerSecretsPanel).queryByText('Faucet balance')).not.toBeInTheDocument();
        expect(within(workerSecretsPanel).queryByText('0.000000 AR')).not.toBeInTheDocument();
        expect(within(workerSecretsPanel).queryByText('0.0000 ETH')).not.toBeInTheDocument();
      });
    } finally {
      faucetBalanceSpy.mockRestore();
    }
  }, 15000);

  it('shows invalid resource states when the Arweave JWK or faucet key cannot be parsed', async () => {
    const faucetBalanceSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBalance');

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      const workerSecretsPanel = await openWorkerSecretsPanel();
      fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Arweave' }));
      fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

      fireEvent.change(getSecretInputByLabel('Arweave JWK (JSON)'), {
        target: { value: '{' },
      });
      fireEvent.change(getSecretInputByLabel('Faucet private key'), {
        target: { value: 'not-a-private-key' },
      });

      expect(await within(workerSecretsPanel).findByText('Invalid JWK')).toBeInTheDocument();
      expect(await within(workerSecretsPanel).findByText('Invalid key')).toBeInTheDocument();
      expect(mockReadArweaveWalletBalance).not.toHaveBeenCalled();
      expect(faucetBalanceSpy).not.toHaveBeenCalled();
    } finally {
      faucetBalanceSpy.mockRestore();
    }
  });
});
