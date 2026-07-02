import React, { act } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_REGISTRY_CACHE_UPDATED_EVENT = 'ce:session-registry-cache-updated';

type Deferred<T = any> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
};

const buildSessionConfig = (overrides: Record<string, any> = {}) => ({
  slug: 'edge',
  sessionName: 'Edge Session',
  corsWorkerUrl: 'https://worker.example.test',
  networkChainId: 84532,
  __registry: {
    registryChainId: 84532,
    chainId: 84532,
    adminAddress: ADMIN_ADDRESS,
    sessionIdHex: '0xedge-session-id',
    ...(overrides.__registry || {}),
  },
  ...overrides,
});

const mockResolveCorsProxyUrl = jest.fn();
const mockLoadSessionRegistryCache = jest.fn();
const mockGetAllSessionEntries = jest.fn();
const mockFetchSessionFromRegistry = jest.fn();
const mockUpsertSessionRegistryCache = jest.fn();
const mockGetUsableSessionWorkerUrl = jest.fn();
const mockHasUsableSessionWorkerConfig = jest.fn();
const mockEncryptWithPassword = jest.fn();
const mockUploadDataToArweave = jest.fn();
const mockBuildSignedBootstrapAdminAuth = jest.fn();
const mockBuildSignedAdminActionAuth = jest.fn();
const mockNormalizeWorkerUrl = jest.fn((url = '') => {
  const raw = String(url || '').trim();
  if (!raw || raw.startsWith('/')) return '';
  const ensured = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(ensured);
    const path = parsed.pathname.replace(/\/+$/, '');
    const suffixes = ['/auth/nonce', '/auth/login', '/arweave/upload'];
    const stripped = suffixes.reduce((current, suffix) => (
      current.toLowerCase().endsWith(suffix) ? current.slice(0, -suffix.length) : current
    ), path);
    return stripped && stripped !== '/' ? `${parsed.origin}${stripped}` : parsed.origin;
  } catch {
    return '';
  }
});
const mockNormalizeSessionIdHex = jest.fn((value = '') => (
  String(value || '').trim() === 'edge-session-id' ? '0xedge-session-id' : ''
));

jest.mock('../../utilities/worker/corsProxy.js', () => ({
  corsProxyUtils: {
    resolveCorsProxyUrl: (...args: any[]) => mockResolveCorsProxyUrl(...args),
  },
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  normalizeWorkerUrl: (...args: any[]) => mockNormalizeWorkerUrl(...args),
  buildSignedBootstrapAdminAuth: (...args: any[]) => mockBuildSignedBootstrapAdminAuth(...args),
  buildSignedAdminActionAuth: (...args: any[]) => mockBuildSignedAdminActionAuth(...args),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    encryptWithPassword: (...args: any[]) => mockEncryptWithPassword(...args),
  },
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    uploadDataToArweave: (...args: any[]) => mockUploadDataToArweave(...args),
    downloadDataFromArweave: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  fetchSessionFromRegistry: (...args: any[]) => mockFetchSessionFromRegistry(...args),
  loadSessionRegistryCache: (...args: any[]) => mockLoadSessionRegistryCache(...args),
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  sessionRegistryStore: {
    getAllSessionEntries: (...args: any[]) => mockGetAllSessionEntries(...args),
  },
  sessionRegistryUtils: {
    fetchSessionFromRegistry: (...args: any[]) => mockFetchSessionFromRegistry(...args),
    normalizeSessionIdHex: (...args: any[]) => mockNormalizeSessionIdHex(...args),
    upsertSessionRegistryCache: (...args: any[]) => mockUpsertSessionRegistryCache(...args),
  },
  upsertSessionRegistryCache: (...args: any[]) => mockUpsertSessionRegistryCache(...args),
}));

jest.mock('../../utilities/session/sessionWorkerAvailability.js', () => ({
  getUsableSessionWorkerUrl: (...args: any[]) => mockGetUsableSessionWorkerUrl(...args),
  hasUsableSessionWorkerConfig: (...args: any[]) => mockHasUsableSessionWorkerConfig(...args),
}));

