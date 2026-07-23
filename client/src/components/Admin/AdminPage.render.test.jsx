/** @file AdminPage.render.test.jsx */
import React, { act } from 'react';
import { ethers } from 'ethers';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import styles from './AdminPage.module.scss';

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_REGISTRY_CACHE_UPDATED_EVENT = 'ce:session-registry-cache-updated';
const AGENT_SESSION_WRAPPED_CAPABILITY = {
  version: 1,
  enabled: true,
  origin: 'https://wrapped-edge.example.test',
  protocolVersion: 'agent-session-wrapped-v1',
  revision: 'wrapped-edge-revision',
  verifiedAt: '2026-07-20T18:00:00.000Z',
};

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
const mockFetchWorkerWithAuth = jest.fn();
const mockBuildSiweMessage = jest.fn(() => 'siwe-message');
const mockSetSessionFieldsOnChain = jest.fn();
const mockUploadSessionMetadata = jest.fn();
const mockUpdateSessionMetadataOnChain = jest.fn();
const mockUpsertSessionRegistryCache = jest.fn();
const mockFetchSessionFromRegistry = jest.fn();
const mockUploadDataToArweave = jest.fn();
const mockBuildArweaveGatewayUrl = jest.fn();
const mockNormalizeSessionMediaUrl = jest.fn((value) => String(value || '').trim());

jest.mock('../../utilities/worker/corsProxy.js', () => ({
  corsProxyUtils: {
    resolveCorsProxyUrl: (...args) => mockResolveCorsProxyUrl(...args),
  },
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  buildSiweMessage: (...args) => mockBuildSiweMessage(...args),
  buildSignedAdminActionAuth: (...args) => mockBuildSignedAdminActionAuth(...args),
  fetchWorkerWithAuth: (...args) => mockFetchWorkerWithAuth(...args),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => ({})),
  },
}));

jest.mock('../../utilities/arweave/arweaveClient.js', () => {
  const arweaveClient = {
    uploadDataToArweave: (...args) => mockUploadDataToArweave(...args),
    buildArweaveGatewayUrl: (...args) => mockBuildArweaveGatewayUrl(...args),
    downloadDataFromArweave: jest.fn(),
    readArweaveWalletBalance: jest.fn(),
    formatWinstonToAr: jest.fn(),
  };
  return { arweaveClient };
});

