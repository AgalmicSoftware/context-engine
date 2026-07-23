import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';

const mockTestAdminAddress = '0x00000000000000000000000000000000000000aa';
const TEST_ADMIN_ADDRESS = mockTestAdminAddress;
const mockSelectorSourceFactory = '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA';
const mockSelectorSourceStartBlock = 30297069;
const mockDownloadDataFromArweave = jest.fn();
const mockDecryptWithPassword = jest.fn();
const createDefaultFetchMock = () =>
  jest.fn(async (url: any, _options?: any): Promise<any> => {
    const normalizedUrl = String(url);
    if (
      normalizedUrl === 'test-file-stub' ||
      normalizedUrl.includes('sessionCorsWorker') ||
      normalizedUrl.endsWith('.txt')
    ) {
      return {
        ok: true,
        text: async (): Promise<string> => 'export default { fetch() { return new Response("ok"); } };',
        headers: { get: jest.fn(() => 'application/javascript') },
      };
    }
    return {
      ok: true,
      json: async () => ({ ok: true }),
      text: async (): Promise<string> => '',
      headers: { get: jest.fn(() => 'application/json') },
    };
  });
const buildMockSponsoredBundleEnvelope = () =>
  JSON.stringify({
    type: 'contextengine-sponsored-bundle',
    version: 1,
    cipher: 'password-aes-gcm',
    encryptedData: 'encrypted-base64',
  });
const buildMockSponsoredBundle = () => ({
  openaiKey: 'sponsored-openai',
  arweaveJwk: '{"kty":"RSA","n":"sponsored"}',
  litAccountApiKey: 'sponsored-lit-account-key',
  faucetGrantToken: 'sponsored-faucet-grant',
  customRpcUrl: 'https://sponsored-rpc.example.test',
  deployGrantToken: 'sponsored-deploy-grant',
  meta: {
    label: 'Launch Week',
    createdAt: '2099-03-20T12:00:00.000Z',
    createdBy: '0xadmin',
    expiresAt: '2099-03-21T12:00:00.000Z',
    sourceSessionSlug: 'source-session',
    sourceWorkerUrl: 'https://source-worker.example.test',
  },
});

const selectDecentralizedProfile = async () => {
  const preset = screen.getByTestId('ce-new-preset-trustless_public_decentralized');
  const originalConfirm = window.confirm;
  window.confirm = jest.fn(() => true);
  try {
    fireEvent.click(preset);
  } finally {
    window.confirm = originalConfirm;
  }
  await waitFor(() => {
    expect(preset).toHaveAttribute('aria-checked', 'true');
  });
};

jest.mock('../SBTs/SBTSelector', () => () => <div data-testid="mock-wizard-sbt-selector" />);
jest.mock('../SBTs/CreateSBTGroup', () => () => null);
jest.mock('../Gates/GateMultiSelectLock', () => () => <div data-testid="mock-wizard-gate-lock" />);
jest.mock('../Shared/Json/JsonControls', () => ({
  JsonToggleButton: () => null,
  JsonPanel: () => null,
  JsonButtonRow: () => null,
}));
jest.mock('../ContractPage/contractViewerUtils.js', () => ({
  buildContractViewerContracts: jest.fn(),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: jest.fn(() => []),
  createLitHooks: jest.fn(() => ({ saveKey: jest.fn(), getKey: jest.fn(), litNetwork: 'chipotle' })),
  resolveLitChain: jest.fn(() => 'baseSepolia'),
  getGlobalLitHooks: jest.fn(() => null),
  setGlobalLitHooks: jest.fn(),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => ({})),
    decryptWithPassword: (...args: any[]) => mockDecryptWithPassword(...args),
  },
}));

jest.mock('../../utilities/arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: (...args: any[]) => mockDownloadDataFromArweave(...args),
    buildArweaveGatewayUrl: jest.fn((txId) => `https://arweave.example.test/${txId}`),
  },
}));

