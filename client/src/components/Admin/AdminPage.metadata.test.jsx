/** @file AdminPage.metadata.test.jsx */
import React, { act } from 'react';
import { ethers } from 'ethers';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_REGISTRY_CACHE_UPDATED_EVENT = 'ce:session-registry-cache-updated';
const EDIT_SETTINGS_LINK_TESTID = 'ce-admin-edit-settings-link';

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
const mockUpsertSessionRegistryCache = jest.fn();
const mockGetReadProviderForChain = jest.fn();

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
  return { arweaveClient };
});

jest.mock('../../utilities/crypto/encryptedFields.js', () => ({
  encryptedFieldsUtils: {
    resolveEncryptedValue: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/rpcProviders.js', () => ({
  getReadProviderForChain: (...args) => mockGetReadProviderForChain(...args),
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
  sessionRegistryUtils: {
    SESSION_REGISTRY_CACHE_UPDATED_EVENT,
    fetchSessionFromRegistry: jest.fn(),
    upsertSessionRegistryCache: (...args) => mockUpsertSessionRegistryCache(...args),
    normalizeSessionIdHex: jest.fn(() => ''),
    toRegistrySlug: jest.fn((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
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

const renderAdminPage = async ({ account = ADMIN_ADDRESS, initialSessionConfig } = {}) => {
  let utils;
  await act(async () => {
    utils = render(
      <AdminPage
        account={account}
        network={{ id: 84532 }}
        loginComplete={true}
        toggleLoginModal={jest.fn()}
        initialSessionConfig={initialSessionConfig}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return utils;
};

const waitForResolvedWorkerUrl = () => screen.findByDisplayValue('https://worker.example.test');
const openMetadataPanel = () => {
  const metadataPanel = screen.getByText('Session metadata').closest('section');
  fireEvent.click(within(metadataPanel).getByRole('button', { name: 'Toggle Session metadata section' }));
  return metadataPanel;
};

describe('AdminPage metadata panel', () => {
  const originalFetch = global.fetch;
  let web3ProviderSpy;
  let sessionEntries;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url) =>
      Promise.resolve(
        String(url).endsWith('/auth/nonce')
          ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
          : { ok: true, json: async () => ({ ok: true }) },
      ),
    );
    sessionEntries = [['edge', buildSessionConfig()]];
    mockLoadSessionRegistryCache.mockResolvedValue(undefined);
    mockGetAllSessionEntries.mockImplementation(() => sessionEntries);
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: 'https://worker.example.test',
      source: 'session-config',
      status: 'ok',
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

  it('renders clickable metadata links and a raw metadata copy control', async () => {
    sessionEntries = [
      [
        'edge',
        buildSessionConfig({
          __registry: {
            registryChainId: 84532,
            chainId: 84532,
            adminAddress: ADMIN_ADDRESS,
            // A well-formed Arweave id: only those become gateway links.
            metadataURI: `ar://old-metadata${'0'.repeat(31)}`,
          },
        }),
      ],
    ];

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const metadataPanel = openMetadataPanel();

    expect(within(metadataPanel).getByRole('link', { name: 'edge' })).toHaveAttribute(
      'href',
      expect.stringContaining('/session/edge'),
    );
    expect(metadataPanel.querySelector(`a[href="/u/${encodeURIComponent(ADMIN_ADDRESS)}"]`)).not.toBeNull();
    expect(metadataPanel.querySelector('a[href*="old-metadata"]')).not.toBeNull();
    expect(within(metadataPanel).getByRole('button', { name: 'Copy raw metadata JSON' })).toBeInTheDocument();
    // A registry session is edited on its settings page too, found through the registry.
    expect(within(metadataPanel).getByTestId(EDIT_SETTINGS_LINK_TESTID)).toHaveAttribute(
      'href',
      'http://localhost/session/edge/settings',
    );
  });

  it('warns when registry contract addresses are synthesized from chain defaults', async () => {
    sessionEntries = [
      [
        'edge',
        buildSessionConfig({
          contracts: {
            surveys: { address: '0x00000000000000000000000000000000000000f1', chainId: 84532 },
          },
          __registry: {
            registryChainId: 84532,
            chainId: 84532,
            adminAddress: ADMIN_ADDRESS,
            metadataURI: 'ar://missing-metadata',
            metadataLoadState: 'unavailable',
            metadataDefaultedContractKeys: ['surveys'],
          },
        }),
      ],
    ];

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const metadataPanel = openMetadataPanel();

    expect(within(metadataPanel).getByText(/Session metadata could not be loaded/i)).toBeInTheDocument();
    expect(within(metadataPanel).getByText(/contracts below may be chain defaults/i)).toBeInTheDocument();
  });

  it('links a Worker-hosted session to its settings page on the same Session Worker', async () => {
    sessionEntries = [];
    const initialSessionConfig = {
      slug: 'worker-metadata',
      sessionId: '0x1234567890abcdef1234567890abcdef',
      configRevision: 'worker-metadata-revision',
      sessionName: 'Worker Metadata Session',
      corsWorkerUrl: 'https://worker-metadata.example.test',
      adminAddress: ADMIN_ADDRESS,
      sessionModeProfile: cloneSessionModePreset('fast_cheap_cloudflare'),
    };
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: initialSessionConfig.corsWorkerUrl,
      source: 'session-config',
      status: 'ok',
    });

    await renderAdminPage({ initialSessionConfig });
    expect(await screen.findByDisplayValue(initialSessionConfig.corsWorkerUrl)).toBeInTheDocument();

    const metadataPanel = openMetadataPanel();
    const link = within(metadataPanel).getByTestId(EDIT_SETTINGS_LINK_TESTID);

    expect(link).toHaveTextContent('Edit settings');
    expect(link).toHaveAttribute(
      'href',
      'http://localhost/session/worker-metadata/settings?worker=https%3A%2F%2Fworker-metadata.example.test',
    );
    expect(link).not.toHaveAttribute('target');
    expect(within(metadataPanel).queryByRole('button', { name: 'Update metadata' })).not.toBeInTheDocument();
  });
});
