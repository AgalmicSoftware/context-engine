/** @file AdminPage.workerSecrets.test.jsx */
import React, { act } from 'react';
import { ethers } from 'ethers';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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

jest.mock('../../utilities/arweave/arweaveClient.js', () => {
  const arweaveClient = {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: jest.fn(),
    readArweaveWalletBalance: jest.fn(),
    formatWinstonToAr: jest.fn(),
  };
  return { arweaveClient, arweaveScripts: arweaveClient };
});

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

const getWorkerSecretsPanel = () => screen.getByText('Worker secrets').closest('section');
const getSecretCardButton = (panel, label) => within(panel).getByRole('button', { name: label });
const getSecretInputByLabel = (labelText) => (
  screen.getByText(labelText).parentElement.querySelector('input,textarea')
);
const clickAndSettle = async (element) => {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
};
const waitForResolvedWorkerUrl = () => screen.findByDisplayValue('https://worker.example.test');
const openWorkerSecretsPanel = async () => {
  const panel = getWorkerSecretsPanel();
  await clickAndSettle(within(panel).getByRole('button', { name: 'Toggle Worker secrets section' }));
  return panel;
};

describe('AdminPage worker secrets controls', () => {
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

  it('does not label blank write-only worker secret inputs as empty before presence is checked', async () => {
    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();

    expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Unknown')).toBeInTheDocument();
    expect(within(getSecretCardButton(workerSecretsPanel, 'RPC')).getByText('Unknown')).toBeInTheDocument();
    expect(within(getSecretCardButton(workerSecretsPanel, 'Arweave')).getByText('Unknown')).toBeInTheDocument();
    expect(within(getSecretCardButton(workerSecretsPanel, 'Faucet')).getByText('Unknown')).toBeInTheDocument();
    expect(within(getSecretCardButton(workerSecretsPanel, 'Lit')).getByText('Unknown')).toBeInTheDocument();
    expect(within(workerSecretsPanel).queryByText('Empty')).not.toBeInTheDocument();
  });

  it('loads worker secret presence through a signed admin action without exposing secret values', async () => {
    global.fetch = jest.fn((url) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) });
      }
      if (String(url).endsWith('/admin/secret-presence')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            sessionSlug: 'edge',
            secrets: {
              openaiKey: true,
              anthropicKey: false,
              openrouterKey: false,
              customRpcUrl: true,
              customRpcKey: false,
              arweaveJwk: false,
              faucetPrivateKey: true,
              litAccountApiKey: false,
              litUsageApiKey: true,
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    await clickAndSettle(within(workerSecretsPanel).getByRole('button', { name: 'Refresh secret status' }));

    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Configured')).toBeInTheDocument();
      expect(within(getSecretCardButton(workerSecretsPanel, 'RPC')).getByText('Configured')).toBeInTheDocument();
      expect(within(getSecretCardButton(workerSecretsPanel, 'Arweave')).getByText('Empty')).toBeInTheDocument();
      expect(within(getSecretCardButton(workerSecretsPanel, 'Faucet')).getByText('Configured')).toBeInTheDocument();
      expect(within(getSecretCardButton(workerSecretsPanel, 'Lit')).getByText('Configured')).toBeInTheDocument();
    });
    expect(screen.getByText('Stored secret status refreshed.')).toBeInTheDocument();

    const adminCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/secret-presence'));
    expect(adminCall).toBeDefined();
    const payload = JSON.parse(adminCall[1].body);
    expect(payload).toEqual(expect.objectContaining({
      action: 'secret-presence',
      sessionSlug: 'edge',
      slug: 'edge',
    }));
    expect(payload.secrets).toBeUndefined();
    expect(JSON.stringify(payload)).not.toMatch(/sk-|secret-value|rpc\.example/);
  });

  it('resets worker secret presence when the worker URL changes', async () => {
    global.fetch = jest.fn((url) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) });
      }
      if (String(url).endsWith('/admin/secret-presence')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            sessionSlug: 'edge',
            secrets: { openaiKey: true },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    await clickAndSettle(within(workerSecretsPanel).getByRole('button', { name: 'Refresh secret status' }));
    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Configured')).toBeInTheDocument();
    });

    await clickAndSettle(screen.getByRole('button', { name: 'Edit worker URL' }));
    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('https://worker.example.test'), {
        target: { value: 'https://other-worker.example.test' },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText(/Stored secret status not checked/)).toBeInTheDocument();
    });
  });

  it('resets worker secret presence when the general session worker URL changes', async () => {
    sessionEntries = [[
      '',
      buildSessionConfig({
        slug: 'general',
        sessionName: 'General Session',
      }),
    ]];
    global.fetch = jest.fn((url) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) });
      }
      if (String(url).endsWith('/admin/secret-presence')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            sessionSlug: '',
            secrets: { openaiKey: true },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    await clickAndSettle(within(workerSecretsPanel).getByRole('button', { name: 'Refresh secret status' }));
    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Configured')).toBeInTheDocument();
    });

    await clickAndSettle(screen.getByRole('button', { name: 'Edit worker URL' }));
    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('https://worker.example.test'), {
        target: { value: 'https://other-worker.example.test' },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText(/Stored secret status not checked/)).toBeInTheDocument();
    });
  });

  it('ignores stale worker secret presence responses after the worker URL changes', async () => {
    let resolvePresence;
    const presencePromise = new Promise((resolve) => {
      resolvePresence = resolve;
    });
    global.fetch = jest.fn((url) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) });
      }
      if (String(url).endsWith('/admin/secret-presence')) {
        return presencePromise;
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    await clickAndSettle(within(workerSecretsPanel).getByRole('button', { name: 'Refresh secret status' }));
    await waitFor(() => {
      expect(screen.getByText('Checking stored secret status…')).toBeInTheDocument();
    });

    await clickAndSettle(screen.getByRole('button', { name: 'Edit worker URL' }));
    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('https://worker.example.test'), {
        target: { value: 'https://other-worker.example.test' },
      });
      resolvePresence({
        ok: true,
        json: async () => ({
          ok: true,
          sessionSlug: 'edge',
          secrets: { openaiKey: true },
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Unknown')).toBeInTheDocument();
      expect(screen.queryByText('Stored secret status refreshed.')).not.toBeInTheDocument();
    });
  });

  it('keeps saved worker secret presence when a stale refresh returns after save', async () => {
    let resolvePresence;
    const presencePromise = new Promise((resolve) => {
      resolvePresence = resolve;
    });
    global.fetch = jest.fn((url) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) });
      }
      if (String(url).endsWith('/admin/secret-presence')) {
        return presencePromise;
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    await clickAndSettle(within(workerSecretsPanel).getByRole('button', { name: 'Refresh secret status' }));
    await waitFor(() => {
      expect(screen.getByText('Checking stored secret status…')).toBeInTheDocument();
    });

    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'AI' }));
    fireEvent.change(getSecretInputByLabel('OpenAI API key'), {
      target: { value: 'sk-saved-after-refresh' },
    });

    await clickAndSettle(await screen.findByRole('button', { name: 'Save worker secrets' }));
    await waitFor(() => {
      expect(screen.getByText(/Worker secrets saved for edge/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Configured')).toBeInTheDocument();
      expect(screen.getByText('Stored secret status updated from saved changes.')).toBeInTheDocument();
    });

    await act(async () => {
      resolvePresence({
        ok: true,
        json: async () => ({
          ok: true,
          sessionSlug: 'edge',
          secrets: { openaiKey: false },
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(within(getSecretCardButton(workerSecretsPanel, 'AI')).getByText('Configured')).toBeInTheDocument();
      expect(screen.queryByText('Stored secret status refreshed.')).not.toBeInTheDocument();
    });
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
    expect(within(within(workerSecretsPanel).getByRole('button', { name: 'AI' })).getByText('Configured')).toBeInTheDocument();
    expect(within(within(workerSecretsPanel).getByRole('button', { name: 'RPC' })).getByText('Unknown')).toBeInTheDocument();
    expect(within(within(workerSecretsPanel).getByRole('button', { name: 'Arweave' })).getByText('Unknown')).toBeInTheDocument();
    expect(within(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' })).getByText('Unknown')).toBeInTheDocument();

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
});
