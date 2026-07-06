/** @file AdminPage.allowlist.test.jsx */
import React, { act } from 'react';
import { ethers } from 'ethers';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getCachedSessionWorkerConfig } from '../../utilities/session/sessionWorkerConfigCache.js';
import { CLOUDFLARE_CORS_WORKER_URL } from '../../variables/appConfig.js';

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

describe('AdminPage allowlist controls', () => {
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
});