jest.mock('../../utilities/ui/notify.js', () => ({
  notify: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const SponsorPage = require('./SponsorPage').default as React.ComponentType<any>;
const getFetchMock = () => global.fetch as jest.Mock;

const renderSponsorPage = async ({
  account = ADMIN_ADDRESS,
  initialSessionId,
  initialRegistryChainId,
}: {
  account?: string;
  initialSessionId?: string;
  initialRegistryChainId?: string;
} = {}) => {
  let utils: any;
  await act(async () => {
    utils = render(
      <SponsorPage
        account={account}
        provider={{}}
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

const getFieldInputByLabel = (labelText: string): HTMLElement => {
  const input = screen.getByText(labelText).parentElement?.querySelector('input,textarea,select');
  if (!input) throw new Error(`Missing input for label: ${labelText}`);
  return input as HTMLElement;
};
const getToggleCheckbox = (labelText: string): HTMLInputElement => {
  const checkbox = screen.getByText(labelText).closest('label')?.querySelector('input[type="checkbox"]');
  if (!checkbox) throw new Error(`Missing checkbox for label: ${labelText}`);
  return checkbox as HTMLInputElement;
};
const createDeferred = <T = any>(): Deferred<T> => {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('SponsorPage', () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  let sessionEntries: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    global.fetch = jest.fn((url: any): Promise<any> => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : String(url).endsWith('/admin/issue-sponsored-grants')
          ? {
              ok: true,
              json: async () => ({
                ok: true,
                deployGrantToken: 'deploy-grant-token',
                faucetGrantToken: '',
                bootstrapWorkerUrl: 'https://worker.example.test',
              }),
            }
        : { ok: true, json: async () => ({ ok: true }) }
    )) as any;
    sessionEntries = [['edge', buildSessionConfig()]];
    mockLoadSessionRegistryCache.mockResolvedValue(undefined);
    mockGetAllSessionEntries.mockImplementation(() => sessionEntries);
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: 'https://worker.example.test',
      source: 'session-config',
      status: 'ok',
    });
    mockGetUsableSessionWorkerUrl.mockReturnValue('https://worker.example.test');
    mockHasUsableSessionWorkerConfig.mockReturnValue(true);
    mockFetchSessionFromRegistry.mockResolvedValue(buildSessionConfig());
    mockEncryptWithPassword.mockResolvedValue('encrypted-base64');
    mockUploadDataToArweave.mockResolvedValue('sponsor_tx_id');
    mockBuildSignedBootstrapAdminAuth.mockResolvedValue({
      address: ADMIN_ADDRESS,
      message: 'bootstrap-siwe-message',
      signature: '0xbootstrap-admin-auth',
      sessionSlug: 'edge',
    });
    mockBuildSignedAdminActionAuth.mockResolvedValue({
      address: ADMIN_ADDRESS,
      signature: '0xadmin-action-signature',
      action: 'issue-sponsored-grants',
      slug: 'edge',
      bodyHash: '0xadmin-body-hash',
      nonce: 'sponsor-admin-nonce',
      audience: 'http://localhost',
      expiration: 4102444800,
    });
    if (!global.crypto) (global as any).crypto = {};
    (global.crypto as any).getRandomValues = jest.fn((buffer: any) => {
      for (let i = 0; i < buffer.length; i += 1) buffer[i] = i + 1;
      return buffer;
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.crypto = originalCrypto;
  });

  it('renders paste-first credential inputs and lets the admin unlock the worker URL for editing', async () => {
    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    expect(screen.queryByDisplayValue('https://worker.example.test')).not.toBeInTheDocument();

    expect(getFieldInputByLabel('Label')).toBeInTheDocument();
    expect(getFieldInputByLabel('OpenAI key')).toBeInTheDocument();
    expect(getFieldInputByLabel('Anthropic key')).toBeInTheDocument();
    expect(getFieldInputByLabel('OpenRouter key')).toBeInTheDocument();
    expect(getFieldInputByLabel('Arweave JWK')).toBeInTheDocument();
    expect(getFieldInputByLabel('Faucet private key')).toBeInTheDocument();
    expect(getFieldInputByLabel('Custom RPC URL')).toBeInTheDocument();
    expect(getFieldInputByLabel('Lit API base')).toBeInTheDocument();
    expect(getFieldInputByLabel('Lit group ID')).toBeInTheDocument();
    expect(getFieldInputByLabel('Lit PKP ID')).toBeInTheDocument();
    expect(getFieldInputByLabel('Lit Action CID')).toBeInTheDocument();
    expect(getFieldInputByLabel('Lit account API key')).toBeInTheDocument();
    expect(getFieldInputByLabel('Lit usage API key')).toBeInTheDocument();
    expect(getFieldInputByLabel('Cloudflare API token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('No expiry')).toBeInTheDocument();
    expect(screen.getByTestId('ce-sponsor-expiry-input')).toHaveAttribute('min', expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/));
    expect(screen.getByText('Issue one-time deploy grants through the selected sponsoring session worker instead of writing raw deploy credentials into the bundle.')).toBeInTheDocument();
    expect(screen.getByText('Uses sponsoring worker: https://worker.example.test')).toBeInTheDocument();
    expect(getToggleCheckbox('Remember non-secret draft fields')).toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.SPONSOR_WORKER_URL_TOGGLE)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SPONSOR_CREATE)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit upload worker URL' }));
    const workerInput = await screen.findByDisplayValue('https://worker.example.test');
    expect(screen.getByTestId(E2E_TESTIDS.SPONSOR_WORKER_URL)).toBe(workerInput);
    expect(workerInput).toHaveProperty('readOnly', false);

    fireEvent.change(workerInput, { target: { value: 'https://edited.example.test' } });
    expect(screen.getByDisplayValue('https://edited.example.test')).toBeInTheDocument();
  });

  it('preselects the requested session using sessionId and chainId props', async () => {
    sessionEntries = [
      ['other', buildSessionConfig({
        slug: 'other',
        sessionName: 'Other Session',
        __registry: { sessionIdHex: '0xother-session-id' },
      })],
      ['edge', buildSessionConfig()],
    ];

    await renderSponsorPage({
      initialSessionId: 'edge-session-id',
      initialRegistryChainId: 'chain-84532',
    });

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    });
  });

  it('fetches a requested registry session that is missing from the local cache and selects it', async () => {
    const otherConfig = buildSessionConfig({
      slug: 'other',
      sessionName: 'Other Session',
      __registry: { sessionIdHex: '0xother-session-id' },
    });
    const fetchedConfig = buildSessionConfig({
      sessionName: 'Fetched Edge Session',
    });
    sessionEntries = [['other', otherConfig]];
    mockFetchSessionFromRegistry.mockResolvedValueOnce(fetchedConfig);
    mockUpsertSessionRegistryCache.mockImplementationOnce(({ config }: any) => {
      sessionEntries = [
        ['other', otherConfig],
        ['edge', config],
      ];
    });

    await renderSponsorPage({
      initialSessionId: 'edge-session-id',
      initialRegistryChainId: 'chain-84532',
    });

    await waitFor(() => {
      expect(mockFetchSessionFromRegistry).toHaveBeenCalledWith(expect.objectContaining({
        chainId: 84532,
        sessionId: '0xedge-session-id',
        slug: '',
        bootstrapRpc: true,
      }));
    });
    expect(mockUpsertSessionRegistryCache).toHaveBeenCalledWith({ config: fetchedConfig });
    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    });
    expect(screen.getByRole('option', { name: 'Fetched Edge Session' })).toBeInTheDocument();
  });

  it('ignores late mount-time session loads after the page unmounts', async () => {
    const deferredRegistryLoad = createDeferred();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLoadSessionRegistryCache.mockReturnValueOnce(deferredRegistryLoad.promise);

    try {
      const view = await renderSponsorPage();

      expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');

      view.unmount();
      sessionEntries = [
        ['edge', buildSessionConfig()],
        ['late', buildSessionConfig({
          slug: 'late',
          sessionName: 'Late Session',
          __registry: { sessionIdHex: '0xlate-session-id' },
        })],
      ];

      await act(async () => {
        deferredRegistryLoad.resolve({ __loadMeta: { hadLoadErrors: false } });
        await deferredRegistryLoad.promise;
      });

      expect(consoleErrorSpy.mock.calls.flat().join('\n')).not.toContain(
        "Can't perform a React state update on an unmounted component"
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('uploads an encrypted sponsored bundle and renders a share URL with tx query plus hash key', async () => {
    getFetchMock().mockImplementation((url: any) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : String(url).endsWith('/admin/issue-sponsored-grants')
          ? {
              ok: true,
              json: async () => ({
                ok: true,
                deployGrantToken: 'deploy-grant-token',
                faucetGrantToken: 'faucet-grant-token',
                bootstrapWorkerUrl: 'https://worker.example.test',
              }),
            }
          : { ok: true, json: async () => ({ ok: true }) }
    ));
    await renderSponsorPage();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });
    fireEvent.change(getFieldInputByLabel('Arweave JWK'), {
      target: { value: '{"kty":"RSA"}' },
    });
    fireEvent.change(getFieldInputByLabel('Faucet private key'), {
      target: { value: '0xsponsoredfaucet' },
    });
    fireEvent.change(getFieldInputByLabel('Custom RPC URL'), {
      target: { value: 'https://rpc.example.test' },
    });
    fireEvent.change(getFieldInputByLabel('Lit API base'), {
      target: { value: 'https://api.chipotle.litprotocol.com' },
    });
    fireEvent.change(getFieldInputByLabel('Lit group ID'), {
      target: { value: 'group_123' },
    });
    fireEvent.change(getFieldInputByLabel('Lit PKP ID'), {
      target: { value: 'pkp_123' },
    });
    fireEvent.change(getFieldInputByLabel('Lit Action CID'), {
      target: { value: 'bafy123' },
    });
    fireEvent.change(getFieldInputByLabel('Lit account API key'), {
      target: { value: 'lit-account-secret' },
    });
    fireEvent.change(getFieldInputByLabel('Lit usage API key'), {
      target: { value: 'lit-secret' },
    });
    fireEvent.change(getFieldInputByLabel('Cloudflare API token'), {
      target: { value: 'cf-live-token' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(mockEncryptWithPassword).toHaveBeenCalledTimes(1);
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    });

    const [envelope] = mockUploadDataToArweave.mock.calls[0];
    expect(envelope).toEqual(expect.objectContaining({
      type: 'contextengine-sponsored-bundle',
      version: 1,
      cipher: 'password-aes-gcm',
      encryptedData: 'encrypted-base64',
    }));
    expect(JSON.stringify(envelope)).not.toContain('sk-live-openai');
    expect(JSON.stringify(envelope)).not.toContain('https://rpc.example.test');
    expect(JSON.stringify(envelope)).not.toContain('cf-live-token');
    expect(JSON.stringify(envelope)).not.toContain('0xsponsoredfaucet');
    expect(mockEncryptWithPassword).toHaveBeenCalledWith(expect.objectContaining({
      openaiKey: 'sk-live-openai',
      arweaveJwk: '{"kty":"RSA"}',
      faucetPrivateKey: '0xsponsoredfaucet',
      customRpcUrl: 'https://rpc.example.test',
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
      litAccountApiKey: 'lit-account-secret',
      litUsageApiKey: 'lit-secret',
      bootstrapWorkerUrl: 'https://worker.example.test',
      deployGrantToken: 'deploy-grant-token',
      faucetGrantToken: 'faucet-grant-token',
      meta: expect.objectContaining({
        sourceSessionSlug: 'edge',
        sourceWorkerUrl: 'https://worker.example.test',
      }),
    }), expect.any(String));
    expect(mockEncryptWithPassword.mock.calls[0][0]).not.toHaveProperty('cloudflareApiToken');
    const grantCall = getFetchMock().mock.calls.find(([url]: any[]) => String(url).endsWith('/admin/issue-sponsored-grants'));
    expect(grantCall).toBeTruthy();
    expect(JSON.parse(grantCall[1].body)).toEqual(expect.objectContaining({
      sessionSlug: 'edge',
      grantRequest: {
        bootstrapWorkerUrl: 'https://worker.example.test',
        deploy: {
          cloudflareApiToken: 'cf-live-token',
        },
        faucet: {
          faucetPrivateKey: '0xsponsoredfaucet',
        },
      },
      action: 'issue-sponsored-grants',
      slug: 'edge',
    }));
    expect(mockBuildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
      action: 'issue-sponsored-grants',
      slug: 'edge',
      workerUrl: 'https://worker.example.test',
      body: expect.objectContaining({
        sessionSlug: 'edge',
        grantRequest: expect.objectContaining({
          bootstrapWorkerUrl: 'https://worker.example.test',
          deploy: expect.objectContaining({
            cloudflareApiToken: 'cf-live-token',
          }),
          faucet: expect.objectContaining({
            faucetPrivateKey: '0xsponsoredfaucet',
          }),
        }),
      }),
      context: expect.objectContaining({
        account: ADMIN_ADDRESS,
        chainId: 84532,
      }),
    }));
    expect(mockUploadDataToArweave.mock.calls[0][2]).toEqual(expect.objectContaining({
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: 'https://worker.example.test',
      skipAuth: true,
      adminAuth: expect.objectContaining({
        address: ADMIN_ADDRESS,
        message: 'bootstrap-siwe-message',
        signature: '0xbootstrap-admin-auth',
        sessionSlug: 'edge',
      }),
    }));
    expect(mockBuildSignedBootstrapAdminAuth).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'edge',
      workerUrl: 'https://worker.example.test',
      statement: 'Admin request: bootstrap arweave upload',
      context: expect.objectContaining({
        account: ADMIN_ADDRESS,
        chainId: 84532,
      }),
    }));

    const shareInput = await screen.findByLabelText('Sponsored share URL') as HTMLInputElement;
    expect(screen.getByTestId(E2E_TESTIDS.SPONSOR_SHARE_URL)).toBe(shareInput);
    expect(shareInput.value).toMatch(/^http:\/\/localhost\/new\?sponsored=sponsor_tx_id#k=/);
    expect(shareInput.value).toContain('?sponsored=sponsor_tx_id#k=');
    const txRow = await screen.findByTestId(E2E_TESTIDS.SPONSOR_TX_ID);
    expect(txRow).toHaveTextContent('Arweave tx:');
    expect(within(txRow).getByRole('link', { name: 'sponsor_tx_id' })).toHaveAttribute(
      'href',
      'https://ar-io.dev/sponsor_tx_id', // intentional: real URL - verifies sponsor tx gateway link
    );
  });

  it('issues sponsored deploy grants with only the Cloudflare API token', async () => {
    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Grant without account id' },
    });
    fireEvent.change(getFieldInputByLabel('Cloudflare API token'), {
      target: { value: 'cf-live-token' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(mockBuildSignedAdminActionAuth).toHaveBeenCalled();
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByLabelText('Sponsored share URL')).toBeInTheDocument();
    const grantCall = getFetchMock().mock.calls.find(([url]: any[]) => String(url).endsWith('/admin/issue-sponsored-grants'));
    expect(grantCall).toBeTruthy();
    expect(JSON.parse(grantCall[1].body)).toEqual(expect.objectContaining({
      grantRequest: expect.objectContaining({
        deploy: {
          cloudflareApiToken: 'cf-live-token',
        },
      }),
    }));
  });

  it('does not apply stale create completions after the selected session changes', async () => {
    sessionEntries = [
      ['edge', buildSessionConfig()],
      ['other', buildSessionConfig({
        slug: 'other',
        sessionName: 'Other Session',
        __registry: {
          sessionIdHex: '0xother-session-id',
          adminAddress: ADMIN_ADDRESS,
          registryChainId: 84532,
          chainId: 84532,
        },
      })],
    ];
    const uploadDeferred = createDeferred<string>();
    mockUploadDataToArweave.mockReturnValueOnce(uploadDeferred.promise);

    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT), {
      target: { value: 'other' },
    });

    await act(async () => {
      uploadDeferred.resolve('stale_sponsor_tx_id');
      await uploadDeferred.promise;
      await Promise.resolve();
    });

    expect(screen.queryByText('Sponsored URL ready.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sponsored share URL')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('other');
  });

  it('does not apply stale create completions after the selected session config refreshes in place', async () => {
    const uploadDeferred = createDeferred<string>();
    mockUploadDataToArweave.mockReturnValueOnce(uploadDeferred.promise);

    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    });

    sessionEntries = [[
      'edge',
      buildSessionConfig({
        sessionName: 'Edge Session Refresh',
        __registry: {
          sessionIdHex: '0xedge-session-id-refreshed',
        },
      }),
    ]];
    await act(async () => {
      window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      uploadDeferred.resolve('stale_sponsor_tx_id');
      await uploadDeferred.promise;
      await Promise.resolve();
    });

    expect(screen.queryByText('Sponsored URL ready.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sponsored share URL')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
  });

  it('persists only non-secret sponsor draft fields across remounts', async () => {
    const view = await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    expect(getToggleCheckbox('Remember non-secret draft fields')).toBeChecked();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Repeatable sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-repeat-openai' },
    });
    fireEvent.change(getFieldInputByLabel('Cloudflare API token'), {
      target: { value: 'cf-repeat-token' },
    });

    const cached = JSON.parse(localStorage.getItem('ce:sponsorPageDraft:v1') || '{}');
    expect(cached).toEqual(expect.objectContaining({
      persistBundleDraft: true,
      persistBundleSecrets: false,
      bundleForm: expect.objectContaining({
        label: 'Repeatable sponsor bundle',
      }),
    }));
    expect(JSON.stringify(cached)).not.toContain('sk-repeat-openai');
    expect(JSON.stringify(cached)).not.toContain('cf-repeat-token');

    view.unmount();
    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    expect(getToggleCheckbox('Remember non-secret draft fields')).toBeChecked();
    expect(getFieldInputByLabel('Label')).toHaveValue('Repeatable sponsor bundle');
    expect(getFieldInputByLabel('OpenAI key')).toHaveValue('');
    expect(getFieldInputByLabel('Cloudflare API token')).toHaveValue('');
  });

  it('redacts legacy sponsor draft caches that contain raw secrets', async () => {
    localStorage.setItem('ce:sponsorPageDraft:v1', JSON.stringify({
      v: 1,
      persistBundleSecrets: true,
      bundleForm: {
        label: 'Legacy cached bundle',
        openaiKey: 'sk-legacy-openai',
        cloudflareApiToken: 'cf-legacy-token',
        customRpcUrl: 'https://rpc.example.test/secret',
        arweaveJwk: '{"kty":"RSA","d":"secret"}',
        faucetPrivateKey: '0xlegacyfaucet',
      },
    }));

    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    expect(getFieldInputByLabel('Label')).toHaveValue('Legacy cached bundle');
    expect(getFieldInputByLabel('OpenAI key')).toHaveValue('');
    expect(getFieldInputByLabel('Cloudflare API token')).toHaveValue('');
    expect(getFieldInputByLabel('Custom RPC URL')).toHaveValue('');
    const cached = JSON.parse(localStorage.getItem('ce:sponsorPageDraft:v1') || '{}');
    expect(JSON.stringify(cached)).not.toContain('sk-legacy-openai');
    expect(JSON.stringify(cached)).not.toContain('cf-legacy-token');
    expect(JSON.stringify(cached)).not.toContain('0xlegacyfaucet');
  });

  it('does not persist sponsor draft fields when draft persistence is disabled', async () => {
    const view = await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');

    fireEvent.click(getToggleCheckbox('Remember non-secret draft fields'));
    expect(getToggleCheckbox('Remember non-secret draft fields')).not.toBeChecked();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Do not cache me' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-do-not-cache' },
    });

    view.unmount();
    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    expect(getToggleCheckbox('Remember non-secret draft fields')).not.toBeChecked();
    expect(getFieldInputByLabel('Label')).toHaveValue('');
    expect(getFieldInputByLabel('OpenAI key')).toHaveValue('');
  });

  it('surfaces when the sponsoring worker cannot issue deploy grants and avoids uploading a bundle', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        embeddedDeployHelperEnabled: false,
      }),
    ]];
    mockFetchSessionFromRegistry.mockResolvedValue(sessionEntries[0][1]);
    global.fetch = jest.fn((url: any): Promise<any> => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : String(url).endsWith('/admin/issue-sponsored-grants')
          ? {
              ok: false,
              status: 400,
              json: async () => ({
                error: 'Deploy grants require embedded deploy-helper to be enabled on the sponsoring worker.',
              }),
            }
          : { ok: true, json: async () => ({ ok: true }) }
    )) as any;

    await renderSponsorPage();

    expect(await screen.findByText(
      'Deploy grants are unavailable until embedded deploy-helper is enabled on the sponsoring session worker.'
    )).toBeInTheDocument();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Grant blocked by source worker config' },
    });
    fireEvent.change(getFieldInputByLabel('Cloudflare API token'), {
      target: { value: 'cf-live-token' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    expect(await screen.findByText(
      'Deploy grants require embedded deploy-helper to be enabled on the sponsoring worker.'
    )).toBeInTheDocument();
    expect(mockUploadDataToArweave).not.toHaveBeenCalled();
  });

  it('turns sponsor grant fetch failures into an allowOrigins-focused hint', async () => {
    global.fetch = jest.fn((url: any): Promise<any> => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) });
      }
      if (String(url).endsWith('/admin/issue-sponsored-grants')) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }) as any;

    await renderSponsorPage();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Origin blocked sponsor flow' },
    });
    fireEvent.change(getFieldInputByLabel('Cloudflare API token'), {
      target: { value: 'cf-live-token' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.SPONSOR_STATUS)).toHaveTextContent(
        "Sponsored grant request could not reach https://worker.example.test. This is usually CORS or worker availability; ensure http://localhost is in that worker session's allowOrigins and retry."
      );
    });
    expect(mockUploadDataToArweave).not.toHaveBeenCalled();
  });

  it('clears the previous share URL and tx id when a regeneration attempt fails', async () => {
    await renderSponsorPage();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    expect(await screen.findByLabelText('Sponsored share URL')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'sponsor_tx_id' })).toHaveAttribute(
      'href',
      'https://ar-io.dev/sponsor_tx_id', // intentional: real URL - verifies sponsor tx gateway link
    );

    mockUploadDataToArweave.mockRejectedValueOnce(new Error('Upload failed'));

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Sponsored share URL')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'sponsor_tx_id' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Upload failed')).toBeInTheDocument();
  });

  it('allows uploads with a manual worker URL override when the session worker config is unusable', async () => {
    mockGetUsableSessionWorkerUrl.mockReturnValue('');
    mockHasUsableSessionWorkerConfig.mockReturnValue(false);
    mockResolveCorsProxyUrl.mockRejectedValueOnce(new Error('worker unavailable'));

    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');

    const createButton = screen.getByRole('button', { name: 'Create sponsored URL' });
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit upload worker URL' }));
    const workerInput = screen.getByPlaceholderText(/worker-name.*account-subdomain/i);
    fireEvent.change(workerInput, {
      target: { value: 'https://manual.example.test' },
    });

    expect(createButton).not.toBeDisabled();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });

    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    });

    expect(mockBuildSignedBootstrapAdminAuth).toHaveBeenCalledWith(expect.objectContaining({
      workerUrl: 'https://manual.example.test',
    }));
    expect(mockUploadDataToArweave.mock.calls[0][2]).toEqual(expect.objectContaining({
      workerUrl: 'https://manual.example.test',
    }));
  });

  it('normalizes pasted worker endpoint URLs before signing grant and upload requests', async () => {
    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    fireEvent.click(screen.getByRole('button', { name: 'Edit upload worker URL' }));

    const workerInput = await screen.findByDisplayValue('https://worker.example.test');
    fireEvent.change(workerInput, {
      target: { value: 'https://manual.example.test/auth/login' },
    });
    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Normalized endpoint worker url' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });
    fireEvent.change(getFieldInputByLabel('Cloudflare API token'), {
      target: { value: 'cf-live-token' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(mockBuildSignedAdminActionAuth).toHaveBeenCalled();
      expect(mockBuildSignedBootstrapAdminAuth).toHaveBeenCalled();
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    });

    expect(mockBuildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
      workerUrl: 'https://manual.example.test',
    }));
    expect(mockBuildSignedBootstrapAdminAuth).toHaveBeenCalledWith(expect.objectContaining({
      workerUrl: 'https://manual.example.test',
    }));
    expect(getFetchMock()).toHaveBeenCalledWith(
      'https://manual.example.test/admin/issue-sponsored-grants',
      expect.anything()
    );
    expect(JSON.parse(getFetchMock().mock.calls.find(
      ([url]: any[]) => String(url) === 'https://manual.example.test/admin/issue-sponsored-grants'
    )[1].body)).toEqual(expect.objectContaining({
      grantRequest: expect.objectContaining({
        bootstrapWorkerUrl: 'https://manual.example.test',
      }),
    }));
    expect(mockUploadDataToArweave.mock.calls[0][2]).toEqual(expect.objectContaining({
      workerUrl: 'https://manual.example.test',
    }));
  });

  it('keeps a manual worker URL override when async worker resolution finishes later', async () => {
    const deferredWorkerUrl = createDeferred();
    mockResolveCorsProxyUrl.mockReturnValueOnce(deferredWorkerUrl.promise);

    await renderSponsorPage();

    expect(await screen.findByTestId(E2E_TESTIDS.ADMIN_SESSION_SELECT)).toHaveValue('edge');
    fireEvent.click(screen.getByRole('button', { name: 'Edit upload worker URL' }));

    const workerInput = await screen.findByDisplayValue('https://worker.example.test');
    fireEvent.change(workerInput, {
      target: { value: 'https://manual.example.test' },
    });

    await waitFor(() => {
      expect(mockResolveCorsProxyUrl).toHaveBeenCalled();
    });
    await act(async () => {
      deferredWorkerUrl.resolve({
        url: 'https://resolved.example.test',
        source: 'session-config',
        status: 'ok',
      });
      await deferredWorkerUrl.promise;
    });

    expect(screen.getByDisplayValue('https://manual.example.test')).toBeInTheDocument();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    await waitFor(() => {
      expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    });

    expect(mockUploadDataToArweave.mock.calls[0][2]).toEqual(expect.objectContaining({
      workerUrl: 'https://manual.example.test',
    }));
  });

  it('makes the current direct-admin-only limitation explicit instead of implying a bad wallet selection', async () => {
    sessionEntries = [[
      'edge',
      buildSessionConfig({
        __registry: {
          adminAddress: '',
          hatsAddress: '0x00000000000000000000000000000000000000bb',
          adminHatId: '7',
        },
      }),
    ]];

    await renderSponsorPage();

    expect(await screen.findByText(
      'Sponsor uploads currently require a session with a direct `adminAddress`.'
    )).toBeInTheDocument();
    expect(screen.queryByText(/Hats-admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Connected wallet is not the admin for the selected session.')).not.toBeInTheDocument();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    expect(await screen.findByText('Sponsored uploads currently require a session with a direct adminAddress.')).toBeInTheDocument();
    expect(getFetchMock()).not.toHaveBeenCalled();
    expect(mockUploadDataToArweave).not.toHaveBeenCalled();
  });

  it('rejects sponsored URL creation when no supported credentials are provided', async () => {
    await renderSponsorPage();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Metadata only bundle' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    expect(await screen.findByText('Add at least one sponsored credential before creating a URL.')).toBeInTheDocument();
    expect(mockBuildSignedBootstrapAdminAuth).not.toHaveBeenCalled();
    expect(mockEncryptWithPassword).not.toHaveBeenCalled();
    expect(mockUploadDataToArweave).not.toHaveBeenCalled();
  });

  it('shows an error when the selected expiry is in the past', async () => {
    await renderSponsorPage();

    fireEvent.change(getFieldInputByLabel('Label'), {
      target: { value: 'Launch week sponsor bundle' },
    });
    fireEvent.change(getFieldInputByLabel('OpenAI key'), {
      target: { value: 'sk-live-openai' },
    });
    fireEvent.change(screen.getByTestId('ce-sponsor-expiry-input'), {
      target: { value: '2000-01-01T00:00' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create sponsored URL' }));

    expect(await screen.findByText('Expiry must be in the future.')).toBeInTheDocument();
    expect(mockUploadDataToArweave).not.toHaveBeenCalled();
  });
});