jest.mock('../../domains/sessions/sessionMediaUrls.js', () => ({
  normalizeSessionMediaUrl: (...args) => mockNormalizeSessionMediaUrl(...args),
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
  fetchSessionFromRegistry: (...args) => mockFetchSessionFromRegistry(...args),
  upsertSessionRegistryCache: (...args) => mockUpsertSessionRegistryCache(...args),
  uploadSessionMetadata: (...args) => mockUploadSessionMetadata(...args),
  updateSessionMetadataOnChain: (...args) => mockUpdateSessionMetadataOnChain(...args),
  sessionRegistryUtils: {
    SESSION_REGISTRY_CACHE_UPDATED_EVENT,
    fetchSessionFromRegistry: (...args) => mockFetchSessionFromRegistry(...args),
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

const renderAdminPage = async ({
  account = ADMIN_ADDRESS,
  initialSessionId,
  initialRegistryChainId,
  initialSessionConfig,
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
        initialSessionConfig={initialSessionConfig}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return utils;
};

const getGatePanel = () => screen.getByText('On-chain default gate').closest('section');

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
    mockFetchWorkerWithAuth.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    mockBuildSiweMessage.mockReturnValue('siwe-message');
    mockFetchSessionFromRegistry.mockResolvedValue(null);
    mockUploadDataToArweave.mockResolvedValue('arweave_test_tx_1234567890');
    mockBuildArweaveGatewayUrl.mockImplementation((txId) => `https://arweave.example.test/${txId}`);
    mockNormalizeSessionMediaUrl.mockImplementation((value) => String(value || '').trim());
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
    expect(screen.queryByTestId('ce-admin-worker-groups')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-admin-agent-session-wrapped')).toHaveTextContent(/Agent Session Wrapped/i);

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
    expect(mockResolveCorsProxyUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'edge',
        sessionConfig: expect.objectContaining({ slug: 'edge' }),
      }),
    );
  });

  it('uses an explicit worker-canonical config without loading the registry', async () => {
    sessionEntries = [];
    const initialSessionConfig = {
      slug: 'worker-admin',
      sessionId: '0x1234567890abcdef1234567890abcdef',
      sessionName: 'Worker Admin Session',
      corsWorkerUrl: 'https://worker-admin.example.test',
      adminAddress: ADMIN_ADDRESS,
      configRevision: 'worker-admin-revision',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: initialSessionConfig.corsWorkerUrl,
      source: 'session-config',
      status: 'ok',
    });

    await renderAdminPage({ initialSessionConfig });

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('worker-admin');
    expect(await screen.findByDisplayValue(initialSessionConfig.corsWorkerUrl)).toBeInTheDocument();
    expect(mockLoadSessionRegistryCache).not.toHaveBeenCalled();
    expect(mockFetchSessionFromRegistry).not.toHaveBeenCalled();
    const metadataPanel = screen.getByText('Session metadata').closest('section');
    fireEvent.click(within(metadataPanel).getByRole('button', { name: 'Toggle Session metadata section' }));
    expect(screen.getByText('Cloudflare Session Worker')).toBeInTheDocument();
    expect(screen.getByText('worker-admin-revision')).toBeInTheDocument();
    expect(screen.getByText('Not reported')).toBeInTheDocument();
    expect(screen.queryByText('Chain / Registry')).not.toBeInTheDocument();
    expect(screen.queryByText('Metadata URI')).not.toBeInTheDocument();
    expect(screen.queryByText('On-chain default gate')).not.toBeInTheDocument();
    expect(within(metadataPanel).getByText('AI defaults')).toBeInTheDocument();
    expect(within(metadataPanel).getByText('Highlighted question IDs')).toBeInTheDocument();
    expect(within(metadataPanel).queryByText('Contracts')).not.toBeInTheDocument();
    expect(within(metadataPanel).queryByText('Ignored SBT list')).not.toBeInTheDocument();
    expect(within(metadataPanel).queryByText('Start block')).not.toBeInTheDocument();
    expect(within(metadataPanel).queryByText('Faucet amount (ETH)')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-admin-worker-groups')).toHaveTextContent(/Native Worker Groups/i);
    expect(screen.getByTestId('ce-admin-worker-groups')).toHaveTextContent(/Worker-owned participant groups/i);
  });

  it('keeps Worker SBT conditions separate from the registry transaction editor', async () => {
    sessionEntries = [];
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionModeProfile.evm.registryChainId = 11155420;
    sessionModeProfile.authorization.mechanisms.push('sbt_onchain');
    sessionModeProfile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x1111111111111111111111111111111111111111',
          anyOrAll: 'any',
        },
      ],
    };
    const initialSessionConfig = {
      slug: 'worker-sbt-admin',
      sessionId: '0x1234567890abcdef1234567890abcdef',
      sessionName: 'Worker SBT Admin Session',
      corsWorkerUrl: 'https://worker-sbt-admin.example.test',
      adminAddress: ADMIN_ADDRESS,
      sessionModeProfile,
    };
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: initialSessionConfig.corsWorkerUrl,
      source: 'session-config',
      status: 'ok',
    });

    await renderAdminPage({ initialSessionConfig });

    expect(await screen.findByTestId('ce-admin-worker-sbt-gates')).toHaveTextContent(/Advanced on-chain access gates/i);
    expect(screen.getByTestId('ce-admin-worker-sbt-gates')).toHaveTextContent(/read-only/i);
    expect(screen.getByTestId('ce-admin-worker-sbt-gates')).toHaveTextContent(/No registry transaction/i);
    expect(screen.queryByText('On-chain default gate')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.ADMIN_GATE_UPDATE_BUTTON)).not.toBeInTheDocument();
  });

  it('labels Worker groups as a separate agent authorization domain for an enabled Wrapped registry session', async () => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionModeProfile.surfaces.agentHttp = true;
    sessionEntries = [
      [
        'edge',
        buildSessionConfig({
          sessionModeProfile,
          agentSessionWrapped: AGENT_SESSION_WRAPPED_CAPABILITY,
        }),
      ],
    ];

    await renderAdminPage();

    const workerGroupsPanel = await screen.findByTestId('ce-admin-worker-groups');
    expect(workerGroupsPanel).toHaveTextContent(/Worker\/agent access groups/i);
    expect(workerGroupsPanel).toHaveTextContent(/separate from registry SBT Groups/i);
  });

  it('rebinds worker actions across route-only worker session navigation A to B to A', async () => {
    sessionEntries = [];
    global.fetch = jest.fn((url) =>
      Promise.resolve(
        String(url).endsWith('/health')
          ? { ok: false, status: 401, json: async () => ({ error: 'auth required' }) }
          : { ok: true, status: 200, json: async () => ({ ok: true }) },
      ),
    );
    const buildWorkerConfig = (slug) => ({
      slug,
      sessionId: slug === 'worker-a' ? '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' : '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      sessionName: `Session ${slug}`,
      corsWorkerUrl: `https://${slug}.example.test`,
      adminAddress: ADMIN_ADDRESS,
      configRevision: `revision-${slug}`,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    });
    const props = {
      account: ADMIN_ADDRESS,
      network: { id: 84532 },
      loginComplete: true,
      toggleLoginModal: jest.fn(),
    };
    mockResolveCorsProxyUrl.mockImplementation(async ({ sessionConfig }) => ({
      url: sessionConfig.corsWorkerUrl,
      source: 'session-config',
      status: 'ok',
    }));
    mockFetchWorkerWithAuth.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ts: '2026-07-14T00:00:00.000Z' }),
    });

    const view = render(<AdminPage {...props} initialSessionConfig={buildWorkerConfig('worker-a')} />);

    const probeCurrentSession = async (slug) => {
      expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue(slug);
      expect(await screen.findByDisplayValue(`https://${slug}.example.test`)).toBeInTheDocument();
      await clickAndSettle(screen.getByRole('button', { name: 'Test' }));
      const testsPanel = screen.getByText('Tests').closest('section');
      await clickAndSettle(within(testsPanel).getByTitle('Click to test /health'));
      await waitFor(() =>
        expect(mockFetchWorkerWithAuth).toHaveBeenLastCalledWith(
          `https://${slug}.example.test/health`,
          { method: 'GET' },
          expect.objectContaining({
            sessionSlug: slug,
            workerUrl: `https://${slug}.example.test`,
          }),
        ),
      );
    };

    await probeCurrentSession('worker-a');
    view.rerender(<AdminPage {...props} initialSessionConfig={buildWorkerConfig('worker-b')} />);
    await probeCurrentSession('worker-b');
    view.rerender(<AdminPage {...props} initialSessionConfig={buildWorkerConfig('worker-a')} />);
    await probeCurrentSession('worker-a');
  });

  it('does not admit an invalid raw Worker profile as a route-owned admin session', async () => {
    sessionEntries = [];

    await renderAdminPage({
      initialSessionConfig: {
        slug: 'invalid-worker',
        corsWorkerUrl: 'https://invalid-worker.example.test',
        adminAddress: ADMIN_ADDRESS,
        sessionModeProfile: {
          profileVersion: 999,
          authority: { mode: 'worker_canonical' },
        },
      },
    });

    await waitFor(() => expect(mockLoadSessionRegistryCache).toHaveBeenCalled());
    expect(screen.queryByDisplayValue('https://invalid-worker.example.test')).not.toBeInTheDocument();
  });

  it('shows profile repair guidance for an invalid selected session instead of on-chain registration advice', async () => {
    sessionEntries = [
      [
        'invalid-profile',
        buildSessionConfig({
          slug: 'invalid-profile',
          sessionModeProfile: {
            profileVersion: 999,
            authority: { mode: 'worker_canonical' },
          },
        }),
      ],
    ];

    await renderAdminPage();

    expect(await screen.findByText(/session capability profile is invalid or unsupported/i)).toBeInTheDocument();
    expect(screen.queryByText(/Register in \/new before using worker actions/i)).not.toBeInTheDocument();
  });

  it('shows canonical-config repair guidance when the selected session profile is missing', async () => {
    sessionEntries = [
      [
        'missing-profile',
        {
          slug: 'missing-profile',
          sessionName: 'Missing Profile',
          corsWorkerUrl: 'https://missing-profile.example.test',
          networkChainId: 11155420,
        },
      ],
    ];

    await renderAdminPage();

    expect(await screen.findByText(/missing a canonical capability profile/i)).toBeInTheDocument();
    expect(screen.queryByText(/Register in \/new before using worker actions/i)).not.toBeInTheDocument();
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

  it('runs worker health, AI, and faucet probes through authenticated worker fetches', async () => {
    global.fetch = jest.fn((url) =>
      Promise.resolve(
        String(url).endsWith('/health')
          ? { ok: false, status: 401, json: async () => ({ error: 'auth required' }) }
          : { ok: true, status: 200, json: async () => ({ ok: true }) },
      ),
    );
    mockFetchWorkerWithAuth.mockImplementation(async (url) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (String(url).endsWith('/health')) return { ts: '2026-01-02T03:04:05.000Z' };
        if (String(url).endsWith('/ai')) return { completion: 'pong from worker' };
        return { txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' };
      },
    }));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();
    await clickAndSettle(screen.getByRole('button', { name: 'Test' }));
    const testsPanel = screen.getByText('Tests').closest('section');

    await clickAndSettle(within(testsPanel).getByTitle('Click to test /health'));
    await waitFor(() => {
      expect(screen.getByText('OK (2026-01-02T03:04:05.000Z)')).toBeInTheDocument();
    });

    await clickAndSettle(within(testsPanel).getByTitle('Click to test AI'));
    await waitFor(() => {
      expect(screen.getByText('OK (pong from worker)')).toBeInTheDocument();
    });

    await clickAndSettle(within(testsPanel).getByTitle('Click to test faucet (0.0000001)'));
    await waitFor(() => {
      expect(screen.getByText('OK (tx 0x1234567890…)')).toBeInTheDocument();
    });

    expect(mockFetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.test/health',
      { method: 'GET' },
      expect.objectContaining({
        sessionSlug: 'edge',
        workerUrl: 'https://worker.example.test',
      }),
    );
    expect(mockFetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.test/ai',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"action":"ai"'),
      }),
      expect.objectContaining({
        sessionSlug: 'edge',
        workerUrl: 'https://worker.example.test',
      }),
    );
    expect(mockFetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.test/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"action":"request_test_eth"'),
      }),
      expect.objectContaining({
        sessionSlug: 'edge',
        workerUrl: 'https://worker.example.test',
      }),
    );
  });

  it('keeps worker probe requests exclusive while a probe is in flight', async () => {
    global.fetch = jest.fn((url) =>
      Promise.resolve(
        String(url).endsWith('/health')
          ? { ok: false, status: 401, json: async () => ({ error: 'auth required' }) }
          : { ok: true, status: 200, json: async () => ({ ok: true }) },
      ),
    );
    let resolveHealth;
    mockFetchWorkerWithAuth.mockImplementation((url) => {
      if (String(url).endsWith('/health')) {
        return new Promise((resolve) => {
          resolveHealth = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ ts: '2026-01-02T03:04:05.000Z' }),
            });
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ completion: 'should not run while health is busy' }),
      });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();
    await clickAndSettle(screen.getByRole('button', { name: 'Test' }));
    const testsPanel = screen.getByText('Tests').closest('section');

    fireEvent.click(within(testsPanel).getByTitle('Click to test /health'));
    await screen.findAllByText('Testing…');

    fireEvent.click(within(testsPanel).getByTitle('Click to test AI'));

    expect(mockFetchWorkerWithAuth).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveHealth();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('OK (2026-01-02T03:04:05.000Z)')).toBeInTheDocument();
    });
    expect(screen.queryByText('OK (should not run while health is busy)')).not.toBeInTheDocument();
  });

  it('uploads the admin Arweave probe payload and displays the gateway link', async () => {
    mockUploadDataToArweave.mockResolvedValue('arweave_probe_tx_1234567890');

    await renderAdminPage();
    await waitForResolvedWorkerUrl();
    await clickAndSettle(screen.getByRole('button', { name: 'Test' }));
    const testsPanel = screen.getByText('Tests').closest('section');

    await clickAndSettle(within(testsPanel).getByTitle('Click to test Arweave upload'));

    await waitFor(() => {
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('link', { name: 'OK (tx arweave_prob…)' })).toHaveAttribute(
        'href',
        'https://arweave.example.test/arweave_probe_tx_1234567890',
      );
    });
    expect(mockUploadDataToArweave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'admin-test',
        slug: 'edge',
      }),
      'json',
      expect.objectContaining({
        sessionSlug: 'edge',
        workerUrl: 'https://worker.example.test',
      }),
    );
    expect(mockBuildArweaveGatewayUrl).toHaveBeenCalledWith('arweave_probe_tx_1234567890');
  });

  it('signs the prepared SIWE message and posts the denied-login body unchanged', async () => {
    const signMessage = jest.fn().mockResolvedValue('0xrendered-siwe-signature');
    web3ProviderSpy.mockImplementation(() => ({
      getSigner: () => ({ signMessage }),
    }));
    mockBuildSiweMessage.mockReturnValue('rendered-byte-exact-siwe-message');
    global.fetch = jest.fn((url, init) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ nonce: 'rendered-nonce' }),
        });
      }
      if (String(url).endsWith('/auth/login')) {
        const submittedLogin = JSON.parse(init?.body || '{}');
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            error: `Denied ${submittedLogin.signature}; ${submittedLogin.message}`,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();
    await clickAndSettle(screen.getByRole('button', { name: 'Test' }));
    fireEvent.click(screen.getByTestId('ce-admin-denied-chip-login'));

    await waitFor(() => {
      expect(signMessage).toHaveBeenCalledWith('rendered-byte-exact-siwe-message');
    });
    const loginCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/auth/login'));
    expect(loginCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(loginCall[1].body)).toEqual({
      address: ADMIN_ADDRESS,
      message: 'rendered-byte-exact-siwe-message',
      signature: '0xrendered-siwe-signature',
      sessionSlug: 'edge',
    });
    expect(mockBuildSiweMessage).toHaveBeenCalledWith({
      address: ADMIN_ADDRESS,
      nonce: 'rendered-nonce',
      chainId: 84532,
      statement: 'Sign in to Context Engine.',
    });
    await waitFor(() => {
      expect(screen.getByText('OK (403 worker_auth_worker_login_failed)')).toBeInTheDocument();
    });
    expect(screen.queryByText(/0xrendered-siwe-signature|rendered-byte-exact-siwe-message/)).not.toBeInTheDocument();
  });

  it('does not render arbitrary wallet errors from the denied-login signing boundary', async () => {
    const providerCanary = 'passkey-provider-canary-never-render';
    const signMessage = jest
      .fn()
      .mockRejectedValue(new Error(`Provider echoed rendered-byte-exact-siwe-message and ${providerCanary}`));
    web3ProviderSpy.mockImplementation(() => ({
      getSigner: () => ({ signMessage }),
    }));
    mockBuildSiweMessage.mockReturnValue('rendered-byte-exact-siwe-message');

    await renderAdminPage();
    await waitForResolvedWorkerUrl();
    await clickAndSettle(screen.getByRole('button', { name: 'Test' }));
    fireEvent.click(screen.getByTestId('ce-admin-denied-chip-login'));

    expect(await screen.findByText('FAILED (Denied access test failed.)')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(providerCanary, 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(/rendered-byte-exact-siwe-message/)).not.toBeInTheDocument();
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
    sessionEntries = [
      [
        'edge',
        buildSessionConfig({
          sessionHeaderImg: 'https://broken.example.test/session-header.png',
        }),
      ],
    ];

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

  it('normalizes the session header image through the session media domain helper', async () => {
    const OriginalImage = global.Image;
    class LoadedImageMock {
      set src(_value) {
        setTimeout(() => {
          if (typeof this.onload === 'function') this.onload();
        }, 0);
      }
    }
    global.Image = LoadedImageMock;
    mockNormalizeSessionMediaUrl.mockReturnValue('https://media.example.test/session-header.png');
    sessionEntries = [
      [
        'edge',
        buildSessionConfig({
          sessionHeaderImg: ' ar://session_header_tx ',
        }),
      ],
    ];

    try {
      await renderAdminPage();
      await waitForResolvedWorkerUrl();

      await waitFor(() => {
        expect(screen.getByAltText('edge header')).toHaveAttribute(
          'src',
          'https://media.example.test/session-header.png',
        );
      });
      expect(mockNormalizeSessionMediaUrl).toHaveBeenCalledWith(' ar://session_header_tx ', {
        contextLabel: 'session_header_image',
      });
    } finally {
      global.Image = OriginalImage;
    }
  });

  it('warns non-admin wallets and disables admin-only actions', async () => {
    await renderAdminPage({
      account: '0x00000000000000000000000000000000000000bb',
    });

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_NOT_ADMIN_WARNING)).toHaveTextContent(
      'You are not the admin for this session; actions are disabled.',
    );
    expect(screen.queryByRole('button', { name: 'Save allowlist' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add recommended origins' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit worker URL' })).not.toBeInTheDocument();
    await openGatePanel();
    expect(screen.getByTestId(E2E_TESTIDS.ADMIN_GATE_UPDATE_BUTTON)).toBeDisabled();
  });

  it('retries registry loading with the default RPC path when the requested chain is still empty after bootstrap load', async () => {
    sessionEntries = [
      [
        'other-chain-session',
        buildSessionConfig({
          slug: 'other-chain-session',
          __registry: {
            registryChainId: 8453,
            chainId: 8453,
            adminAddress: ADMIN_ADDRESS,
          },
        }),
      ],
    ];

    await renderAdminPage({
      initialRegistryChainId: '84532',
    });

    await waitFor(() => {
      expect(mockLoadSessionRegistryCache).toHaveBeenCalledTimes(2);
    });

    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        chainIds: [84532],
        bootstrapRpc: true,
      }),
    );
    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        chainIds: [84532],
        bootstrapRpc: false,
      }),
    );
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
    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        bootstrapRpc: true,
      }),
    );
    expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        bootstrapRpc: false,
      }),
    );
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
      expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          bootstrapRpc: true,
        }),
      );
      expect(mockLoadSessionRegistryCache).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          bootstrapRpc: false,
        }),
      );
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

  it('round-trips requested registry refreshes through fetch, upsert, and store reads', async () => {
    sessionEntries = [];
    const requestedConfig = buildSessionConfig({
      slug: 'requested-edge',
      sessionName: 'Requested Edge Session',
    });
    mockFetchSessionFromRegistry.mockResolvedValue(requestedConfig);
    mockUpsertSessionRegistryCache.mockImplementation(({ config }) => {
      sessionEntries = [[config.slug, config]];
    });

    await renderAdminPage({
      initialSessionId: 'requested-edge',
      initialRegistryChainId: '84532',
    });

    await clickAndSettle(screen.getByRole('button', { name: 'Refresh sessions' }));

    await waitFor(() => {
      expect(mockFetchSessionFromRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 84532,
          slug: 'requested-edge',
          providerLike: null,
          account: '',
          lit: null,
          bootstrapRpc: true,
        }),
      );
      expect(mockUpsertSessionRegistryCache).toHaveBeenCalledWith({
        config: requestedConfig,
      });
      expect(screen.getByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('requested-edge');
    });
    expect(mockGetAllSessionEntries).toHaveBeenCalled();
  });

  it('subscribes and unsubscribes the registry cache update listener with the same callback', async () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    try {
      const { unmount } = await renderAdminPage();

      const addCall = addEventListenerSpy.mock.calls.find(
        ([eventName]) => eventName === SESSION_REGISTRY_CACHE_UPDATED_EVENT,
      );
      expect(addCall).toBeTruthy();

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(SESSION_REGISTRY_CACHE_UPDATED_EVENT, addCall[1]);
    } finally {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    }
  });

  it('preserves decrypted encrypted fields across equivalent registry cache refreshes', async () => {
    const { encryptedFieldsUtils } = require('../../utilities/crypto/encryptedFields.js');
    const firstEnvelope = {
      ciphertext: 'cipher-openai',
      metadata: {
        chainId: 84532,
        resource: 'admin',
      },
      recipients: [
        {
          type: 'lit',
          lit: {
            ciphertext: 'wrapped-key',
            chain: 'baseSepolia',
          },
        },
      ],
    };
    const clonedEnvelope = {
      recipients: [
        {
          lit: {
            chain: 'baseSepolia',
            ciphertext: 'wrapped-key',
          },
          type: 'lit',
        },
      ],
      metadata: {
        resource: 'admin',
        chainId: 84532,
      },
      ciphertext: 'cipher-openai',
    };
    encryptedFieldsUtils.resolveEncryptedValue.mockResolvedValue({
      value: 'admin-openai-secret',
      status: 'encrypted',
      encryptedAvailable: true,
    });
    sessionEntries = [
      [
        'edge',
        buildSessionConfig({
          encryptedFields: {
            'ai.providers.openai.apiKey': firstEnvelope,
          },
        }),
      ],
    ];

    await renderAdminPage();

    const decryptButton = (await screen.findAllByRole('button', { name: 'Decrypt' })).find(
      (button) => button.getAttribute('title') === 'Decrypt fields (wallet signature prompts)',
    );
    expect(decryptButton).toBeTruthy();
    fireEvent.click(decryptButton);

    expect(await screen.findByText('admin-openai-secret')).toBeInTheDocument();
    expect(encryptedFieldsUtils.resolveEncryptedValue).toHaveBeenCalledTimes(1);

    sessionEntries = [
      [
        'edge',
        buildSessionConfig({
          encryptedFields: {
            'ai.providers.openai.apiKey': clonedEnvelope,
          },
        }),
      ],
    ];
    act(() => {
      window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByText('admin-openai-secret')).toBeInTheDocument();
    });
    expect(encryptedFieldsUtils.resolveEncryptedValue).toHaveBeenCalledTimes(1);
  });
});