jest.mock('../../utilities/session/resourceKeys.js', () => ({
  getEffectiveArweaveKey: jest.fn(() => ''),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  registerSessionOnChain: jest.fn(),
  sessionRegistryUtils: {
    normalizeSlug: jest.fn((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
    formatSessionId: jest.fn((value = '') => String(value || '').trim()),
    normalizeSessionIdHex: jest.fn((value = '') => String(value || '').trim()),
    toRegistrySlug: jest.fn((value = '') => String(value || '').trim()),
    getRegistryContract: jest.fn(() => ({
      sessionExists: jest.fn(async () => false),
    })),
    fetchSessionFromRegistry: jest.fn(async () => null),
    upsertSessionRegistryCache: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {},
  getSessionConfigBySlugOrDefault: jest.fn((slug = '') => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    if (normalized && normalized !== 'general') return null;
    return {
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: mockSelectorSourceFactory,
          chainId: 84532,
        },
      },
      blockLimits: {
        start: mockSelectorSourceStartBlock,
        end: null,
      },
    };
  }),
  getDemoSessionConfigBySlug: jest.fn((slug = '') => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    if (normalized && normalized !== 'general') return null;
    return {
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: mockSelectorSourceFactory,
          chainId: 84532,
        },
      },
      blockLimits: {
        start: mockSelectorSourceStartBlock,
        end: null,
      },
    };
  }),
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  buildSiweMessage: jest.fn(() => 'siwe-message'),
  buildSignedBootstrapAdminAuth: jest.fn(async ({ slug }) => ({
    address: mockTestAdminAddress,
    message: 'bootstrap-siwe-message',
    signature: '0xbootstrap-admin-auth',
    sessionSlug: slug,
  })),
  buildSignedAdminActionAuth: jest.fn(async ({ action, slug, body }) => ({
    address: mockTestAdminAddress,
    signature: '0xadmin-action-signature',
    action,
    slug,
    bodyHash: '0xadmin-body-hash',
    nonce: 'wizard-admin-nonce',
    audience: 'http://localhost',
    expiration: 4102444800,
    __body: body,
  })),
  normalizeWorkerUrl: jest.fn((value = '') => String(value || '').trim()),
}));

jest.mock('../../utilities/web3/rpcReadCache.js', () => ({
  wrapEthersJsonRpcSend: jest.fn((provider) => provider),
}));

jest.mock('../../variables/appConfig.js', () => {
  const actual = jest.requireActual('../../variables/appConfig.js');
  return {
    ...actual,
    CLOUDFLARE_WORKER_BUNDLE_URL: '',
  };
});

import SessionWizard from './SessionWizard';

const SessionWizardComponent = SessionWizard as React.ComponentType<any>;
const mockedBuildContractViewerContracts = buildContractViewerContracts as jest.Mock;

const commitSessionModeProfileGateIfPresent = () => {
  if (screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)) return;
  const preset = screen.queryByTestId('ce-new-preset-fast_cheap_cloudflare');
  if (preset) {
    act(() => {
      fireEvent.click(preset);
    });
  }
  const continueButton = screen.queryByTestId('ce-new-preset-continue') as HTMLButtonElement | null;
  if (continueButton && !continueButton.disabled) {
    act(() => {
      fireEvent.click(continueButton);
    });
  }
};

const renderLoggedInSessionWizard = (props: Record<string, any> = {}) => {
  const view = render(
    <SessionWizardComponent
      network={{ id: 84532 }}
      account={TEST_ADMIN_ADDRESS}
      loginComplete
      toggleLoginModal={jest.fn()}
      {...props}
    />,
  );
  commitSessionModeProfileGateIfPresent();
  return view;
};
const setControlledInputValue = (input: HTMLElement, value: string) => {
  const inputWithReactProps = input as any;
  const reactPropsKey = Object.keys(inputWithReactProps).find((key) => key.startsWith('__reactProps$'));
  if (reactPropsKey) {
    act(() => {
      inputWithReactProps[reactPropsKey].onChange({ target: { value } });
    });
    return;
  }
  fireEvent.change(input, { target: { value } });
};

describe('SessionWizard blank bundle render regression', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    const { registerSessionOnChain } = require('../../utilities/web3/sessionRegistry.js');

    jest.clearAllMocks();
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    sessionStorage.clear();
    global.fetch = createDefaultFetchMock() as any;
    mockDownloadDataFromArweave.mockResolvedValue(buildMockSponsoredBundleEnvelope());
    mockDecryptWithPassword.mockResolvedValue(buildMockSponsoredBundle());
    arweaveClient.uploadDataToArweave.mockResolvedValue('a'.repeat(43));
    registerSessionOnChain.mockResolvedValue({ txs: [] });
    mockedBuildContractViewerContracts.mockImplementation(() => []);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('shows the normal-mode deploy override controls immediately when the hosted bundle URL default is blank', async () => {
    const manualBundleUrl = 'https://assets.example.test/normal-sessionCorsWorker.bundle.js';

    renderLoggedInSessionWizard();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Normal Deploy Blank Bundle URL' },
    });

    fireEvent.click(screen.getByRole('button', { name: /step \d+: worker/i }));

    const bundleUrlOverrideInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE);
    expect(bundleUrlOverrideInput).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'No default hosted worker bundle URL is configured for normal mode. Provide a manual bundle URL or upload a bundle file below. Optional fallback: Run nvm use 20 && npm run worker:bundle from the repo root, then choose /dist/sessionCorsWorker.bundle.js.',
      ),
    ).toHaveLength(2);

    fireEvent.change(bundleUrlOverrideInput, {
      target: { value: manualBundleUrl },
    });

    expect(bundleUrlOverrideInput).toHaveValue(manualBundleUrl);
  });

  it('shows the sponsored publish override controls immediately when the hosted bundle URL default is blank', async () => {
    const manualBundleUrl = 'https://assets.example.test/sponsored-sessionCorsWorker.bundle.js';
    let resolveSponsoredBundle!: (bundle: ReturnType<typeof buildMockSponsoredBundle>) => void;
    const sponsoredBundleReady = new Promise<ReturnType<typeof buildMockSponsoredBundle>>((resolve) => {
      resolveSponsoredBundle = resolve;
    });

    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          networkChainId: 84532,
          blockLimits: {
            start: mockSelectorSourceStartBlock,
            end: null,
          },
          contracts: {
            sbtFactory: {
              address: mockSelectorSourceFactory,
              chainId: 84532,
            },
          },
          __registry: {
            chainId: 84532,
            registryChainId: 84532,
          },
        },
        deployForm: {
          workerName: 'sponsored-blank-bundle-worker',
        },
      }),
    );
    mockDecryptWithPassword.mockReturnValueOnce(sponsoredBundleReady);

    renderLoggedInSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Sponsored Publish Blank Bundle URL' },
    });

    await selectDecentralizedProfile();
    fireEvent.click(screen.getByRole('button', { name: /step \d+: worker/i }));

    const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
    setControlledInputValue(cloudflareTokenInput, 'cf-test-token');
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
      target: { value: 'sk-sponsored-blank-bundle' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
      target: { value: '{"kty":"RSA","n":"sponsored-blank-bundle"}' },
    });

    await act(async () => {
      resolveSponsoredBundle(buildMockSponsoredBundle());
      await sponsoredBundleReady;
    });

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
        'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, RPC URL, Lit API key, deploy access.',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /step \d+: deploy session/i }));

    const bundleUrlOverrideInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE);
    expect(bundleUrlOverrideInput).toBeInTheDocument();
    expect(screen.getByText('Worker bundle fallback (optional)')).toBeInTheDocument();

    fireEvent.change(bundleUrlOverrideInput, {
      target: { value: manualBundleUrl },
    });

    expect(bundleUrlOverrideInput).toHaveValue(manualBundleUrl);
  });

  it('shows the blank-default sponsored publish file-only fallback state when a bundle file is selected', async () => {
    const bundleFile = {
      name: 'sessionCorsWorker.bundle.js',
      type: 'text/javascript',
      text: async () => 'export default { async fetch() { return new Response("blank-default-file"); } };',
    };
    let resolveSponsoredBundle!: (bundle: ReturnType<typeof buildMockSponsoredBundle>) => void;
    const sponsoredBundleReady = new Promise<ReturnType<typeof buildMockSponsoredBundle>>((resolve) => {
      resolveSponsoredBundle = resolve;
    });

    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          networkChainId: 84532,
          blockLimits: {
            start: mockSelectorSourceStartBlock,
            end: null,
          },
          contracts: {
            sbtFactory: {
              address: mockSelectorSourceFactory,
              chainId: 84532,
            },
          },
          __registry: {
            chainId: 84532,
            registryChainId: 84532,
          },
        },
        deployForm: {
          workerName: 'sponsored-blank-bundle-worker',
        },
      }),
    );
    mockDecryptWithPassword.mockReturnValueOnce(sponsoredBundleReady);

    renderLoggedInSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Sponsored Publish Blank Bundle File' },
    });

    await selectDecentralizedProfile();
    fireEvent.click(screen.getByRole('button', { name: /step \d+: worker/i }));

    const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
    setControlledInputValue(cloudflareTokenInput, 'cf-test-token');
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
      target: { value: 'sk-sponsored-blank-default-file' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
      target: { value: '{"kty":"RSA","n":"sponsored-blank-default-file"}' },
    });

    await act(async () => {
      resolveSponsoredBundle(buildMockSponsoredBundle());
      await sponsoredBundleReady;
    });

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
        'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, RPC URL, Lit API key, deploy access.',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /step \d+: deploy session/i }));

    const bundleUrlOverrideInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE);
    const bundleFileInput = screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT);
    const publishBundleClearButton = screen.getByTestId(E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH);

    expect(bundleUrlOverrideInput).toHaveValue('');
    expect(publishBundleClearButton).toBeDisabled();

    fireEvent.change(bundleFileInput, {
      target: { files: [bundleFile] },
    });

    await waitFor(() => {
      expect(publishBundleClearButton).not.toBeDisabled();
      expect(screen.getByText('Using sessionCorsWorker.bundle.js for this publish.')).toBeInTheDocument();
    });
  });

  it('does not leak a stale advanced-mode bundle URL into normal-mode deploys when the hosted default is blank', async () => {
    const staleAdvancedBundleUrl = 'https://assets.example.test/stale-advanced-sessionCorsWorker.bundle.js';
    const fallbackFetch = createDefaultFetchMock();

    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        deployForm: {
          workerName: 'blank-bundle-regression-worker',
        },
      }),
    );

    global.fetch = jest.fn(async (url: any, options: any = {}): Promise<any> => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          status: 200,
          json: async (): Promise<any> => ({
            ok: true,
            workerUrl: 'https://worker.example.test',
            writesSessionSecrets: true,
          }),
        };
      }
      if (normalizedUrl.endsWith('/admin/set-config') || normalizedUrl.endsWith('/admin/set-secrets')) {
        return {
          ok: true,
          status: 200,
          json: async (): Promise<any> => ({ ok: true }),
        };
      }
      return fallbackFetch(url, options);
    }) as any;

    renderLoggedInSessionWizard();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Blank Bundle Regression Session' },
    });

    await selectDecentralizedProfile();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

    const bundleModeUrlInput = (await screen.findByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_URL)) as HTMLInputElement;
    if (!bundleModeUrlInput.checked) {
      fireEvent.click(bundleModeUrlInput);
    }

    const advancedBundleUrlInput = screen.getByPlaceholderText(
      'https://github.com/<org>/<repo>/releases/latest/download/sessionCorsWorker.bundle.js',
    );
    setControlledInputValue(advancedBundleUrlInput, staleAdvancedBundleUrl);

    const deployHelperUrlInput = screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL);
    if (deployHelperUrlInput) {
      setControlledInputValue(deployHelperUrlInput, 'https://deploy-helper.example.test');
    }

    setControlledInputValue(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN), 'cf-test-token');
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
      target: { value: 'sk-blank-bundle-regression' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
      target: { value: '{"kty":"RSA","n":"blank-bundle-regression"}' },
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL));
    fireEvent.click(await screen.findByRole('button', { name: /step \d+: worker/i }));

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue('');
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
        'Upload a worker bundle file before deploy.',
      );
    });
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(([url]: any[]) => String(url).endsWith('/deploy')),
    ).toHaveLength(0);
  });
});
